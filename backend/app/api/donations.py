from fastapi import APIRouter, Depends, HTTPException
from asyncpg import Connection
from app.core.database import get_db
from app.schemas.donation import CreateDonationRequest, CreateDonationResponse
from app.services.razorpay_client import client as razorpay_client
from app.services.pdf_generator import generate_receipt_pdf
from app.services.email_service import send_email
from app.core.config import settings
from pydantic import BaseModel
from fastapi.responses import FileResponse
from fastapi import BackgroundTasks
import uuid
import os
import uuid
import os
from app.core.auth import get_current_user

router = APIRouter()

@router.put("/{donation_id}/cancel")
async def cancel_my_donation(
    donation_id: str, 
    user_id: str = Depends(get_current_user),
    db: Connection = Depends(get_db)
):
    async with db.transaction():
        donation = await db.fetchrow("SELECT status FROM e_undiyal_transactions WHERE id = $1 AND user_id = $2 FOR UPDATE", donation_id, user_id)
        if not donation:
            raise HTTPException(404, "Donation not found")
        
        if donation['status'] != 'initiated':
            raise HTTPException(400, "Only initiated donations can be cancelled by user.")
            
        await db.execute("UPDATE e_undiyal_transactions SET status = 'cancelled' WHERE id = $1", donation_id)
        
    return {"status": "success"}

@router.post("/create", response_model=CreateDonationResponse)
async def create_donation(req: CreateDonationRequest, db: Connection = Depends(get_db)):
    async with db.transaction():
        # Create Razorpay order
        amount_paise = req.amount_rupees * 100
        
        try:
            order = razorpay_client.order.create({
                "amount": amount_paise,
                "currency": "INR",
                "receipt": f"don_{str(uuid.uuid4())[:8]}"
            })
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
            
        # Generate a unique reference in Python (to avoid Postgres trigger constraints)
        reference = f"DON-{str(uuid.uuid4())[:8].upper()}"

        transaction_id = await db.fetchval(
            """
            INSERT INTO e_undiyal_transactions (user_id, amount_rupees, status, razorpay_order_id, reference, notes)
            VALUES ($1, $2, 'initiated', $3, $4, $5)
            RETURNING id
            """,
            req.user_id, req.amount_rupees, order['id'], reference, req.notes
        )

        return CreateDonationResponse(
            transaction_id=str(transaction_id),
            order_id=order['id'],
            amount_rupees=req.amount_rupees
        )

class VerifyDonationRequest(BaseModel):
    razorpay_payment_id: str
    razorpay_order_id: str
    razorpay_signature: str

@router.post("/verify")
async def verify_donation(req: VerifyDonationRequest, background_tasks: BackgroundTasks, db: Connection = Depends(get_db)):
    """Manually verify a donation (used as fallback for localhost where webhooks fail)"""
    try:
        razorpay_client.utility.verify_payment_signature({
            'razorpay_payment_id': req.razorpay_payment_id,
            'razorpay_order_id': req.razorpay_order_id,
            'razorpay_signature': req.razorpay_signature
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid signature")

    async with db.transaction():
        donation = await db.fetchrow(
            "SELECT id, user_id, amount_rupees, reference, notes, status FROM e_undiyal_transactions WHERE razorpay_order_id = $1 FOR UPDATE",
            req.razorpay_order_id
        )
        if not donation:
            raise HTTPException(status_code=404, detail="Donation not found")
            
        if donation['status'] == 'success':
            return {"status": "already_success", "id": donation['id'], "reference": donation['reference']}
            
        await db.execute(
            "UPDATE e_undiyal_transactions SET status = 'success', razorpay_payment_id = $1 WHERE razorpay_order_id = $2",
            req.razorpay_payment_id, req.razorpay_order_id
        )
        
        user = await db.fetchrow("SELECT full_name, email FROM users WHERE id = $1", donation['user_id'])
        
        print(f"DEBUG Email: Found user: {user['full_name'] if user else 'None'}, Email: {user['email'] if user else 'None'}", flush=True)
        
        if user:
            if not user['email']:
                print("DEBUG Email: User has no email address. Skipping email sending.", flush=True)
            else:
                receipt_data = {
                    "receipt_no": donation['reference'],
                    "name": user['full_name'] or 'Devotee',
                    "details": donation['notes'] or 'General Donation',
                    "amount": donation['amount_rupees'],
                    "type": "E-Undiyal Donation"
                }
                def generate_and_send(data, email_address):
                    print("DEBUG Email: Background task started.", flush=True)
                    try:
                        pdf_path = generate_receipt_pdf(data)
                        print(f"DEBUG Email: PDF generated at {pdf_path}", flush=True)
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
                            print(f"DEBUG Email: PDF {pdf_path} deleted successfully.", flush=True)
                        except Exception as cleanup_err:
                            print(f"DEBUG Email: Failed to delete PDF: {cleanup_err}", flush=True)
                    except Exception as e:
                        print(f"DEBUG Email: CRITICAL ERROR in background task: {e}", flush=True)
                
                print("DEBUG Email: Adding background task for email.", flush=True)
                background_tasks.add_task(generate_and_send, receipt_data, user['email'])

    return {"status": "success", "id": donation['id'], "reference": donation['reference']}

@router.get("/{donation_id}/receipt")
async def download_receipt(donation_id: str, db: Connection = Depends(get_db)):
    """Generate and return PDF receipt on the fly for the dashboard"""
    donation = await db.fetchrow(
        "SELECT user_id, amount_rupees, reference, notes, status FROM e_undiyal_transactions WHERE id = $1", 
        donation_id
    )
    if not donation or donation['status'] != 'success':
        raise HTTPException(status_code=404, detail="Receipt not available")
        
    user = await db.fetchrow("SELECT full_name FROM users WHERE id = $1", donation['user_id'])
    
    receipt_data = {
        "receipt_no": donation['reference'],
        "name": user['full_name'] or 'Devotee',
        "details": donation['notes'] or 'General Donation',
        "amount": donation['amount_rupees'],
        "type": "E-Undiyal Donation"
    }
    
    pdf_path = generate_receipt_pdf(receipt_data)
    
    return FileResponse(
        pdf_path, 
        media_type="application/pdf", 
        filename=f"{donation['reference']}.pdf"
    )

@router.post("/{donation_id}/80g")
async def request_80g(donation_id: str, db: Connection = Depends(get_db)):
    # Verify donation
    donation = await db.fetchrow("SELECT amount_rupees, user_id FROM e_undiyal_transactions WHERE id = $1 AND status = 'success'", donation_id)
    if not donation or donation['amount_rupees'] <= 10000:
        raise HTTPException(400, "Donation not eligible for 80G")
        
    await db.execute(
        """
        INSERT INTO tax_exemptions (donation_id, user_id, status) 
        VALUES ($1, $2, 'pending')
        ON CONFLICT (donation_id) DO NOTHING
        """,
        donation_id, donation['user_id']
    )
    return {"status": "success"}
