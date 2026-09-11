import asyncio
import asyncpg
from app.core.config import settings

async def main():
    conn = await asyncpg.connect(settings.DATABASE_URL, statement_cache_size=0)
    services = await conn.fetch("SELECT id, name FROM services")
    for s in services:
        print(f"{s['name']}: {s['id']}")
    await conn.close()

asyncio.run(main())
