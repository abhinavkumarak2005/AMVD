from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from asyncpg import Connection
import json
from datetime import datetime, timedelta
import uuid
import os
from io import BytesIO
import logging

from app.core.database import get_db
from app.core.config import settings
from app.core.auth import get_current_user
from app.schemas.booking import HoldRequest, HoldResponse, CreateBookingRequest, CreateBookingResponse, ExtendHoldRequest, ReleaseHoldRequest
from app.services.razorpay_client import client as razorpay_client
from app.services.pdf_generator import generate_receipt_pdf
from app.services.email_service import send_email
from fastapi.responses import FileResponse
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()

@router.put("/{booking_id}/cancel")
async def cancel_my_booking(
    booking_id: str, 
    user_id: str = Depends(get_current_user),
    db: Connection = Depends(get_db)
):
    async with db.transaction():
        booking = await db.fetchrow("SELECT status, num_persons, service_id, date, session FROM bookings WHERE id = $1 AND user_id = $2 FOR UPDATE", booking_id, user_id)
        if not booking:
            raise HTTPException(404, "Booking not found")
        
        if booking['status'] != 'pending_payment':
            raise HTTPException(400, "Only pending bookings can be cancelled by user.")
            
        await db.execute("UPDATE bookings SET status = 'cancelled' WHERE id = $1", booking_id)
        
    return {"status": "success"}
@router.get("/services")
async def get_public_services(db: Connection = Depends(get_db)):
    records = await db.fetch("SELECT *, sessions::text AS sessions_text, available_days::text AS available_days_text FROM services WHERE is_active = true ORDER BY name")
    return [
        {
            **dict(r), 
            "sessions": json.loads(r["sessions_text"]) if r["sessions_text"] else ["Morning", "Evening", "All Day"],
            "available_days": json.loads(r["available_days_text"]) if r["available_days_text"] else [0,1,2,3,4,5,6]
        } 
        for r in records
    ]

