import os
import sys
import uuid
import random
import asyncio
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from shared.config import settings
from shared.database import get_db, create_tables, Payment, EventProcessed, DLQMessage
from shared.events.schemas import (
    BaseEvent, EventType, PaymentSucceededPayload, PaymentFailedPayload, DLQEventPayload
)
from shared.events.bus import create_event_bus, EventBus
from shared.utils.logging import setup_logger
from shared.utils.security import require_role

logger = setup_logger("payment_service")
app = FastAPI(title="ScaleFlow Payment Service", version="1.0.0")

event_bus: Optional[EventBus] = None

# Failure & Processing Simulation Settings (Controlled by Admin Panel)
class SimulationSettings:
    force_failure: bool = False
    failure_rate: float = 0.0  # 0.0 to 1.0 probability
    artificial_delay_sec: float = 0.0
    force_consumer_crash: bool = False
    crash_retry_counter: dict = {}  # event_id -> count

sim_config = SimulationSettings()

@app.on_event("startup")
async def startup_event():
    global event_bus
    await create_tables()
    event_bus = create_event_bus("payment_service", group_id="group_payment_service")
    try:
        await event_bus.start()
        await event_bus.subscribe("scaleflow.inventory", handle_inventory_reserved_event)
        if hasattr(event_bus, "start_consumer"):
            await event_bus.start_consumer(["scaleflow.inventory"])
        logger.info("Payment Service EventBus started.")
    except Exception as e:
        logger.error(f"Payment Service EventBus startup error: {e}")
        if settings.DEV_MODE != "in_memory":
            raise e

@app.on_event("shutdown")
async def shutdown_event():
    if event_bus:
        await event_bus.stop()

# Pydantic Config Schema
class SimulationUpdateRequest(BaseModel):
    force_failure: Optional[bool] = None
    failure_rate: Optional[float] = None
    artificial_delay_sec: Optional[float] = None
    force_consumer_crash: Optional[bool] = None

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "payment-service",
        "simulation_mode": {
            "force_failure": sim_config.force_failure,
            "failure_rate": sim_config.failure_rate,
            "artificial_delay_sec": sim_config.artificial_delay_sec,
            "force_consumer_crash": sim_config.force_consumer_crash
        }
    }

@app.get("/simulation")
async def get_simulation_settings():
    return {
        "force_failure": sim_config.force_failure,
        "failure_rate": sim_config.failure_rate,
        "artificial_delay_sec": sim_config.artificial_delay_sec,
        "force_consumer_crash": sim_config.force_consumer_crash
    }

@app.post("/simulation")
async def update_simulation_settings(req: SimulationUpdateRequest):
    if req.force_failure is not None: sim_config.force_failure = req.force_failure
    if req.failure_rate is not None: sim_config.failure_rate = req.failure_rate
    if req.artificial_delay_sec is not None: sim_config.artificial_delay_sec = req.artificial_delay_sec
    if req.force_consumer_crash is not None: sim_config.force_consumer_crash = req.force_consumer_crash
    logger.info(f"Updated Payment Simulation config: force_fail={sim_config.force_failure}, rate={sim_config.failure_rate}")
    return {"message": "Simulation settings updated", "config": await get_simulation_settings()}

@app.get("/dlq")
async def get_dlq_messages(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(DLQMessage).order_by(DLQMessage.created_at.desc()))
    messages = res.scalars().all()
    return [
        {
            "id": m.id,
            "original_event_id": m.original_event_id,
            "original_event_type": m.original_event_type,
            "topic": m.topic,
            "failure_reason": m.failure_reason,
            "retry_count": m.retry_count,
            "last_error": m.last_error,
            "payload": m.payload_json,
            "created_at": m.created_at.isoformat()
        } for m in messages
    ]

