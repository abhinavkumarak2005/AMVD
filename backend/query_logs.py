import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.getenv("DATABASE_URL")

async def run():
    conn = await asyncpg.connect(db_url)
    try:
        logs = await conn.fetch("SELECT * FROM audit_logs")
        print(f"Found {len(logs)} logs.")
        for log in logs:
            print(dict(log))
    finally:
        await conn.close()

asyncio.run(run())