@router.get("/availability")
async def get_availability(service_id: str, date: str, db: Connection = Depends(get_db)):
    try:
        parsed_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Expected YYYY-MM-DD")

    service = await db.fetchrow("SELECT slot_capacity, sessions::text AS sessions_text FROM services WHERE id = $1", service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
        
    sessions = json.loads(service['sessions_text']) if service['sessions_text'] else ["Morning", "Evening", "All Day"]
    
    # Check if calendar is blocked
    block = await db.fetchrow("SELECT status, blocked_service_ids FROM calendar_dates WHERE date = $1", parsed_date)
    blocked_ids = [str(uid) for uid in (block['blocked_service_ids'] or [])] if block else []
    if block and (block['status'] == 'blocked' or (block['status'] == 'partial' and service_id in blocked_ids)):
        # Fully blocked, return -1 to indicate explicitly blocked
        return {s: -1 for s in sessions}

    # Fetch existing slots for this date and service
    slots = await db.fetch("SELECT session, total_capacity, confirmed_count, pending_count FROM slot_inventory WHERE service_id = $1 AND date = $2", service_id, parsed_date)
    
    slot_map = {s['session']: s['total_capacity'] - (s['confirmed_count'] + s['pending_count']) for s in slots}
    
    res = {}
    for sess in sessions:
        if sess in slot_map:
            res[sess] = max(0, slot_map[sess])
        else:
            res[sess] = service['slot_capacity']
            
    return res

@router.post("/hold", response_model=HoldResponse)
async def hold_slot(req: HoldRequest, db: Connection = Depends(get_db)):
    """
    1. Checks if the slot is available in slot_inventory.
    2. Uses SELECT ... FOR UPDATE to lock the slot_inventory row.
    3. Increments pending_count.
    4. Creates a booking_holds record valid for 10 minutes.
    """
    # Check if the service is available on the requested day of the week
    service = await db.fetchrow("SELECT slot_capacity, available_days::text AS available_days_text, sessions::text AS sessions_text FROM services WHERE id = $1", req.service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Service not found.")
        
    req_date_obj = datetime.strptime(str(req.date), "%Y-%m-%d").date()
    # python weekday(): Monday=0, Sunday=6
    # map to frontend JS getDay(): Sunday=0, Monday=1, ... Saturday=6
    weekday_map = {6: 0, 0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6}
    dow = weekday_map[req_date_obj.weekday()]
    
    available_days = json.loads(service['available_days_text']) if service['available_days_text'] else [0,1,2,3,4,5,6]
    if dow not in available_days:
        raise HTTPException(status_code=400, detail="Service is not available on this date.")
        
    sessions = json.loads(service['sessions_text']) if service['sessions_text'] else ["Morning", "Evening", "All Day"]
    if req.session not in sessions:
        raise HTTPException(status_code=400, detail="Invalid session for this service.")

    # check calendar block
    block = await db.fetchrow("SELECT status, blocked_service_ids FROM calendar_dates WHERE date = $1::date", req.date)
    blocked_ids = [str(uid) for uid in (block['blocked_service_ids'] or [])] if block else []
    if block and (block['status'] == 'blocked' or (block['status'] == 'partial' and req.service_id in blocked_ids)):
        raise HTTPException(status_code=400, detail="This date is blocked for bookings.")

    async with db.transaction():
        # First, find the slot and lock it
        slot = await db.fetchrow(
            """
            SELECT id, total_capacity, confirmed_count, pending_count 
            FROM slot_inventory 
            WHERE service_id = $1 AND date = $2 AND session = $3
            FOR UPDATE
            """,
            req.service_id, req.date, req.session
        )

        if not slot:
            # Insert the new slot and lock it
            await db.execute(
                """
                INSERT INTO slot_inventory (service_id, date, session, total_capacity, confirmed_count, pending_count)
                VALUES ($1, $2, $3, $4, 0, 0)
                ON CONFLICT (service_id, date, session) DO NOTHING
                """,
                req.service_id, req.date, req.session, service['slot_capacity']
            )
            # Fetch it again to lock it
            slot = await db.fetchrow(
                """
                SELECT id, total_capacity, confirmed_count, pending_count 
                FROM slot_inventory 
                WHERE service_id = $1 AND date = $2 AND session = $3
                FOR UPDATE
                """,
                req.service_id, req.date, req.session
            )

        # Check capacity
        available = slot['total_capacity'] - (slot['confirmed_count'] + slot['pending_count'])
        if available < req.slot_capacity:
            raise HTTPException(status_code=400, detail=f"Not enough capacity. Only {available} available.")

        # Hold the slot
        hold_expires_at = datetime.now() + timedelta(minutes=10)
        
        # Insert into booking_holds
        hold_id = await db.fetchval(
            """
            INSERT INTO booking_holds (service_id, user_id, date, session, expires_at)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
            """,
            req.service_id, req.user_id, req.date, req.session, hold_expires_at
        )
        
        # Increment pending_count
        await db.execute(
            """
            UPDATE slot_inventory 
            SET pending_count = pending_count + $1
            WHERE id = $2
            """,
            req.slot_capacity, slot['id']
        )
        
        return HoldResponse(hold_id=str(hold_id), expires_at=hold_expires_at.isoformat())
@router.post("/extend_hold")
async def extend_hold(req: ExtendHoldRequest, db: Connection = Depends(get_db)):
    # Add 5 minutes to hold
    await db.execute(
        "UPDATE booking_holds SET expires_at = expires_at + interval '5 minutes' WHERE id = $1 AND is_released = false",
        req.hold_id
    )
    return {"status": "extended"}

@router.post("/release_hold")
async def release_hold(req: ReleaseHoldRequest, db: Connection = Depends(get_db)):
    async with db.transaction():
        hold = await db.fetchrow(
            "SELECT service_id, date, session, is_released FROM booking_holds WHERE id = $1 FOR UPDATE", 
            req.hold_id
        )
        if hold and not hold['is_released']:
            await db.execute("UPDATE booking_holds SET is_released = true WHERE id = $1", req.hold_id)
            await db.execute(
                "UPDATE slot_inventory SET pending_count = GREATEST(pending_count - 1, 0) WHERE service_id = $1 AND date = $2 AND session = $3",
                hold['service_id'], hold['date'], hold['session']
            )
    return {"status": "released"}

@router.post("/create", response_model=CreateBookingResponse)
async def create_booking(req: CreateBookingRequest, db: Connection = Depends(get_db)):
    """
    1. Verifies the hold_id is still valid.
    2. Creates a Razorpay Order.
    3. Inserts into the bookings table and payments table.
    """
    async with db.transaction():
        # Verify hold
        hold = await db.fetchrow(
            """
            SELECT id, service_id, date, session 
            FROM booking_holds 
            WHERE id = $1 AND expires_at > NOW() AND is_released = false
            FOR UPDATE
            """,
            req.hold_id
        )
        
        if not hold:
            raise HTTPException(status_code=400, detail="Hold expired or invalid.")

        # Fetch service details to get price
        service = await db.fetchrow("SELECT price_rupees FROM services WHERE id = $1", hold['service_id'])
        if not service:
            raise HTTPException(status_code=400, detail="Service not found.")
            
        amount_paise = service['price_rupees'] * 100

        # Create Razorpay order
        order = razorpay_client.order.create({
            "amount": amount_paise,
            "currency": "INR",
            "receipt": req.hold_id[:10]
        })

        booking_id = await db.fetchval(
            """
            INSERT INTO bookings (user_id, service_id, hold_id, date, session, num_persons, amount_rupees, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending_payment')
            RETURNING id
            """,
            req.user_id, hold['service_id'], req.hold_id, hold['date'], hold['session'], 
            req.num_persons, amount_paise // 100
        )

        for i, person in enumerate(req.persons):
            await db.execute(
                """
                INSERT INTO booking_persons (booking_id, sort_order, full_name, email, age, relation, phone)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                """,
                booking_id, i+1, person.get('fullName', ''), person.get('email', None), 
                int(person.get('age', 0)) if person.get('age') else None, 
                person.get('relation', None), person.get('phone', None)
            )

        # Insert into payments table
        await db.execute(
            """
            INSERT INTO payments (booking_id, user_id, razorpay_order_id, amount_rupees, status)
            VALUES ($1, $2, $3, $4, 'initiated')
            """,
            booking_id, req.user_id, order['id'], service['price_rupees']
        )

        return CreateBookingResponse(
            booking_id=str(booking_id), 
            razorpay_order_id=order['id'],
            amount_rupees=service['price_rupees']
        )

class VerifyBookingRequest(BaseModel):
    razorpay_payment_id: str
    razorpay_order_id: str
    razorpay_signature: str

@router.post("/verify")
async def verify_booking(req: VerifyBookingRequest, background_tasks: BackgroundTasks, db: Connection = Depends(get_db)):
    """Manually verify a booking payment (fallback for localhost webhooks)"""
    try:
        razorpay_client.utility.verify_payment_signature({
            'razorpay_payment_id': req.razorpay_payment_id,
            'razorpay_order_id': req.razorpay_order_id,
            'razorpay_signature': req.razorpay_signature
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid signature")

    async with db.transaction():
        payment_record = await db.fetchrow(
            "SELECT booking_id, status FROM payments WHERE razorpay_order_id = $1 FOR UPDATE",
            req.razorpay_order_id
        )
        if not payment_record or not payment_record['booking_id']:
            raise HTTPException(status_code=404, detail="Payment record not found")
            
        if payment_record['status'] == 'success':
            booking_ref = await db.fetchval("SELECT reference FROM bookings WHERE id = $1", payment_record['booking_id'])
            return {"status": "already_completed", "id": payment_record['booking_id'], "reference": booking_ref}
            
        await db.execute(
            "UPDATE payments SET status = 'success', razorpay_payment_id = $1 WHERE razorpay_order_id = $2",
            req.razorpay_payment_id, req.razorpay_order_id
        )
        
        await db.execute(
            "UPDATE bookings SET status = 'confirmed' WHERE id = $1",
            payment_record['booking_id']
        )
        
        booking = await db.fetchrow("SELECT service_id, date, session, num_persons, user_id, reference, amount_rupees FROM bookings WHERE id = $1", payment_record['booking_id'])
        if booking:
            await db.execute(
                """
                UPDATE slot_inventory 
                SET pending_count = GREATEST(0, pending_count - $1),
                    confirmed_count = confirmed_count + $1
                WHERE service_id = $2 AND date = $3 AND session = $4
                """,
                booking['num_persons'], booking['service_id'], booking['date'], booking['session']
            )
            
            user = await db.fetchrow("SELECT full_name, email FROM users WHERE id = $1", booking['user_id'])
            
            print(f"DEBUG Booking Email: Found user: {user['full_name'] if user else 'None'}, Email: {user['email'] if user else 'None'}", flush=True)
            
            if user:
                if not user['email']:
                    print("DEBUG Booking Email: User has no email address. Skipping email sending.", flush=True)
                else:
                    service = await db.fetchrow("SELECT name FROM services WHERE id = $1", booking['service_id'])
                    receipt_data = {
                        "receipt_no": booking['reference'],
                        "name": user['full_name'] or 'Devotee',
                        "details": service['name'] if service else 'Pooja Booking',
                        "amount": booking['amount_rupees'],
                        "type": "Pooja Booking"
                    }
                    
                    def generate_and_send(data, email_address):
                        print("DEBUG Booking Email: Background task started.", flush=True)
                        try:
                            pdf_path = generate_receipt_pdf(data)
                            print(f"DEBUG Booking Email: PDF generated at {pdf_path}", flush=True)
                            import asyncio
                            import os
                            from app.services.email_service import send_email
                            asyncio.run(send_email(
                                email_address, 
                                "Your Pooja Booking Receipt", 
                                f"<h1>Om Sri Manakula Vinayagar!</h1><p>Dear {data['name']}, your booking is confirmed. Please find your receipt attached.</p>",
                                pdf_path
                            ))
                            try:
                                os.remove(pdf_path)
                                print(f"DEBUG Booking Email: PDF {pdf_path} deleted successfully.", flush=True)
                            except Exception as cleanup_err:
                                print(f"DEBUG Booking Email: Failed to delete PDF: {cleanup_err}", flush=True)
                        except Exception as e:
                            print(f"DEBUG Booking Email: CRITICAL ERROR in background task: {e}", flush=True)
                    
                    print("DEBUG Booking Email: Adding background task for email.", flush=True)
                    background_tasks.add_task(generate_and_send, receipt_data, user['email'])
                
    return {"status": "success", "id": payment_record['booking_id'], "reference": booking['reference']}

@router.get("/{booking_id}/receipt")
async def download_receipt(booking_id: str, db: Connection = Depends(get_db)):
    """Generate and return PDF receipt on the fly for the dashboard"""
    booking = await db.fetchrow(
        "SELECT user_id, service_id, amount_rupees, reference, status FROM bookings WHERE id = $1", 
        booking_id
    )
    if not booking or booking['status'] != 'confirmed':
        raise HTTPException(status_code=404, detail="Receipt not available")
        
    user = await db.fetchrow("SELECT full_name FROM users WHERE id = $1", booking['user_id'])
    service = await db.fetchrow("SELECT name FROM services WHERE id = $1", booking['service_id'])
    
    receipt_data = {
        "receipt_no": booking['reference'],
        "name": user['full_name'] or 'Devotee',
        "details": service['name'] if service else 'Pooja Booking',
        "amount": booking['amount_rupees'],
        "type": "Pooja Booking"
    }
    
    pdf_path = generate_receipt_pdf(receipt_data)
    
    return FileResponse(
        pdf_path, 
        media_type="application/pdf", 
        filename=f"{booking['reference']}.pdf"
    )

@router.post("/webhook")
async def razorpay_webhook(request: Request, background_tasks: BackgroundTasks, db: Connection = Depends(get_db)):
    body = await request.body()
    signature = request.headers.get("x-razorpay-signature")
    
    if not signature:
        raise HTTPException(status_code=400, detail="Missing signature")
        
    try:
        razorpay_client.utility.verify_webhook_signature(
            body.decode('utf-8'),
            signature,
            settings.RAZORPAY_WEBHOOK_SECRET if settings.RAZORPAY_WEBHOOK_SECRET else settings.RAZORPAY_KEY_SECRET
        )
    except Exception as e:
        logger.error(f"Webhook signature mismatch: {e}")
        # Accept anyway for local testing if needed, or raise
        # raise HTTPException(status_code=400, detail=str(e))

    payload = json.loads(body)
    
    if payload.get('event') == 'payment.captured':
        payment = payload['payload']['payment']['entity']
        order_id = payment.get('order_id')
        payment_id = payment.get('id')
        
        if order_id:
            async with db.transaction():
                # 1. Check if it's a Booking Payment
                payment_record = await db.fetchrow(
                    "SELECT booking_id FROM payments WHERE razorpay_order_id = $1 FOR UPDATE",
                    order_id
                )
                
                if payment_record and payment_record['booking_id']:
                    await db.execute(
                        "UPDATE payments SET status = 'success', razorpay_payment_id = $1 WHERE razorpay_order_id = $2",
                        payment_id, order_id
                    )
                    
                    await db.execute(
                        "UPDATE bookings SET status = 'confirmed' WHERE id = $1",
                        payment_record['booking_id']
                    )
                    
                    booking = await db.fetchrow("SELECT service_id, date, session, num_persons, user_id, reference, amount_rupees FROM bookings WHERE id = $1", payment_record['booking_id'])
                    if booking:
                        await db.execute(
                            """
                            UPDATE slot_inventory 
                            SET pending_count = GREATEST(0, pending_count - $1),
                                confirmed_count = confirmed_count + $1
                            WHERE service_id = $2 AND date = $3 AND session = $4
                            """,
                            booking['num_persons'], booking['service_id'], booking['date'], booking['session']
                        )
                        
                        user = await db.fetchrow("SELECT full_name, email FROM users WHERE id = $1", booking['user_id'])
                        if user and user['email']:
                            service = await db.fetchrow("SELECT name FROM services WHERE id = $1", booking['service_id'])
                            receipt_data = {
                                "receipt_no": booking['reference'],
                                "name": user['full_name'] or 'Devotee',
                                "details": service['name'] if service else 'Pooja Booking',
                                "amount": booking['amount_rupees'],
                                "type": "Pooja Booking"
                            }
                            
                            def generate_and_send(data, email_address):
                                print("DEBUG Webhook Booking Email: Background task started.", flush=True)
                                try:
                                    pdf_path = generate_receipt_pdf(data)
                                    print(f"DEBUG Webhook Booking Email: PDF generated at {pdf_path}", flush=True)
                                    import asyncio
                                    import os
                                    from app.services.email_service import send_email
                                    asyncio.run(send_email(
                                        email_address, 
                                        "Your Pooja Booking Receipt", 
                                        f"<h1>Om Sri Manakula Vinayagar!</h1><p>Dear {data['name']}, your booking is confirmed. Please find your receipt attached.</p>",
                                        pdf_path
                                    ))
                                    try:
                                        os.remove(pdf_path)
                                        print(f"DEBUG Webhook Booking Email: PDF {pdf_path} deleted successfully.", flush=True)
                                    except Exception as cleanup_err:
                                        print(f"DEBUG Webhook Booking Email: Failed to delete PDF: {cleanup_err}", flush=True)
                                except Exception as e:
                                    print(f"DEBUG Webhook Booking Email: CRITICAL ERROR in background task: {e}", flush=True)
                            
                            print("DEBUG Webhook Booking Email: Adding background task for email.", flush=True)
                            background_tasks.add_task(generate_and_send, receipt_data, user['email'])
                
                else:
                    # 2. Check if it's an E-Undiyal Donation
                    donation = await db.fetchrow(
                        "SELECT id, user_id, amount_rupees, reference, notes FROM e_undiyal_transactions WHERE razorpay_order_id = $1 FOR UPDATE",
                        order_id
                    )
                    if donation:
                        await db.execute(
                            "UPDATE e_undiyal_transactions SET status = 'success', razorpay_payment_id = $1 WHERE razorpay_order_id = $2",
                            payment_id, order_id
                        )
                        
                        user = await db.fetchrow("SELECT full_name, email FROM users WHERE id = $1", donation['user_id'])
                        if user and user['email']:
                            receipt_data = {
                                "receipt_no": donation['reference'],
                                "name": user['full_name'] or 'Devotee',
                                "details": donation['notes'] or 'General Donation',
                                "amount": donation['amount_rupees'],
                                "type": "E-Undiyal Donation"
                            }
                            
                            def generate_and_send_donation(data, email_address):
                                print("DEBUG Webhook Donation Email: Background task started.", flush=True)
                                try:
                                    pdf_path = generate_receipt_pdf(data)
                                    print(f"DEBUG Webhook Donation Email: PDF generated at {pdf_path}", flush=True)
                                    import asyncio
                                    import os
                                    from app.services.email_service import send_email
                                    asyncio.run(send_email(
                                        email_address, 
                                        "Thank You for Your Donation", 
                                        f"<h1>Om Sri Manakula Vinayagar!</h1><p>Dear {data['name']}, your generous donation of Rs. {data['amount']} has been received. May Lord Ganesha bless you!</p>",
                                        pdf_path
                                    ))
                                    try:
                                        os.remove(pdf_path)
                                        print(f"DEBUG Webhook Donation Email: PDF {pdf_path} deleted successfully.", flush=True)
                                    except Exception as cleanup_err:
                                        print(f"DEBUG Webhook Donation Email: Failed to delete PDF: {cleanup_err}", flush=True)
                                except Exception as e:
                                    print(f"DEBUG Webhook Donation Email: CRITICAL ERROR in background task: {e}", flush=True)
                            
                            print("DEBUG Webhook Donation Email: Adding background task for email.", flush=True)
                            background_tasks.add_task(generate_and_send_donation, receipt_data, user['email'])
            
    return {"status": "ok"}
