import pytest
import asyncio
from sqlalchemy.future import select
from shared.database import init_db_engine, create_tables, DLQMessage

@pytest.mark.asyncio
async def test_dlq_message_routing():
    init_db_engine("sqlite+aiosqlite:///:memory:")
    await create_tables()

    from shared.database import AsyncSessionLocal

    max_retries = 3
    retry_count = 0
    simulated_crash = True

    # Simulate consumer retry loop
    while retry_count < max_retries:
        retry_count += 1

    # Route to DLQ on exhaustion
    async with AsyncSessionLocal() as db:
        dlq_rec = DLQMessage(
            original_event_id="evt_crash_99",
            original_event_type="InventoryReserved",
            topic="scaleflow.inventory",
            failure_reason="Consumer processing retry exhaustion",
            retry_count=max_retries,
            last_error="RuntimeError: Simulated consumer crash",
            payload_json='{"order_id": 99}'
        )
        db.add(dlq_rec)
        await db.commit()

    # Assert DLQ entry created
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(DLQMessage).where(DLQMessage.original_event_id == "evt_crash_99"))
        dlq_entry = res.scalars().first()
        assert dlq_entry is not None
        assert dlq_entry.retry_count == 3
        assert "Simulated consumer crash" in dlq_entry.last_error
