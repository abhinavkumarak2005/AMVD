from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from pydantic import BaseModel
from typing import List, Optional
from asyncpg import Connection
from app.core.database import get_db
from app.core.audit import log_audit, compute_diff
from app.core.auth import get_current_admin, get_current_super_admin, require_permission, get_user_permissions, get_current_user, supabase_admin
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
    status: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    phone: Optional[str] = None
):
    query = """
        SELECT b.id, b.date, b.session, b.status, b.reference, b.amount_rupees,
               b.created_at::text, 
               (SELECT razorpay_order_id FROM payments WHERE booking_id = b.id ORDER BY created_at DESC LIMIT 1) as razorpay_order_id,
               (SELECT razorpay_payment_id FROM payments WHERE booking_id = b.id ORDER BY created_at DESC LIMIT 1) as razorpay_payment_id,
               s.name as service_name,
               u.full_name as user_name, u.email as user_email, u.phone as user_phone
        FROM bookings b
        JOIN services s ON b.service_id = s.id
        JOIN users u ON b.user_id = u.id
        WHERE 1=1
    """
    args = []
    idx = 1
    
    if start_date and end_date:
        ist = pytz.timezone('Asia/Kolkata')
        dt_start = ist.localize(datetime.strptime(start_date, "%Y-%m-%d")).replace(hour=0, minute=0, second=0)
        dt_end = ist.localize(datetime.strptime(end_date, "%Y-%m-%d")).replace(hour=23, minute=59, second=59)
        query += f" AND b.created_at >= ${idx} AND b.created_at <= ${idx+1}"
        args.extend([dt_start, dt_end])
        idx += 2
        
    if phone:
        query += f" AND u.phone ILIKE ${idx}"
        args.append(f"%{phone}%")
        idx += 1
        
    if status:
        query += f" AND b.status = ${idx}"
        args.append(status)
        idx += 1
        
    query += " ORDER BY b.created_at DESC"
    
    # Auto-cancel old pending bookings
    await db.execute("UPDATE bookings SET status = 'cancelled' WHERE status = 'pending_payment' AND created_at < NOW() - INTERVAL '15 minutes'")
    
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
                <h1>Arulmigu Manakula Vinayagar Devasthanam</h1>
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
    records = await db.fetch("SELECT id, name, category, price_rupees, slot_capacity, advance_days, max_persons, sessions::text, available_days::text FROM services WHERE is_active = true ORDER BY name")
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

class CreateServiceRequest(BaseModel):
    name: str
    category: str
    price_rupees: int
    slot_capacity: int
    advance_days: int
    max_persons: int
    sessions: List[str]
    available_days: List[int]

@router.post("/services")
async def create_service(
    req: CreateServiceRequest, 
    db: Connection = Depends(get_db), 
    admin_id: str = Depends(require_permission('manage_services'))
):
    service_id = await db.fetchval(
        """
        INSERT INTO services (name, category, session_type, price_rupees, slot_capacity, advance_days, max_persons, sessions, available_days)
        VALUES ($1, $2, 'all_day', $3, $4, $5, $6, $7::jsonb, $8::jsonb)
        RETURNING id
        """,
        req.name, req.category, req.price_rupees, req.slot_capacity, req.advance_days, req.max_persons,
        json.dumps(req.sessions), json.dumps(req.available_days)
    )
    await log_audit(db, admin_id, "CREATE_SERVICE", "service", str(service_id), req.model_dump(mode="json"))
    return {"status": "success", "id": service_id}

@router.delete("/services/{service_id}")
async def delete_service(
    service_id: str, 
    db: Connection = Depends(get_db), 
    admin_id: str = Depends(require_permission('manage_services'))
):
    await db.execute("UPDATE services SET is_active = false WHERE id = $1", service_id)
    await log_audit(db, admin_id, "DELETE_SERVICE", "service", service_id, {})
    return {"status": "success"}

# --- USERS MANAGEMENT ---

@router.get("/users")
async def get_users(db: Connection = Depends(get_db), admin_id: str = Depends(require_permission('manage_users'))):
    records = await db.fetch("""
        SELECT u.id, u.full_name, u.email, u.phone, u.role, u.is_active, u.created_at,
               (a.email_confirmed_at IS NOT NULL) AS is_verified
        FROM public.users u
        LEFT JOIN auth.users a ON u.id = a.id
        ORDER BY u.created_at DESC
    """)
    return [dict(r) for r in records]

