import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.getenv("DATABASE_URL")

async def run():
    conn = await asyncpg.connect(db_url, statement_cache_size=0)
    try:
        await conn.execute("DELETE FROM audit_logs WHERE action_type = 'TEST_ACTION'")
        print("Test log deleted.")
    finally:
        await conn.close()

asyncio.run(run())
