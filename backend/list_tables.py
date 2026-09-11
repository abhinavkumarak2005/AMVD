import asyncio
from app.core.config import settings
import asyncpg

async def main():
    conn = await asyncpg.connect(settings.DATABASE_URL, statement_cache_size=0)
    tables = await conn.fetch("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
    for t in tables:
        print(t['table_name'])
    await conn.close()

asyncio.run(main())