@router.get("/users/check-email")
async def check_email_availability(email: str, db: Connection = Depends(get_db)):
    exists = await db.fetchval("SELECT 1 FROM users WHERE LOWER(email) = LOWER($1)", email.strip())
    return {"available": not bool(exists), "exists": bool(exists)}

class CreateUserRequest(BaseModel):
    full_name: str
    email: str
    phone: Optional[str] = None
    role: str
    password: str

@router.post("/users")
async def create_user(
    req: CreateUserRequest,
    db: Connection = Depends(get_db),
    admin_id: str = Depends(require_permission('manage_users'))
):
    role_exists = await db.fetchval("SELECT name FROM roles WHERE name = $1", req.role)
    if not role_exists:
        raise HTTPException(400, "Invalid role selected")

    existing = await db.fetchval("SELECT id FROM users WHERE email = $1", req.email)
    if existing:
        raise HTTPException(400, "User with this email already exists")

    try:
        res = supabase_admin.auth.admin.create_user({
            "email": req.email,
            "password": req.password,
            "email_confirm": True,
            "user_metadata": {"full_name": req.full_name, "phone": req.phone or ""},
            "phone": req.phone if req.phone else None
        })
        if not res or not res.user:
            raise HTTPException(400, "Failed to create user in auth system")
        
        user_id = res.user.id
        await db.execute(
            """
            INSERT INTO users (id, full_name, email, phone, role, is_active)
            VALUES ($1, $2, $3, $4, $5, true)
            ON CONFLICT (id) DO UPDATE SET role = $5, full_name = $2, phone = $4, is_active = true
            """,
            user_id, req.full_name, req.email, req.phone, req.role
        )
        await log_audit(db, admin_id, "CREATE_USER", "user", str(user_id), {"email": req.email, "role": req.role, "full_name": req.full_name})
        return {"status": "success", "user_id": str(user_id)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, detail=str(e))

class UpdateUserStatusRequest(BaseModel):
    is_active: bool

@router.put("/users/{user_id}/status")
async def update_user_status(
    user_id: str,
    req: UpdateUserStatusRequest,
    db: Connection = Depends(get_db),
    admin_id: str = Depends(require_permission('manage_users'))
):
    user = await db.fetchrow("SELECT id, role, is_active FROM users WHERE id = $1", user_id)
    if not user:
        raise HTTPException(404, "User not found")
        
    if str(user['id']) == str(admin_id) and not req.is_active:
        raise HTTPException(400, "You cannot disable your own account")
        
    if user['role'] == 'super_admin' and not req.is_active:
        raise HTTPException(400, "Cannot disable super admin account")

    await db.execute("UPDATE users SET is_active = $1 WHERE id = $2", req.is_active, user_id)
    
    try:
        ban_duration = "876000h" if not req.is_active else "0s"
        supabase_admin.auth.admin.update_user_by_id(user_id, {"ban_duration": ban_duration})
    except Exception:
        pass

    await log_audit(db, admin_id, "UPDATE_USER_STATUS", "user", user_id, {"is_active": req.is_active})
    return {"status": "success"}

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

@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    db: Connection = Depends(get_db),
    admin_id: str = Depends(require_permission('manage_users'))
):
    user = await db.fetchrow("SELECT id, role, email FROM users WHERE id = $1", user_id)
    if not user:
        raise HTTPException(404, "User not found")
        
    if user['role'] != 'devotee':
        raise HTTPException(400, "Only devotee accounts can be deleted. For staff/admin, disable their account or change their role.")
        
    booking_count = await db.fetchval("SELECT COUNT(*) FROM bookings WHERE user_id = $1", user_id)
    donation_count = await db.fetchval("SELECT COUNT(*) FROM e_undiyal_transactions WHERE user_id = $1", user_id)
    
    if booking_count > 0 or donation_count > 0:
        await db.execute("""
            UPDATE users 
            SET is_active = false,
                full_name = 'Deleted Devotee',
                email = 'deleted_' || id || '@deleted.local',
                phone = NULL
            WHERE id = $1
        """, user_id)
        try:
            supabase_admin.auth.admin.delete_user(user_id)
        except Exception:
            pass
    else:
        try:
            supabase_admin.auth.admin.delete_user(user_id)
        except Exception:
            pass
        await db.execute("DELETE FROM users WHERE id = $1", user_id)
        
    await log_audit(db, admin_id, "DELETE_DEVOTEE", "user", user_id, {"email": user['email']})
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
    formatted = req.name.strip().lower().replace(" ", "_")
    try:
        await db.execute("INSERT INTO roles (name, permissions) VALUES ($1, $2)", formatted, json.dumps(req.permissions))
    except Exception:
        raise HTTPException(status_code=400, detail="Role already exists")
    await log_audit(db, admin_id, "CREATE_ROLE", "role", formatted, req.model_dump(mode="json"))
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

