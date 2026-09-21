import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def main():
    conn = await asyncpg.connect(os.environ.get('DATABASE_URL'))
    
    print("--- Conflict Rules ---")
    rules = await conn.fetch('''
        SELECT r.rule_type, s1.name as a, s2.name as b 
        FROM conflict_rules r 
        LEFT JOIN services s1 ON r.service_a_id = s1.id 
        LEFT JOIN services s2 ON r.service_b_id = s2.id
    ''')
    for r in rules:
        print(dict(r))
        
    print("\n--- Services requiring approval ---")
    services = await conn.fetch('SELECT name, requires_approval FROM services WHERE requires_approval = true')
    for s in services:
        print(dict(s))
        
    await conn.close()

if __name__ == '__main__':
    asyncio.run(main())
