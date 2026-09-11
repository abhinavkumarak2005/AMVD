import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.getenv("DATABASE_URL")

with open("../supabase/migrations/005_audit_logs.sql", "r") as f:
    sql = f.read()

async def run():
    conn = await asyncpg.connect(db_url, statement_cache_size=0)
    try:
        await conn.execute(sql)
        print("Audit logs migration applied successfully.")
    finally:
        await conn.close()

asyncio.run(run())
