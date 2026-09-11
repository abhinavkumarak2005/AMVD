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
        SELECT cmd, qual, with_check 
        FROM pg_policies 
        WHERE tablename = 'users'
        """)
        for r in res:
            print(dict(r))
    finally:
        await conn.close()

asyncio.run(run())
