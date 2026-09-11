import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.getenv("DATABASE_URL")

async def run():
    conn = await asyncpg.connect(db_url, statement_cache_size=0)
    try:
        with open("../supabase/migrations/006_fix_audit_logs.sql", "r") as f:
            sql = f.read()
        await conn.execute(sql)
        print("Schema fixed successfully")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await conn.close()

asyncio.run(run())
