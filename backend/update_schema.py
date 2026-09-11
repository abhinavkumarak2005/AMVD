import asyncio
from app.core.config import settings
import asyncpg

async def main():
    conn = await asyncpg.connect(settings.DATABASE_URL, statement_cache_size=0)
    await conn.execute("""
        ALTER TABLE booking_persons
        DROP COLUMN IF EXISTS star,
        DROP COLUMN IF EXISTS gothram,
        ADD COLUMN IF NOT EXISTS email text,
        ADD COLUMN IF NOT EXISTS age integer,
        ADD COLUMN IF NOT EXISTS relation text,
        ADD COLUMN IF NOT EXISTS phone text;
    """)
    print("Schema updated!")
    await conn.close()

asyncio.run(main())
