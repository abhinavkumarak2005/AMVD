import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.getenv("DATABASE_URL")

async def run():
    conn = await asyncpg.connect(db_url, statement_cache_size=0)
    try:
        res = await conn.fetch("SELECT prosrc FROM pg_proc WHERE proname = 'handle_new_user'")
        for r in res:
            print(dict(r))
    finally:
        await conn.close()

asyncio.run(run())
