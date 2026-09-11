import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.getenv("DATABASE_URL")

async def run():
    conn = await asyncpg.connect(db_url, statement_cache_size=0)
    try:
        with open("../supabase/migrations/007_system_settings.sql", "r") as f:
            await conn.execute(f.read())
        print("Migration 007 run successfully!")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(run())
