from fastapi import APIRouter, Depends
from asyncpg import Connection
from app.core.database import get_db

router = APIRouter()

@router.get("")
async def get_all_settings(db: Connection = Depends(get_db)):
    records = await db.fetch("SELECT key, value FROM system_settings")
    settings = {}
    for r in records:
        settings[r['key']] = r['value']
    return settings
