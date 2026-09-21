import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def main():
    conn = await asyncpg.connect(os.environ.get('DATABASE_URL'))
    
    homam_id = await conn.fetchval("SELECT id FROM services WHERE name = 'Ganapathy Homam'")
    thirukalyanam_id = await conn.fetchval("SELECT id FROM services WHERE name = 'Urchavar Thirukalyanam'")
    silver_chariot_id = await conn.fetchval("SELECT id FROM services WHERE name = 'Silver Chariot'")
    
    if homam_id:
        await conn.execute("DELETE FROM conflict_rules WHERE service_a_id = $1 OR service_b_id = $1", homam_id)
        
    if thirukalyanam_id and silver_chariot_id:
        await conn.execute("""
            INSERT INTO conflict_rules (rule_type, service_a_id, service_b_id, description)
            VALUES ('mutual_exclusive', $1, $2, 'Thirukalyanam and Silver Chariot cannot be on same date')
            ON CONFLICT DO NOTHING
        """, thirukalyanam_id, silver_chariot_id)
        
    print("Fixed conflict rules.")
    await conn.close()

if __name__ == '__main__':
    asyncio.run(main())