# Core Event Handler with Idempotency, Retry, and DLQ
async def handle_inventory_reserved_event(event: BaseEvent):
    if event.event_type != EventType.INVENTORY_RESERVED:
        return

    logger.info(f"Payment Service received InventoryReserved event {event.event_id} (Correlation: {event.correlation_id})")

    from shared.database import AsyncSessionLocal

    # Retry loop wrapper (up to 3 attempts)
    max_retries = 3
    retry_count = 0
    last_error = ""

    while retry_count < max_retries:
        try:
            # Simulated consumer crash for DLQ testing
            if sim_config.force_consumer_crash:
                curr_count = sim_config.crash_retry_counter.get(event.event_id, 0) + 1
                sim_config.crash_retry_counter[event.event_id] = curr_count
                raise RuntimeError(f"Simulated consumer crash attempt #{curr_count} for event {event.event_id}")

            async with AsyncSessionLocal() as db:
                # 1. IDEMPOTENCY CHECK
                stmt = select(EventProcessed).where(
                    EventProcessed.event_id == event.event_id,
                    EventProcessed.consumer_service == "payment_service"
                )
                res = await db.execute(stmt)
                if res.scalars().first():
                    logger.info(f"[IDEMPOTENCY] Event {event.event_id} already processed by Payment Service. Skipping duplicate payment.")
                    return

                # Artificial processing delay
                if sim_config.artificial_delay_sec > 0:
                    await asyncio.sleep(sim_config.artificial_delay_sec)

                payload = event.payload
                order_id = payload["order_id"]
                customer_id = payload["customer_id"]
                amount = payload["total_amount"]

                # 2. DECIDE PAYMENT SUCCESS / FAILURE
                is_failure = sim_config.force_failure or (random.random() < sim_config.failure_rate)

                payment_id = f"pay_{uuid.uuid4().hex[:12]}"
                txn_id = f"txn_{uuid.uuid4().hex[:12]}"

                if is_failure:
                    payment = Payment(
                        payment_id=payment_id,
                        order_id=order_id,
                        customer_id=customer_id,
                        amount=amount,
                        status="FAILED",
                        failure_reason="Card declined or simulated payment failure"
                    )
                    db.add(payment)
                    db.add(EventProcessed(
                        event_id=event.event_id,
                        consumer_service="payment_service",
                        event_type=event.event_type.value
                    ))
                    await db.commit()

                    logger.warning(f"Payment failed for Order {order_id}. Emitting PaymentFailed event.")

                    failed_event = BaseEvent(
                        event_type=EventType.PAYMENT_FAILED,
                        producer="payment_service",
                        correlation_id=event.correlation_id,
                        payload=PaymentFailedPayload(
                            order_id=order_id,
                            customer_id=customer_id,
                            reason="Payment simulation failure: Card declined",
                            attempt_count=1
                        ).model_dump()
                    )
                    if event_bus:
                        await event_bus.publish("scaleflow.payments", failed_event)
                    return

                # SUCCESSFUL PAYMENT
                payment = Payment(
                    payment_id=payment_id,
                    order_id=order_id,
                    customer_id=customer_id,
                    amount=amount,
                    status="SUCCEEDED",
                    transaction_id=txn_id
                )
                db.add(payment)
                db.add(EventProcessed(
                    event_id=event.event_id,
                    consumer_service="payment_service",
                    event_type=event.event_type.value
                ))
                await db.commit()

                logger.info(f"Payment succeeded for Order {order_id} (Payment ID: {payment_id}, Txn: {txn_id})")

                succ_event = BaseEvent(
                    event_type=EventType.PAYMENT_SUCCEEDED,
                    producer="payment_service",
                    correlation_id=event.correlation_id,
                    payload=PaymentSucceededPayload(
                        order_id=order_id,
                        customer_id=customer_id,
                        payment_id=payment_id,
                        amount=amount,
                        transaction_id=txn_id
                    ).model_dump()
                )
                if event_bus:
                    await event_bus.publish("scaleflow.payments", succ_event)
                return

        except Exception as ex:
            retry_count += 1
            last_error = str(ex)
            logger.warning(f"Consumer retry attempt #{retry_count}/{max_retries} for event {event.event_id}: {ex}")
            await asyncio.sleep(0.5 * (2 ** retry_count))  # Exponential backoff

    # 3. DEAD LETTER QUEUE (DLQ) ROUTING
    logger.error(f"[DLQ ROUTING] Retries exhausted ({max_retries}) for event {event.event_id}. Sending to DLQ!")
    async with AsyncSessionLocal() as db:
        dlq_rec = DLQMessage(
            original_event_id=event.event_id,
            original_event_type=event.event_type.value,
            topic="scaleflow.inventory",
            failure_reason="Consumer processing retry exhaustion",
            retry_count=max_retries,
            last_error=last_error,
            payload_json=str(event.payload)
        )
        db.add(dlq_rec)
        await db.commit()

    # Publish to DLQ topic
    dlq_event = BaseEvent(
        event_type=EventType.DLQ_EVENT,
        producer="payment_service",
        correlation_id=event.correlation_id,
        payload=DLQEventPayload(
            original_event_id=event.event_id,
            original_event_type=event.event_type.value,
            original_topic="scaleflow.inventory",
            failure_reason="Consumer retries exhausted",
            retry_count=max_retries,
            last_error=last_error,
            payload=event.payload
        ).model_dump()
    )
    if event_bus:
        await event_bus.publish("scaleflow.dlq", dlq_event)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8004)
