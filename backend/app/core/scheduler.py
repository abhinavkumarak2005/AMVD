from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.core.database import db

scheduler = AsyncIOScheduler()

async def clean_expired_holds():
    if not db.pool:
        return
    
    try:
        async with db.pool.acquire(timeout=5.0) as conn:
            async with conn.transaction():
                # Find expired holds that haven't been released
                expired_holds = await conn.fetch(
                    """
                    SELECT id, service_id, date, session
                    FROM booking_holds
                    WHERE expires_at < NOW() AND is_released = false
                    FOR UPDATE SKIP LOCKED
                    """,
                    timeout=5.0
                )

                for hold in expired_holds:
                    # Mark as released
                    await conn.execute(
                        "UPDATE booking_holds SET is_released = true WHERE id = $1",
                        hold['id'],
                        timeout=5.0
                    )
                    
                    # Decrement pending_count in slot_inventory
                    await conn.execute(
                        """
                        UPDATE slot_inventory
                        SET pending_count = GREATEST(0, pending_count - 1)
                        WHERE service_id = $1 AND date = $2 AND session = $3
                        """,
                        hold['service_id'], hold['date'], hold['session'],
                        timeout=5.0
                    )
                
                if expired_holds:
                    print(f"[Scheduler] Released {len(expired_holds)} expired holds.")
    except Exception as e:
        print(f"[Scheduler] Error cleaning expired holds: {e}")

def start_scheduler():
    scheduler.add_job(clean_expired_holds, 'interval', minutes=2)
    scheduler.start()
    print("Background scheduler started.")

def stop_scheduler():
    scheduler.shutdown()