class RenameRoleRequest(BaseModel):
    new_name: str

@router.put("/roles/{role_name}/rename")
async def rename_role(
    role_name: str,
    req: RenameRoleRequest,
    db: Connection = Depends(get_db),
    admin_id: str = Depends(require_permission('manage_roles'))
):
    protected = ['super_admin', 'admin', 'devotee', 'staff']
    if role_name in protected:
        raise HTTPException(400, f"Cannot rename protected system role '{role_name}'")
        
    new_formatted = req.new_name.strip().lower().replace(" ", "_")
    if not new_formatted:
        raise HTTPException(400, "Role name cannot be empty")
        
    if new_formatted in protected:
        raise HTTPException(400, "Cannot rename to a protected system role name")
        
    exists = await db.fetchval("SELECT name FROM roles WHERE name = $1", new_formatted)
    if exists:
        raise HTTPException(400, f"Role '{new_formatted}' already exists")
        
    async with db.transaction():
        perms = await db.fetchval("SELECT permissions FROM roles WHERE name = $1", role_name)
        if not perms:
            raise HTTPException(404, "Role not found")
            
        await db.execute("INSERT INTO roles (name, permissions) VALUES ($1, $2)", new_formatted, perms)
        await db.execute("UPDATE users SET role = $1 WHERE role = $2", new_formatted, role_name)
        await db.execute("DELETE FROM roles WHERE name = $1", role_name)
        
    await log_audit(db, admin_id, "RENAME_ROLE", "role", role_name, {"old_name": role_name, "new_name": new_formatted})
    return {"status": "success", "name": new_formatted}

@router.delete("/roles/{role_name}")
async def delete_role(
    role_name: str,
    db: Connection = Depends(get_db),
    admin_id: str = Depends(require_permission('manage_roles'))
):
    protected = ['super_admin', 'admin', 'devotee', 'staff']
    if role_name in protected:
        raise HTTPException(400, f"Cannot delete protected system role '{role_name}'")
        
    count = await db.fetchval("SELECT COUNT(*) FROM users WHERE role = $1", role_name)
    if count > 0:
        raise HTTPException(400, f"Cannot delete role '{role_name}' because {count} user(s) currently have this role. Please reassign them first.")
        
    await db.execute("DELETE FROM roles WHERE name = $1", role_name)
    await log_audit(db, admin_id, "DELETE_ROLE", "role", role_name, {})
    return {"status": "success"}

# --- SERVICE SUB MENU (CATEGORIES) MANAGEMENT ---
class ServiceCategoryCreateUpdate(BaseModel):
    name: str
    description: Optional[str] = None
    sort_order: Optional[int] = 0

@router.get("/service-categories")
async def get_service_categories(db: Connection = Depends(get_db)):
    rows = await db.fetch("SELECT * FROM service_categories ORDER BY sort_order ASC, name ASC")
    return [dict(r) for r in rows]

@router.post("/service-categories")
async def create_service_category(
    req: ServiceCategoryCreateUpdate,
    db: Connection = Depends(get_db),
    admin_id: str = Depends(require_permission('manage_services'))
):
    slug = req.name.strip().lower().replace(" ", "_")
    try:
        cat_id = await db.fetchval("""
            INSERT INTO service_categories (name, slug, description, sort_order)
            VALUES ($1, $2, $3, $4)
            RETURNING id
        """, req.name.strip(), slug, req.description, req.sort_order or 0)
    except Exception:
        raise HTTPException(400, "Category already exists")
        
    await log_audit(db, admin_id, "CREATE_CATEGORY", "service_category", str(cat_id), req.model_dump())
    return {"status": "success", "id": str(cat_id)}

