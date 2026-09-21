import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def main():
    conn = await asyncpg.connect(os.environ.get('DATABASE_URL'))
    
    try:
        await conn.execute("ALTER TYPE exemption_status ADD VALUE 'approved'")
    except Exception as e:
        print("approved already exists?", e)

    try:
        await conn.execute("ALTER TYPE exemption_status ADD VALUE 'rejected'")
    except Exception as e:
        print("rejected already exists?", e)
    
    print("Added enum values")
    
    await conn.close()

if __name__ == '__main__':
    asyncio.run(main())
