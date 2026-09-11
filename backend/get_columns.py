import asyncio
from app.core.config import settings
import asyncpg

async def main():
    conn = await asyncpg.connect(settings.DATABASE_URL, statement_cache_size=0)
    columns = await conn.fetch("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'services'")
    for c in columns:
        print(f"{c['column_name']}: {c['data_type']}")
    await conn.close()

asyncio.run(main())
