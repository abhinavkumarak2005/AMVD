import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.getenv("DATABASE_URL")

async def run():
    conn = await asyncpg.connect(db_url, statement_cache_size=0)
    try:
        res = await conn.fetch("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'users'
        """)
        print("Columns:", [dict(r) for r in res])
        
        constrs = await conn.fetch("""
        SELECT conname, pg_get_constraintdef(c.oid)
        FROM pg_constraint c
        JOIN pg_namespace n ON n.oid = c.connamespace
        WHERE conrelid = 'public.users'::regclass
        """)
        print("Constraints:", [dict(c) for c in constrs])
    finally:
        await conn.close()

asyncio.run(run())
