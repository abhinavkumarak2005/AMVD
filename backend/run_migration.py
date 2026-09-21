import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def main():
    conn = await asyncpg.connect(os.environ.get('DATABASE_URL'))
    
    sql = """
    CREATE OR REPLACE FUNCTION has_permission(perm_name TEXT)
    RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
      SELECT COALESCE((permissions->>perm_name)::boolean, false) OR 
             (perm_name LIKE 'view_%' AND COALESCE((permissions->>REPLACE(perm_name, 'view_', 'manage_'))::boolean, false))
      FROM roles 
      WHERE name = get_my_role();
    $$;
    """
    
    await conn.execute(sql)
    print("has_permission updated successfully.")
    await conn.close()

if __name__ == '__main__':
    asyncio.run(main())
