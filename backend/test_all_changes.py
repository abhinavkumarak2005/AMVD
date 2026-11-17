import asyncio, asyncpg, json
from app.core.config import settings

async def main():
    conn = await asyncpg.connect(settings.DATABASE_URL, statement_cache_size=0)
    
    print("--- 1. Testing Service Categories ---")
    cats = await conn.fetch("SELECT name, slug, sort_order FROM service_categories ORDER BY sort_order ASC")
    print(f"Found {len(cats)} categories:")
    for c in cats:
        print(f"  [{c['sort_order']}] {c['name']} ({c['slug']})")

    print("\n--- 2. Testing Month Availability Logic ---")
    svc = await conn.fetchrow("SELECT id, name FROM services WHERE name ILIKE $1", "%Annadhanam Meals%")
    if svc:
        print(f"Service: {svc['name']} (ID: {svc['id']})")
        from app.api.bookings import get_month_availability
        res = await get_month_availability(str(svc['id']), 2026, 11, conn)
        sample = list(res.items())[:7]
        print(f"November 2026 availability sample: {sample}")

    print("\n--- 3. Testing Audit Logs & Devotee Activity ---")
    await conn.execute("""
        INSERT INTO audit_logs (user_name, user_role, action_type, entity_type, entity_id, details, ip_address)
        VALUES ('Test Devotee', 'devotee', 'PAGE_VISIT', 'devotee_activity', '/services', '{"page": "/services"}'::jsonb, '127.0.0.1')
    """)
    recent = await conn.fetchrow("SELECT * FROM audit_logs WHERE action_type = 'PAGE_VISIT' ORDER BY created_at DESC LIMIT 1")
    print(f"Recorded activity log: {dict(recent)['action_type']} by {dict(recent)['user_name']} on {dict(recent)['entity_id']}")

    print("\n--- 4. Testing Users Status & Verification query ---")
    users = await conn.fetch("""
        SELECT u.id, u.full_name, u.email, u.role, u.is_active,
               (a.email_confirmed_at IS NOT NULL) AS is_verified
        FROM public.users u
        LEFT JOIN auth.users a ON u.id = a.id
        LIMIT 5
    """)
    print(f"Users sample ({len(users)}):")
    for u in users:
        print(f"  {u['email']} | Role: {u['role']} | Active: {u['is_active']} | Verified: {u['is_verified']}")

    await conn.close()
    print("\nAll database & backend checks passed successfully!")

if __name__ == '__main__':
    asyncio.run(main())

