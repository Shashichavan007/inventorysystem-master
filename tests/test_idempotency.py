import pytest
import asyncio
from sqlalchemy.future import select
from shared.database import init_db_engine, create_tables, EventProcessed

@pytest.mark.asyncio
async def test_idempotent_event_processing():
    init_db_engine("sqlite+aiosqlite:///:memory:")
    await create_tables()

    from shared.database import AsyncSessionLocal

    event_id = "evt_duplicate_test_123"
    consumer_service = "payment_service"

    async def process_event_once():
        async with AsyncSessionLocal() as db:
            # Check idempotency table
            stmt = select(EventProcessed).where(
                EventProcessed.event_id == event_id,
                EventProcessed.consumer_service == consumer_service
            )
            res = await db.execute(stmt)
            if res.scalars().first():
                return "SKIPPED_DUPLICATE"
            
            # Record processing
            db.add(EventProcessed(
                event_id=event_id,
                consumer_service=consumer_service,
                event_type="InventoryReserved"
            ))
            await db.commit()
            return "PROCESSED"

    # First delivery
    res1 = await process_event_once()
    assert res1 == "PROCESSED"

    # Second delivery (Duplicate event)
    res2 = await process_event_once()
    assert res2 == "SKIPPED_DUPLICATE"

    # Third delivery (Duplicate event)
    res3 = await process_event_once()
    assert res3 == "SKIPPED_DUPLICATE"

    # Verify only 1 record in database
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(EventProcessed).where(EventProcessed.event_id == event_id))
        records = res.scalars().all()
        assert len(records) == 1
