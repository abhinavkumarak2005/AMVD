import asyncio
import asyncpg
import os
import json
from dotenv import load_dotenv

load_dotenv()
db_url = os.getenv("DATABASE_URL")

async def run():
    conn = await asyncpg.connect(db_url, statement_cache_size=0)
    try:
        await conn.execute("INSERT INTO audit_logs (action_type, entity_type, details) VALUES ($1, $2, $3)", 
            "TEST", "TEST", json.dumps({"test": 1}))
        print("Success")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await conn.close()

asyncio.run(run())
