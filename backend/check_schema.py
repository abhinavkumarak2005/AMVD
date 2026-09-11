import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.getenv("DATABASE_URL")

async def run():
    conn = await asyncpg.connect(db_url, statement_cache_size=0)
    try:
        cols = await conn.fetch("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'audit_logs'")
        for col in cols:
            print(dict(col))
    finally:
        await conn.close()

asyncio.run(run())