@router.put("/service-categories/{category_id}")
async def update_service_category(
    category_id: str,
    req: ServiceCategoryCreateUpdate,
    db: Connection = Depends(get_db),
    admin_id: str = Depends(require_permission('manage_services'))
):
    slug = req.name.strip().lower().replace(" ", "_")
    old_name = await db.fetchval("SELECT name FROM service_categories WHERE id = $1", category_id)
    if not old_name:
        raise HTTPException(404, "Category not found")
        
    await db.execute("""
        UPDATE service_categories 
        SET name = $1, slug = $2, description = $3, sort_order = $4
        WHERE id = $5
    """, req.name.strip(), slug, req.description, req.sort_order or 0, category_id)
    
    if old_name != req.name.strip():
        await db.execute("UPDATE services SET category = $1 WHERE category = $2", req.name.strip(), old_name)
        
    await log_audit(db, admin_id, "UPDATE_CATEGORY", "service_category", category_id, req.model_dump())
    return {"status": "success"}

@router.delete("/service-categories/{category_id}")
async def delete_service_category(
    category_id: str,
    db: Connection = Depends(get_db),
    admin_id: str = Depends(require_permission('manage_services'))
):
    cat = await db.fetchrow("SELECT name FROM service_categories WHERE id = $1", category_id)
    if not cat:
        raise HTTPException(404, "Category not found")
        
    count = await db.fetchval("SELECT COUNT(*) FROM services WHERE category ILIKE $1", cat['name'])
    if count > 0:
        raise HTTPException(400, f"Cannot delete category '{cat['name']}' because {count} service(s) belong to it. Reassign or update those services first.")
        
    await db.execute("DELETE FROM service_categories WHERE id = $1", category_id)
    await log_audit(db, admin_id, "DELETE_CATEGORY", "service_category", category_id, {})
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
            COALESCE(SUM(CASE WHEN status = 'confirmed' THEN amount_rupees ELSE 0 END), 0) as total_revenue
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
        SELECT d.id, d.reference, d.amount_rupees, d.status, d.created_at::text, d.notes,
               d.razorpay_order_id, d.razorpay_payment_id,
               u.full_name as user_name, u.email as user_email, u.phone as user_phone
        FROM e_undiyal_transactions d
        JOIN users u ON d.user_id = u.id
        WHERE 1=1
    """
    args = []
    idx = 1
    
    # Auto-cancel old initiated donations
    await db.execute("UPDATE e_undiyal_transactions SET status = 'cancelled' WHERE status = 'initiated' AND created_at < NOW() - INTERVAL '15 minutes'")
    
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
    return [dict(r) for r in records]

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
async def get_audit_logs(
    db: Connection = Depends(get_db), 
    admin_id: str = Depends(require_permission('manage_roles')),
    page: int = 1,
    page_size: int = 20,
    search: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    category: Optional[str] = None
):
    query = "SELECT * FROM audit_logs WHERE 1=1"
    count_query = "SELECT COUNT(*) FROM audit_logs WHERE 1=1"
    args = []
    idx = 1
    
    if search:
        query += f" AND (user_name ILIKE ${idx} OR user_role ILIKE ${idx} OR action_type ILIKE ${idx} OR entity_type ILIKE ${idx} OR details::text ILIKE ${idx})"
        count_query += f" AND (user_name ILIKE ${idx} OR user_role ILIKE ${idx} OR action_type ILIKE ${idx} OR entity_type ILIKE ${idx} OR details::text ILIKE ${idx})"
        args.append(f"%{search}%")
        idx += 1
        
    if start_date:
        query += f" AND created_at >= ${idx}::timestamptz"
        count_query += f" AND created_at >= ${idx}::timestamptz"
        args.append(f"{start_date} 00:00:00+05:30")
        idx += 1
        
    if end_date:
        query += f" AND created_at <= ${idx}::timestamptz"
        count_query += f" AND created_at <= ${idx}::timestamptz"
        args.append(f"{end_date} 23:59:59+05:30")
        idx += 1
        
    if category == 'devotee':
        query += f" AND (user_role = 'devotee' OR action_type IN ('PAGE_VISIT', 'LOGIN', 'LOGOUT'))"
        count_query += f" AND (user_role = 'devotee' OR action_type IN ('PAGE_VISIT', 'LOGIN', 'LOGOUT'))"
    elif category == 'admin':
        query += f" AND (user_role != 'devotee' AND action_type NOT IN ('PAGE_VISIT', 'LOGIN', 'LOGOUT'))"
        count_query += f" AND (user_role != 'devotee' AND action_type NOT IN ('PAGE_VISIT', 'LOGIN', 'LOGOUT'))"
        
    total = await db.fetchval(count_query, *args)
    
    offset = (max(1, page) - 1) * page_size
    query += f" ORDER BY created_at DESC LIMIT ${idx} OFFSET ${idx+1}"
    args.extend([page_size, offset])
    
    logs = await db.fetch(query, *args)
    
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
        
    return {
        "total": total or 0,
        "page": page,
        "page_size": page_size,
        "logs": result
    }

class ActivityLogRequest(BaseModel):
    action_type: str  # 'PAGE_VISIT', 'LOGIN', 'LOGOUT'
    page_url: Optional[str] = None
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    user_role: Optional[str] = None
    details: Optional[dict] = None

@router.post("/audit-logs/activity")
async def record_activity(req: ActivityLogRequest, request: Request, db: Connection = Depends(get_db)):
    client_ip = request.client.host if request.client else None
    user_role = req.user_role or "devotee"
    user_name = req.user_name
    user_id = req.user_id
    
    if user_id:
        try:
            user_row = await db.fetchrow("SELECT full_name, role FROM users WHERE id = $1", user_id)
            if user_row:
                user_name = user_row['full_name'] or user_name
                user_role = user_row['role'] or user_role
        except Exception:
            pass

    details = req.details or {}
    if req.page_url:
        details['page'] = req.page_url
        
    await db.execute("""
        INSERT INTO audit_logs (user_id, user_name, user_role, action_type, entity_type, entity_id, details, ip_address)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    """, user_id, user_name or 'Devotee / Visitor', user_role, req.action_type, 'devotee_activity', req.page_url, json.dumps(details), client_ip)
    return {"status": "success"}

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
    message: Optional[str] = None

@router.put("/tax-exemptions/{exemption_id}/status")
async def update_exemption_status(
    exemption_id: str, 
    update: ExemptionStatusUpdate, 
    background_tasks: BackgroundTasks,
    db: Connection = Depends(get_db), 
    admin_id: str = Depends(require_permission('manage_exemptions'))
):
    if update.status not in ['pending', 'approved', 'rejected']:
        raise HTTPException(400, "Invalid status.")
        
    record = await db.fetchrow(
        "SELECT t.status, u.email as user_email, u.full_name as user_name FROM tax_exemptions t JOIN users u ON t.user_id = u.id WHERE t.id = $1", 
        exemption_id
    )
    if not record:
        raise HTTPException(404, "Request not found.")
        
    old_status = record["status"]
    await db.execute("UPDATE tax_exemptions SET status = $1, handled_by = $2, updated_at = NOW() WHERE id = $3", update.status, admin_id, exemption_id)
    
    if update.message and update.status in ['approved', 'rejected']:
        subject = f"Update on your 80G Tax Exemption Request: {update.status.title()}"
        body = f"<p>Dear {record['user_name']},</p><p>{update.message}</p>"
        background_tasks.add_task(send_email, record["user_email"], subject, body)
        
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
        ist = pytz.timezone('Asia/Kolkata')
        dt_start = ist.localize(datetime.strptime(start_date, "%Y-%m-%d")).replace(hour=0, minute=0, second=0)
        date_filter_e += f" AND created_at >= ${len(args_e) + 1}"
        date_filter_b += f" AND created_at >= ${len(args_b) + 1}"
        args_e.append(dt_start)
        args_b.append(dt_start)
    if end_date:
        ist = pytz.timezone('Asia/Kolkata')
        dt_end = ist.localize(datetime.strptime(end_date, "%Y-%m-%d")).replace(hour=23, minute=59, second=59)
        date_filter_e += f" AND created_at <= ${len(args_e) + 1}"
        date_filter_b += f" AND created_at <= ${len(args_b) + 1}"
        args_e.append(dt_end)
        args_b.append(dt_end)

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
