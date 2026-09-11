import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.getenv("DATABASE_URL")

async def run():
    conn = await asyncpg.connect(db_url, statement_cache_size=0)
    try:
        cols = await conn.fetch("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('e_undiyal_transactions', 'donations', 'tax_exemptions')")
        for col in cols:
            print(dict(col))
    finally:
        await conn.close()

asyncio.run(run())
