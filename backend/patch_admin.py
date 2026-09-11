import re

with open("app/api/admin.py", "r") as f:
    code = f.read()

# Add import
if "log_audit" not in code:
    code = code.replace("from app.core.database import get_db", "from app.core.database import get_db\nfrom app.core.audit import log_audit")

# Bookings status
code = re.sub(
    r'(background_tasks\.add_task\(send_cancellation_email.*?)(    return {"status": "success", "new_status": update\.status})',
    r'\1    await log_audit(db, admin_id, f"UPDATE_BOOKING_STATUS_{update.status.upper()}", "booking", booking_id, {"status": update.status, "reason": getattr(update, "reason", "")})\n\2',
    code,
    flags=re.DOTALL
)

# Calendar block
code = re.sub(
    r'(await db\.execute\(.*?calendar_dates.*?\)[\s\n]+)(    return {"status": "success", "date": req\.date})',
    r'\1    await log_audit(db, admin_id, "BLOCK_CALENDAR_DATE", "calendar", req.date, req.model_dump(mode="json"))\n\2',
    code,
    flags=re.DOTALL
)

# Calendar unblock
code = re.sub(
    r'(await db\.execute\("DELETE FROM calendar_dates WHERE date = \$1", parsed_date\)[\s\n]+)(    return {"status": "success", "date": date_str})',
    r'\1    await log_audit(db, admin_id, "UNBLOCK_CALENDAR_DATE", "calendar", date_str)\n\2',
    code,
    flags=re.DOTALL
)

# Services
code = re.sub(
    r'(await db\.execute\(.*?UPDATE services.*?\)[\s\n]+)(    return {"status": "success"})',
    r'\1    await log_audit(db, admin_id, "UPDATE_SERVICE", "service", service_id, update.model_dump(mode="json"))\n\2',
    code,
    flags=re.DOTALL
)

# Users update role
code = re.sub(
    r'(await db\.execute\("UPDATE users SET role = \$1 WHERE id = \$2", req\.role, user_id\)[\s\n]+)(    return {"status": "success", "user_id": user_id, "new_role": req\.role})',
    r'\1    await log_audit(db, admin_id, "UPDATE_USER_ROLE", "user", user_id, {"new_role": req.role})\n\2',
    code,
    flags=re.DOTALL
)

# Roles create
code = re.sub(
    r'(await db\.execute\("INSERT INTO roles.*?\)[\s\n]+)(    return {"status": "success"})',
    r'\1    await log_audit(db, admin_id, "CREATE_ROLE", "role", req.name, req.model_dump(mode="json"))\n\2',
    code,
    flags=re.DOTALL
)

# Roles update
code = re.sub(
    r'(await db\.execute\("UPDATE roles SET permissions = \$1 WHERE name = \$2", json\.dumps\(req\.permissions\), role_name\)[\s\n]+)(    return {"status": "success"})',
    r'\1    await log_audit(db, admin_id, "UPDATE_ROLE", "role", role_name, req.model_dump(mode="json"))\n\2',
    code,
    flags=re.DOTALL
)

# Notices create
code = re.sub(
    r'(n_id = await db\.fetchval\("INSERT INTO notices.*?\)[\s\n]+)(    return {"status": "success", "id": str\(n_id\)})',
    r'\1    await log_audit(db, admin_id, "CREATE_NOTICE", "notice", str(n_id), req.model_dump(mode="json"))\n\2',
    code,
    flags=re.DOTALL
)

# Notices update
code = re.sub(
    r'(await db\.execute\("UPDATE notices.*?\)[\s\n]+)(    return {"status": "success"})',
    r'\1    await log_audit(db, admin_id, "UPDATE_NOTICE", "notice", notice_id, req.model_dump(mode="json"))\n\2',
    code,
    flags=re.DOTALL
)

# Notices delete
code = re.sub(
    r'(await db\.execute\("DELETE FROM notices WHERE id = \$1", notice_uuid\)[\s\n]+)(    return {"status": "success"})',
    r'\1    await log_audit(db, admin_id, "DELETE_NOTICE", "notice", notice_id)\n\2',
    code,
    flags=re.DOTALL
)

# Donations status
code = re.sub(
    r'(await db\.execute\("UPDATE donations SET payment_status = \$1 WHERE id = \$2", update\.status, donation_uuid\)[\s\n]+)(    return {"status": "success", "new_status": update\.status})',
    r'\1    await log_audit(db, admin_id, f"UPDATE_DONATION_STATUS_{update.status.upper()}", "donation", donation_id, {"status": update.status})\n\2',
    code,
    flags=re.DOTALL
)

with open("app/api/admin.py", "w") as f:
    f.write(code)

print("Patched admin.py successfully.")
