from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional
from asyncpg import Connection
from app.core.database import get_db
from app.core.audit import log_audit, compute_diff
from app.core.auth import get_current_admin, get_current_super_admin, require_permission, get_user_permissions, get_current_user
from app.services.email_service import send_email
import json
from datetime import datetime
import pytz

router = APIRouter()

@router.get("/my_permissions")
async def get_my_permissions(user_id: str = Depends(get_current_user), db: Connection = Depends(get_db)):
    perms = await get_user_permissions(user_id, db)
    return perms

# --- BOOKINGS MANAGEMENT ---

@router.get("/bookings")
async def get_bookings(
    db: Connection = Depends(get_db), 
    admin_id: str = Depends(get_current_admin),
    status: Optional[str] = None
):
    query = """
        SELECT b.id, b.date, b.session, b.status, b.reference, b.amount_rupees,
               s.name as service_name,
               u.full_name as user_name, u.email as user_email, u.phone as user_phone
        FROM bookings b
        JOIN services s ON b.service_id = s.id
        JOIN users u ON b.user_id = u.id
    """
    args = []
    if status:
        query += " WHERE b.status = $1"
        args.append(status)
    query += " ORDER BY b.created_at DESC"
    
    records = await db.fetch(query, *args)
    return [dict(r) for r in records]

class BookingStatusUpdate(BaseModel):
    status: str
    reason: Optional[str] = None

@router.put("/bookings/{booking_id}/status")
async def update_booking_status(
    booking_id: str, 
    update: BookingStatusUpdate, 
    background_tasks: BackgroundTasks,
    db: Connection = Depends(get_db), 
    admin_id: str = Depends(get_current_admin)
):
    if update.status not in ['confirmed', 'cancelled']:
        raise HTTPException(400, "Invalid status. Must be confirmed or cancelled.")

    async with db.transaction():
        booking = await db.fetchrow(
            """
            SELECT b.*, s.name as service_name, u.full_name, u.email 
            FROM bookings b
            JOIN services s ON b.service_id = s.id
            JOIN users u ON b.user_id = u.id
            WHERE b.id = $1 FOR UPDATE
            """, 
            booking_id
        )
        if not booking:
            raise HTTPException(404, "Booking not found")

        # Update status
        await db.execute("UPDATE bookings SET status = $1 WHERE id = $2", update.status, booking_id)

        # If cancelled, release slot capacity
        if update.status == 'cancelled' and booking['status'] == 'confirmed':
            await db.execute(
                """
                UPDATE slot_inventory 
                SET confirmed_count = GREATEST(0, confirmed_count - $1)
                WHERE service_id = $2 AND date = $3 AND session = $4
                """,
                booking['num_persons'], booking['service_id'], booking['date'], booking['session']
            )

        # If cancelled, send cancellation email
        if update.status == 'cancelled' and booking['email']:
            reason_text = f"<p>Reason: {update.reason}</p>" if update.reason else ""
            html = f"""
                <h1>Om Sri Manakula Vinayagar!</h1>
                <p>Dear {booking['full_name']},</p>
                <p>We regret to inform you that your booking for {booking['service_name']} on {booking['date']} (Ref: {booking['reference']}) has been cancelled.</p>
                {reason_text}
                <p>If you are eligible for a refund, our team will contact you shortly using your registered details to process the refund.</p>
            """
            
            def send_cancellation_email(to_email, body):
                import asyncio
                asyncio.run(send_email(to_email, "Booking Cancellation Notice", body))
                
            background_tasks.add_task(send_cancellation_email, booking['email'], html)

    await log_audit(db, admin_id, f"UPDATE_BOOKING_STATUS_{update.status.upper()}", "booking", booking_id, {"status": update.status, "reason": getattr(update, "reason", "")})
    return {"status": "success", "new_status": update.status}

# --- CALENDAR MANAGEMENT ---

class BlockDateRequest(BaseModel):
    date: str
    reason: str
    service_id: Optional[str] = None

