import asyncio, asyncpg
from app.core.config import settings

async def main():
    conn = await asyncpg.connect(settings.DATABASE_URL, statement_cache_size=0)
    
    # 1. Create service_categories table
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS service_categories (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT UNIQUE NOT NULL,
            slug TEXT UNIQUE NOT NULL,
            description TEXT,
            sort_order INT DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    """)
    print("service_categories table verified/created.")
    
    # 2. Seed initial service categories
    default_cats = [
        ("Annadhanam", "annadhanam", "Sacred food offering to devotees and the needy", 1),
        ("Pooja", "pooja", "Daily sacred pooja offerings to Lord Vinayagar", 2),
        ("Homam", "homam", "Sacred fire rituals and havans", 3),
        ("Chariot", "chariot", "Golden and Silver chariot processions", 4),
        ("Kavasam", "kavasam", "Sacred deity adornment with precious kavacham", 5),
        ("Abhisegam", "abhisegam", "Sacred ablution rituals for Lord Vinayagar", 6),
        ("Kaapu", "kaapu", "Special deity decoration with sacred sandalwood and butter", 7),
        ("Thirukalyanam", "thirukalyanam", "Celestial divine wedding ceremony", 8),
    ]
    for name, slug, desc, order in default_cats:
        await conn.execute("""
            INSERT INTO service_categories (name, slug, description, sort_order)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (name) DO NOTHING;
        """, name, slug, desc, order)
    print("Service categories seeded.")

    # 3. Verify audit_logs table
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS audit_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID,
            user_name TEXT,
            user_role TEXT,
            action_type TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT,
            details JSONB DEFAULT '{}'::jsonb,
            ip_address TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
    """)
    print("Audit logs table and indexes verified.")

    # 4. Check services table categories
    rows = await conn.fetch("SELECT id, name, category FROM services")
    print(f"Total services in DB: {len(rows)}")
    for r in rows:
        print(f"  {r['name']} -> category: {r['category']}")

    await conn.close()

if __name__ == '__main__':
    asyncio.run(main())

