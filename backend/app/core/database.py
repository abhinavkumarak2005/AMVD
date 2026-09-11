import asyncpg
from typing import Optional
from app.core.config import settings

class Database:
    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None

    async def connect(self):
        if not self.pool:
            self.pool = await asyncpg.create_pool(
                dsn=settings.DATABASE_URL,
                min_size=1,
                max_size=10,
                statement_cache_size=0,
            )
            print("Connected to PostgreSQL database.")

    async def disconnect(self):
        if self.pool:
            await self.pool.close()
            print("Disconnected from PostgreSQL database.")

db = Database()

async def get_db() -> asyncpg.Connection:
    if not db.pool:
        raise Exception("Database pool not initialized")
    async with db.pool.acquire() as connection:
        yield connection
