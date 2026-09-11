import json
from asyncpg import Connection

def compute_diff(old_record: dict, new_data: dict) -> dict:
    """Computes a clean diff showing only what changed."""
    if not old_record:
        return new_data
    
    diff = {}
    for k, v in new_data.items():
        if k in old_record:
            old_v = old_record[k]
            # Handle type differences gracefully if needed (e.g. Decimal to float)
            if str(old_v) != str(v) and old_v != v:
                diff[k] = {"old": old_v, "new": v}
        else:
            diff[k] = {"old": None, "new": v}
    return diff

async def log_audit(
    db: Connection,
    user_id: str,
    action_type: str,
    entity_type: str,
    entity_id: str = None,
    details: dict = None
):
    try:
        # Fetch user name and role
        user_row = await db.fetchrow("SELECT full_name, role FROM users WHERE id = $1", user_id)
        user_name = user_row['full_name'] if user_row else 'Unknown User'
        user_role = user_row['role'] if user_row else 'unknown'

        await db.execute(
            """
            INSERT INTO audit_logs (user_id, user_name, user_role, action_type, entity_type, entity_id, details)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            """,
            user_id,
            user_name,
            user_role,
            action_type,
            entity_type,
            str(entity_id) if entity_id else None,
            json.dumps(details) if details else '{}'
        )
    except Exception as e:
        print(f"Failed to log audit event: {e}")
