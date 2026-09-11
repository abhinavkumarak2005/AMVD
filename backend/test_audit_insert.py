import asyncio
import asyncpg
import os
import json
from app.core.audit import log_audit
from dotenv import load_dotenv

load_dotenv()
db_url = os.getenv("DATABASE_URL")

async def run():
    conn = await asyncpg.connect(db_url, statement_cache_size=0)
    try:
        # Simulate log_audit with a fake user_id (needs to be a valid uuid, but wait, if it's null it might be fine, but log_audit expects a string)
        # We can just fetch an existing user id
        user = await conn.fetchrow("SELECT id FROM users LIMIT 1")
        if user:
            uid = str(user['id'])
            await log_audit(conn, uid, "TEST_ACTION", "test_entity", "123", {"foo": "bar"})
            print("Successfully inserted audit log via log_audit!")
            
            # verify insertion
            logs = await conn.fetch("SELECT * FROM audit_logs WHERE action_type = 'TEST_ACTION'")
            print(f"Found {len(logs)} logs.")
            for log in logs:
                print(dict(log))
        else:
            print("No users found to test with.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await conn.close()

asyncio.run(run())