@router.post("/calendar/block")
async def block_date(
    req: BlockDateRequest, 
    db: Connection = Depends(get_db), 
    admin_id: str = Depends(require_permission('manage_bookings')),
):
    # Convert string to date object for asyncpg
    try:
        parsed_date = datetime.strptime(req.date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Expected YYYY-MM-DD")

    # Check if bookings already exist on this date (optionally filter by service_id)
    query = """
        SELECT b.id, b.reference, s.name as service, u.full_name, u.phone
        FROM bookings b
        JOIN services s ON b.service_id = s.id
        JOIN users u ON b.user_id = u.id
        WHERE b.date = $1::date AND b.status IN ('confirmed', 'pending_approval')
    """
    args = [parsed_date]
    if req.service_id:
        query += " AND b.service_id = $2"
        args.append(req.service_id)
        
    existing_bookings = await db.fetch(query, *args)
    
    # Just insert block record, but warn admin if bookings exist
    if req.service_id:
        await db.execute(
            """
            INSERT INTO calendar_dates (date, status, special_instructions, blocked_service_ids)
            VALUES ($1::date, 'partial'::calendar_status, $2, ARRAY[$3::uuid])
            ON CONFLICT (date) DO UPDATE SET 
                status = CASE WHEN calendar_dates.status = 'blocked'::calendar_status THEN 'blocked'::calendar_status ELSE 'partial'::calendar_status END,
                special_instructions = EXCLUDED.special_instructions,
                blocked_service_ids = array_append(calendar_dates.blocked_service_ids, $3::uuid)
            """,
            parsed_date, req.reason, req.service_id
        )
    else:
        await db.execute(
            """
            INSERT INTO calendar_dates (date, status, special_instructions)
            VALUES ($1::date, 'blocked'::calendar_status, $2)
            ON CONFLICT (date) DO UPDATE SET 
                status = 'blocked'::calendar_status,
                special_instructions = EXCLUDED.special_instructions
            """,
            parsed_date, req.reason
        )
    
    await log_audit(db, admin_id, "BLOCK_CALENDAR_DATE", "calendar", req.date, req.model_dump(mode="json"))
    return {
        "status": "success",
        "message": f"Date {req.date} blocked.",
        "affected_bookings": [dict(b) for b in existing_bookings]
    }

@router.get("/calendar/blocks")
async def get_blocked_dates(db: Connection = Depends(get_db), admin_id: str = Depends(require_permission('manage_calendar'))):
    records = await db.fetch("SELECT date, status, special_instructions as reason, blocked_service_ids FROM calendar_dates WHERE status IN ('blocked', 'partial') ORDER BY date")
    return [{
        "date": r['date'].isoformat(), 
        "reason": r['reason'],
        "status": r['status'],
        "service_ids": r['blocked_service_ids'] or []
    } for r in records]

@router.delete("/calendar/block/{date_str}")
async def unblock_date(date_str: str, db: Connection = Depends(get_db), admin_id: str = Depends(require_permission('manage_calendar'))):
    try:
        parsed_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Expected YYYY-MM-DD")
        
    await db.execute("DELETE FROM calendar_dates WHERE date = $1::date", parsed_date)
    await log_audit(db, admin_id, "UNBLOCK_CALENDAR_DATE", "calendar", date_str)
    return {"status": "success"}

# --- SERVICES MANAGEMENT ---

@router.get("/services")
async def get_admin_services(db: Connection = Depends(get_db), admin_id: str = Depends(require_permission('manage_services'))):
    records = await db.fetch("SELECT id, name, category, price_rupees, slot_capacity, advance_days, max_persons, sessions::text, available_days::text FROM services ORDER BY name")
    return [
        {
            **dict(r), 
            "sessions": json.loads(r["sessions"]) if r["sessions"] else ["Morning", "Evening", "All Day"],
            "available_days": json.loads(r["available_days"]) if r["available_days"] else [0,1,2,3,4,5,6]
        } 
        for r in records
    ]

class UpdateServiceRequest(BaseModel):
    price_rupees: int
    slot_capacity: int
    advance_days: int
    max_persons: int
    sessions: List[str]
    available_days: Optional[List[int]] = None

@router.put("/services/{service_id}")
async def update_service(
    service_id: str, 
    update: UpdateServiceRequest, 
    db: Connection = Depends(get_db), 
    admin_id: str = Depends(require_permission('manage_services'))
):
    old_record = await db.fetchrow("SELECT price_rupees, slot_capacity, advance_days, max_persons, sessions::text, available_days::text FROM services WHERE id = $1", service_id)
    old_dict = dict(old_record) if old_record else {}
    if "sessions" in old_dict and old_dict["sessions"]:
        old_dict["sessions"] = json.loads(old_dict["sessions"])
    if "available_days" in old_dict and old_dict["available_days"]:
        old_dict["available_days"] = json.loads(old_dict["available_days"])

    await db.execute(
        "UPDATE services SET price_rupees = $1, slot_capacity = $2, advance_days = $3, max_persons = $4, sessions = $5::jsonb, available_days = COALESCE($6::jsonb, available_days) WHERE id = $7",
        update.price_rupees, update.slot_capacity, update.advance_days, update.max_persons,
        json.dumps(update.sessions),
        json.dumps(update.available_days) if update.available_days is not None else None, 
        service_id
    )
    diff = compute_diff(old_dict, update.model_dump(mode="json"))
    if diff:
        await log_audit(db, admin_id, "UPDATE_SERVICE", "service", service_id, diff)
    return {"status": "success"}

# --- USERS MANAGEMENT ---

@router.get("/users")
async def get_users(db: Connection = Depends(get_db), admin_id: str = Depends(require_permission('manage_users'))):
    records = await db.fetch("SELECT id, full_name, email, phone, role, created_at FROM users ORDER BY created_at DESC")
    return [dict(r) for r in records]

class UpdateRoleRequest(BaseModel):
    role: str

@router.put("/users/{user_id}/role")
async def update_user_role(
    user_id: str, 
    update: UpdateRoleRequest, 
    db: Connection = Depends(get_db), 
    admin_id: str = Depends(require_permission('manage_users'))
):
    role_exists = await db.fetchval("SELECT name FROM roles WHERE name = $1", update.role)
    if not role_exists:
        raise HTTPException(400, "Invalid role")
        
    await db.execute("UPDATE users SET role = $1 WHERE id = $2", update.role, user_id)
    return {"status": "success"}

# --- ROLES MANAGEMENT ---
@router.get("/roles")
async def get_roles(db: Connection = Depends(get_db), admin_id: str = Depends(require_permission('manage_roles'))):
    records = await db.fetch("SELECT name, permissions FROM roles")
    import json
    return [{"name": r['name'], "permissions": json.loads(r['permissions']) if isinstance(r['permissions'], str) else r['permissions']} for r in records]

class RoleCreateUpdate(BaseModel):
    name: str
    permissions: dict

@router.post("/roles")
async def create_role(req: RoleCreateUpdate, db: Connection = Depends(get_db), admin_id: str = Depends(require_permission('manage_roles'))):
    import json
    try:
        await db.execute("INSERT INTO roles (name, permissions) VALUES ($1, $2)", req.name, json.dumps(req.permissions))
    except Exception:
        raise HTTPException(status_code=400, detail="Role already exists")
    await log_audit(db, admin_id, "CREATE_ROLE", "role", req.name, req.model_dump(mode="json"))
    return {"status": "success"}

@router.put("/roles/{role_name}")
async def update_role(role_name: str, req: RoleCreateUpdate, db: Connection = Depends(get_db), admin_id: str = Depends(require_permission('manage_roles'))):
    import json
    old = await db.fetchval("SELECT permissions FROM roles WHERE name = $1", role_name)
    old_perms = json.loads(old) if old and isinstance(old, str) else (old if old else {})
    
    await db.execute("UPDATE roles SET permissions = $1 WHERE name = $2", json.dumps(req.permissions), role_name)
    
    diff = compute_diff({"permissions": old_perms}, {"permissions": req.permissions})
    if diff:
        await log_audit(db, admin_id, "UPDATE_ROLE", "role", role_name, diff)
    return {"status": "success"}

# --- NOTICES MANAGEMENT ---

@router.get("/notices")
async def get_notices(db: Connection = Depends(get_db)):
    records = await db.fetch("SELECT * FROM notices ORDER BY created_at DESC")
    return [dict(r) for r in records]

class CreateNoticeRequest(BaseModel):
    title: str
    body: str
    type: str  # banner, popup, dashboard
    is_active: bool

@router.post("/notices")
async def create_notice(req: CreateNoticeRequest, db: Connection = Depends(get_db), admin_id: str = Depends(require_permission('manage_notices'))):
    n_id = await db.fetchval(
        "INSERT INTO notices (title, body, type, is_active) VALUES ($1, $2, $3, $4) RETURNING id",
        req.title, req.body, req.type, req.is_active
    )
    await log_audit(db, admin_id, "CREATE_NOTICE", "notice", str(n_id), req.model_dump(mode="json"))
    return {"status": "success"}

@router.put("/notices/{notice_id}")
async def update_notice(notice_id: str, req: CreateNoticeRequest, db: Connection = Depends(get_db), admin_id: str = Depends(require_permission('manage_notices'))):
    old_record = await db.fetchrow("SELECT title, body, type, is_active FROM notices WHERE id = $1", notice_id)
    old_dict = dict(old_record) if old_record else {}
    
    await db.execute(
        "UPDATE notices SET title = $1, body = $2, type = $3, is_active = $4 WHERE id = $5",
        req.title, req.body, req.type, req.is_active, notice_id
    )
    
    diff = compute_diff(old_dict, req.model_dump(mode="json"))
    if diff:
        await log_audit(db, admin_id, "UPDATE_NOTICE", "notice", notice_id, diff)
    return {"status": "success"}

@router.delete("/notices/{notice_id}")
async def delete_notice(notice_id: str, db: Connection = Depends(get_db), admin_id: str = Depends(require_permission('manage_notices'))):
    await db.execute("DELETE FROM notices WHERE id = $1", notice_id)
    await log_audit(db, admin_id, "DELETE_NOTICE", "notice", notice_id)
    return {"status": "success"}

# --- DASHBOARD & ANALYTICS ---

@router.get("/dashboard")
async def get_dashboard_metrics(
    start_date: Optional[str] = None, 
    end_date: Optional[str] = None, 
    db: Connection = Depends(get_db), 
    admin_id: str = Depends(get_current_admin)
):
    date_filter = ""
    args = []
    if start_date and end_date:
        ist = pytz.timezone('Asia/Kolkata')
        dt_start = ist.localize(datetime.strptime(start_date, "%Y-%m-%d")).replace(hour=0, minute=0, second=0)
        dt_end = ist.localize(datetime.strptime(end_date, "%Y-%m-%d")).replace(hour=23, minute=59, second=59)
        date_filter = "WHERE created_at >= $1 AND created_at <= $2"
        args = [dt_start, dt_end]

    # Bookings metrics
    bookings_stats = await db.fetchrow(f"""
        SELECT 
            COUNT(id) as total_bookings,
            COALESCE(SUM(CASE WHEN status = 'confirmed' THEN amount_rupees ELSE 0 END), 0) as total_revenue,
            COUNT(CASE WHEN status = 'pending_approval' THEN 1 END) as pending_approvals
        FROM bookings
        {date_filter}
    """, *args)

    # Donations metrics
    donations_stats = await db.fetchrow(f"""
        SELECT 
            COUNT(id) as donations_count,
            COALESCE(SUM(CASE WHEN status = 'success' THEN amount_rupees ELSE 0 END), 0) as total_donations
        FROM e_undiyal_transactions
        {date_filter.replace('created_at', 'created_at')}
    """, *args)

    # Occupancy rate (mock for now)
    occupancy_rate = "85%"

    # Recent bookings
    recent_bookings = await db.fetch(f"""
        SELECT b.id, b.date, b.session, b.status, s.name as service_name, u.full_name as user_name
        FROM bookings b
        JOIN services s ON b.service_id = s.id
        JOIN users u ON b.user_id = u.id
        {date_filter.replace('created_at', 'b.created_at')}
        ORDER BY b.created_at DESC
        LIMIT 5
    """, *args)

    # Recent donations
    recent_donations = await db.fetch(f"""
        SELECT d.id, d.amount_rupees, d.reference, u.full_name as user_name, d.created_at
        FROM e_undiyal_transactions d
        JOIN users u ON d.user_id = u.id
        {date_filter.replace('created_at', 'd.created_at')}
        ORDER BY d.created_at DESC
        LIMIT 5
    """, *args)

    return {
        "revenue": bookings_stats['total_revenue'],
        "bookings": bookings_stats['total_bookings'],
        "pending_approvals": bookings_stats['pending_approvals'],
        "occupancy_rate": occupancy_rate,
        "donations_count": donations_stats['donations_count'],
        "total_donations": donations_stats['total_donations'],
        "recent_bookings": [dict(r) for r in recent_bookings],
        "recent_donations": [{**dict(r), "created_at": r["created_at"].isoformat()} for r in recent_donations]
    }

# --- DONATIONS ---

@router.get("/donations")
async def get_donations(
    start_date: Optional[str] = None, 
    end_date: Optional[str] = None, 
    phone: Optional[str] = None,
    status: Optional[str] = None,
    db: Connection = Depends(get_db), 
    admin_id: str = Depends(require_permission('view_reports'))
):
    query = """
        SELECT d.id, d.reference, d.amount_rupees, d.status, d.created_at, d.notes,
               u.full_name as user_name, u.email as user_email, u.phone as user_phone
        FROM e_undiyal_transactions d
        JOIN users u ON d.user_id = u.id
        WHERE 1=1
    """
    args = []
    idx = 1
    
    if start_date and end_date:
        ist = pytz.timezone('Asia/Kolkata')
        dt_start = ist.localize(datetime.strptime(start_date, "%Y-%m-%d")).replace(hour=0, minute=0, second=0)
        dt_end = ist.localize(datetime.strptime(end_date, "%Y-%m-%d")).replace(hour=23, minute=59, second=59)
        query += f" AND d.created_at >= ${idx} AND d.created_at <= ${idx+1}"
        args.extend([dt_start, dt_end])
        idx += 2
        
    if phone:
        query += f" AND u.phone ILIKE ${idx}"
        args.append(f"%{phone}%")
        idx += 1
        
    if status:
        query += f" AND d.status = ${idx}"
        args.append(status)
        idx += 1
        
    query += " ORDER BY d.created_at DESC"
    
    records = await db.fetch(query, *args)
    return [{**dict(r), "created_at": r["created_at"].isoformat()} for r in records]

class DonationStatusUpdate(BaseModel):
    status: str

@router.put("/donations/{donation_id}/status")
async def update_donation_status(
    donation_id: str, 
    update: DonationStatusUpdate, 
    db: Connection = Depends(get_db), 
    admin_id: str = Depends(require_permission('view_reports'))
):
    if update.status not in ['success', 'cancelled', 'failed']:
        raise HTTPException(400, "Invalid status.")

    async with db.transaction():
        donation = await db.fetchrow("SELECT id, status FROM e_undiyal_transactions WHERE id = $1 FOR UPDATE", donation_id)
        if not donation:
            raise HTTPException(404, "Donation not found")

        await db.execute("UPDATE e_undiyal_transactions SET status = $1 WHERE id = $2", update.status, donation_id)

    return {"status": "success", "new_status": update.status}

# --- AUDIT LOGS ---
@router.get("/audit-logs")
async def get_audit_logs(db: Connection = Depends(get_db), admin_id: str = Depends(require_permission('manage_roles'))):
    logs = await db.fetch("""
        SELECT * FROM audit_logs 
        ORDER BY created_at DESC 
        LIMIT 500
    """)
    # Convert dates to ISO format
    result = []
    for l in logs:
        d = dict(l)
        if d.get('created_at'):
            d['created_at'] = d['created_at'].isoformat()
        if d.get('id'):
            d['id'] = str(d['id'])
        if d.get('user_id'):
            d['user_id'] = str(d['user_id'])
        if d.get('details') and isinstance(d['details'], str):
            try:
                d['details'] = json.loads(d['details'])
            except:
                pass
        result.append(d)
    return result

class ClientActionLog(BaseModel):
    action_type: str
    entity_type: str
    entity_id: Optional[str] = None
    details: Optional[dict] = None

@router.post("/audit-logs/client-action")
async def log_client_action(req: ClientActionLog, db: Connection = Depends(get_db), admin_id: str = Depends(get_current_admin)):
    await log_audit(db, admin_id, req.action_type, req.entity_type, req.entity_id, req.details)
    return {"status": "success"}

# --- TAX EXEMPTIONS ---

@router.get("/tax-exemptions")
async def get_tax_exemptions(db: Connection = Depends(get_db), admin_id: str = Depends(require_permission('manage_exemptions'))):
    records = await db.fetch("""
        SELECT t.*, 
               u.full_name as user_name, u.email as user_email, u.phone as user_phone,
               b.reference as booking_reference,
               d.reference as donation_reference,
               t.created_at::text, t.updated_at::text
        FROM tax_exemptions t
        JOIN users u ON t.user_id = u.id
        LEFT JOIN bookings b ON t.booking_id = b.id
        LEFT JOIN e_undiyal_transactions d ON t.ehundi_id = d.id
        ORDER BY t.created_at DESC
    """)
    return [dict(r) for r in records]

class ExemptionStatusUpdate(BaseModel):
    status: str

@router.put("/tax-exemptions/{exemption_id}/status")
async def update_exemption_status(
    exemption_id: str, 
    update: ExemptionStatusUpdate, 
    db: Connection = Depends(get_db), 
    admin_id: str = Depends(require_permission('manage_exemptions'))
):
    if update.status not in ['pending', 'approved', 'rejected']:
        raise HTTPException(400, "Invalid status.")
        
    old_status = await db.fetchval("SELECT status FROM tax_exemptions WHERE id = $1", exemption_id)
    await db.execute("UPDATE tax_exemptions SET status = $1, handled_by = $2, updated_at = NOW() WHERE id = $3", update.status, admin_id, exemption_id)
    
    await log_audit(db, admin_id, "UPDATE_EXEMPTION_STATUS", "tax_exemption", exemption_id, {"status": {"old": old_status, "new": update.status}})
    return {"status": "success"}

# --- REPORTS ---

@router.get("/reports/metrics")
async def get_report_metrics(
    start_date: Optional[str] = None, 
    end_date: Optional[str] = None, 
    db: Connection = Depends(get_db), 
    admin_id: str = Depends(require_permission('view_reports'))
):
    date_filter_e = ""
    date_filter_b = ""
    args_e = []
    args_b = []
    
    if start_date:
        date_filter_e += f" AND created_at >= ${len(args_e) + 1}"
        date_filter_b += f" AND created_at >= ${len(args_b) + 1}"
        args_e.append(start_date)
        args_b.append(start_date)
    if end_date:
        # Include the entire end_date day
        end_date_time = end_date + " 23:59:59"
        date_filter_e += f" AND created_at <= ${len(args_e) + 1}"
        date_filter_b += f" AND created_at <= ${len(args_b) + 1}"
        args_e.append(end_date_time)
        args_b.append(end_date_time)

    # Donations
    total_donations = await db.fetchval(f"SELECT COALESCE(SUM(amount_rupees), 0) FROM e_undiyal_transactions WHERE status = 'success'{date_filter_e}", *args_e)
    donors_count = await db.fetchval(f"SELECT COUNT(DISTINCT user_id) FROM e_undiyal_transactions WHERE status = 'success'{date_filter_e}", *args_e)
    total_donations_count = await db.fetchval(f"SELECT COUNT(*) FROM e_undiyal_transactions WHERE status = 'success'{date_filter_e}", *args_e)

    # Bookings
    total_bookings = await db.fetchval(f"SELECT COALESCE(SUM(amount_rupees), 0) FROM bookings WHERE status = 'confirmed'{date_filter_b}", *args_b)
    bookings_count = await db.fetchval(f"SELECT COUNT(*) FROM bookings WHERE status = 'confirmed'{date_filter_b}", *args_b)
    cancelled_bookings_count = await db.fetchval(f"SELECT COUNT(*) FROM bookings WHERE status = 'cancelled'{date_filter_b}", *args_b)
    
    # Today's Revenue (independent of filters, for the "Today's Revenue" card if needed)
    today = datetime.now().date()
    today_donations = await db.fetchval("SELECT COALESCE(SUM(amount_rupees), 0) FROM e_undiyal_transactions WHERE status = 'success' AND created_at >= $1", today)
    today_bookings = await db.fetchval("SELECT COALESCE(SUM(amount_rupees), 0) FROM bookings WHERE status = 'confirmed' AND created_at >= $1", today)

    return {
        "total_revenue": total_donations + total_bookings,
        "donations_revenue": total_donations,
        "bookings_revenue": total_bookings,
        "donors_count": donors_count,
        "total_donations_count": total_donations_count,
        "bookings_count": bookings_count,
        "cancelled_bookings_count": cancelled_bookings_count,
        "today_revenue": today_donations + today_bookings
    }

@router.get("/reports/export")
async def export_reports(
    type: str = "bookings", 
    start_date: Optional[str] = None, 
    end_date: Optional[str] = None, 
    db: Connection = Depends(get_db), 
    admin_id: str = Depends(require_permission('view_reports'))
):
    date_filter = ""
    args = []
    
    if start_date:
        date_filter += f" AND t.created_at >= ${len(args) + 1}"
        args.append(start_date)
    if end_date:
        end_date_time = end_date + " 23:59:59"
        date_filter += f" AND t.created_at <= ${len(args) + 1}"
        args.append(end_date_time)

    if type == "bookings":
        query = f"""
            SELECT t.reference, t.date::text, s.name as service, t.amount_rupees, t.status, u.full_name as user_name, u.phone as user_phone
            FROM bookings t
            JOIN services s ON t.service_id = s.id
            JOIN users u ON t.user_id = u.id
            WHERE 1=1 {date_filter}
            ORDER BY t.created_at DESC
        """
    else:
        query = f"""
            SELECT t.reference, t.created_at::text as date, t.amount_rupees, t.status, u.full_name as user_name, u.phone as user_phone
            FROM e_undiyal_transactions t
            JOIN users u ON t.user_id = u.id
            WHERE 1=1 {date_filter}
            ORDER BY t.created_at DESC
        """
    
    records = await db.fetch(query, *args)
    return [dict(r) for r in records]

from fastapi.responses import FileResponse
from app.services.pdf_generator import generate_report_pdf
import os

@router.get("/reports/export/pdf")
async def export_reports_pdf(
    type: str = "bookings", 
    start_date: Optional[str] = None, 
    end_date: Optional[str] = None, 
    db: Connection = Depends(get_db), 
    admin_id: str = Depends(require_permission('view_reports'))
):
    date_filter = ""
    args = []
    
    if start_date:
        date_filter += f" AND t.created_at >= ${len(args) + 1}"
        args.append(start_date)
    if end_date:
        end_date_time = end_date + " 23:59:59"
        date_filter += f" AND t.created_at <= ${len(args) + 1}"
        args.append(end_date_time)

    if type == "bookings":
        query = f"""
            SELECT t.reference, t.date::text, s.name as service, t.amount_rupees, t.status, u.full_name as user_name, u.phone as user_phone
            FROM bookings t
            JOIN services s ON t.service_id = s.id
            JOIN users u ON t.user_id = u.id
            WHERE 1=1 {date_filter}
            ORDER BY t.created_at DESC
        """
        records = await db.fetch(query, *args)
        headers = ["Reference", "Date", "Service", "Amount", "Status", "User", "Phone"]
        rows = [[r['reference'], str(r['date']), r['service'], f"Rs {r['amount_rupees']}", r['status'], r['user_name'], r['user_phone']] for r in records]
        title = "Bookings Report"
    else:
        query = f"""
            SELECT t.reference, t.created_at::text as date, t.amount_rupees, t.status, u.full_name as user_name, u.phone as user_phone
            FROM e_undiyal_transactions t
            JOIN users u ON t.user_id = u.id
            WHERE 1=1 {date_filter}
            ORDER BY t.created_at DESC
        """
        records = await db.fetch(query, *args)
        headers = ["Reference", "Date", "Amount", "Status", "User", "Phone"]
        rows = [[r['reference'], str(r['date']).split()[0], f"Rs {r['amount_rupees']}", r['status'], r['user_name'], r['user_phone']] for r in records]
        title = "Donations Report"
    
    if start_date and end_date:
        title += f" ({start_date} to {end_date})"
    elif start_date:
        title += f" (From {start_date})"
        
    filepath = generate_report_pdf(title, headers, rows)
    return FileResponse(filepath, filename=os.path.basename(filepath), media_type="application/pdf")

from typing import Optional, Any

class SettingsUpdate(BaseModel):
    key: str
    value: Any

@router.put("/settings")
async def update_settings(update: SettingsUpdate, db: Connection = Depends(get_db), admin_id: str = Depends(require_permission('manage_roles'))):
    old_val = await db.fetchval("SELECT value FROM system_settings WHERE key = $1", update.key)
    # Using JSONB serialization
    import json
    await db.execute("UPDATE system_settings SET value = $1::jsonb, updated_at = NOW() WHERE key = $2", json.dumps(update.value), update.key)
    await log_audit(db, admin_id, "UPDATE_SETTING", "system_settings", update.key, {"value": {"old": json.loads(old_val) if type(old_val)==str else old_val, "new": update.value}})
    return {"status": "success"}
