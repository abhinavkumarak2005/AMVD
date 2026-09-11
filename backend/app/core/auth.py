from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import settings
from app.core.database import get_db
from asyncpg import Connection
from supabase import create_client, Client

security = HTTPBearer()

supabase_client: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)):
    token = credentials.credentials
    try:
        user_response = supabase_client.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_response.user.id
    except Exception as e:
        print(f"Auth Error: {e}", flush=True)
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_user_permissions(user_id: str, db: Connection) -> dict:
    # Fetch the permissions JSON from the roles table via the users table
    record = await db.fetchrow(
        "SELECT r.permissions FROM roles r JOIN users u ON u.role = r.name WHERE u.id = $1", 
        user_id
    )
    if record and record['permissions']:
        import json
        if isinstance(record['permissions'], str):
            return json.loads(record['permissions'])
        return record['permissions']
    return {}

def require_permission(perm: str):
    async def permission_checker(user_id: str = Depends(get_current_user), db: Connection = Depends(get_db)):
        perms = await get_user_permissions(user_id, db)
        if not perms.get(perm) and not perms.get('all'):
            raise HTTPException(status_code=403, detail="Not authorized")
        return user_id
    return permission_checker

# For backwards compatibility during transition or specific endpoints
async def get_current_admin(user_id: str = Depends(require_permission('manage_services')), db: Connection = Depends(get_db)):
    return user_id

async def get_current_super_admin(user_id: str = Depends(require_permission('manage_roles')), db: Connection = Depends(get_db)):
    return user_id
