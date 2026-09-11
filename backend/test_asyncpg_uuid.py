import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.getenv("DATABASE_URL")

async def run():
    conn = await asyncpg.connect(db_url, statement_cache_size=0)
    try:
        user_id = "1d35ab57-fa06-4deb-89e3-2038093498a4"
        await conn.fetchrow("SELECT full_name FROM users WHERE id = $1", user_id)
        print("Success")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await conn.close()

asyncio.run(run())
