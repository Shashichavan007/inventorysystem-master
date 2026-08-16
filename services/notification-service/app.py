import os
import sys
import asyncio
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from shared.config import settings
from shared.database import get_db, create_tables, Notification
from shared.events.schemas import BaseEvent, EventType
from shared.events.bus import create_event_bus, EventBus
from shared.utils.logging import setup_logger
from shared.utils.security import get_current_user_payload

logger = setup_logger("notification_service")
app = FastAPI(title="ScaleFlow Notification Service", version="1.0.0")

event_bus: Optional[EventBus] = None

@app.on_event("startup")
async def startup_event():
    global event_bus
    await create_tables()
    event_bus = create_event_bus("notification_service", group_id="group_notification_service")
    try:
        await event_bus.start()
        await event_bus.subscribe("scaleflow.orders", handle_event)
        await event_bus.subscribe("scaleflow.inventory", handle_event)
        await event_bus.subscribe("scaleflow.payments", handle_event)
        if hasattr(event_bus, "start_consumer"):
            await event_bus.start_consumer(["scaleflow.orders", "scaleflow.inventory", "scaleflow.payments"])
        logger.info("Notification Service EventBus started.")
    except Exception as e:
        logger.error(f"Notification Service EventBus error: {e}")
        if settings.DEV_MODE != "in_memory":
            raise e

@app.on_event("shutdown")
async def shutdown_event():
    if event_bus:
        await event_bus.stop()

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "notification-service"}

@app.get("/notifications")
async def get_user_notifications(
    db: AsyncSession = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    user_id = int(user_payload.get("sub"))
    res = await db.execute(
        select(Notification)
        .where(Notification.customer_id == user_id)
        .order_by(Notification.created_at.desc())
    )
    notifications = res.scalars().all()
    return [
        {
            "id": n.id,
            "order_id": n.order_id,
            "type": n.type,
            "title": n.title,
            "message": n.message,
            "read": n.read,
            "created_at": n.created_at.isoformat()
        } for n in notifications
    ]

async def handle_event(event: BaseEvent):
    logger.info(f"Notification Service processing event '{event.event_type}'")
    from shared.database import AsyncSessionLocal

    payload = event.payload
    customer_id = payload.get("customer_id")
    order_id = payload.get("order_id")

    if not customer_id:
        return

    title = f"Order #{order_id} Update"
    msg = f"Event '{event.event_type}' was recorded for Order #{order_id}."

    if event.event_type == EventType.ORDER_CREATED:
        title = f"Order #{order_id} Created"
        msg = f"Your order #{order_id} for ${payload.get('total_amount')} has been placed successfully."
    elif event.event_type == EventType.INVENTORY_RESERVED:
        title = f"Inventory Reserved for Order #{order_id}"
        msg = "Items have been reserved in inventory. Processing payment."
    elif event.event_type == EventType.PAYMENT_SUCCEEDED:
        title = f"Payment Confirmed for Order #{order_id}"
        msg = f"Payment of ${payload.get('amount')} was successful (Transaction: {payload.get('transaction_id')})."
    elif event.event_type == EventType.ORDER_CONFIRMED:
        title = f"Order #{order_id} Confirmed!"
        msg = "Your order is confirmed and sent to warehouse for fulfillment."
    elif event.event_type == EventType.PAYMENT_FAILED:
        title = f"Payment Failed for Order #{order_id}"
        msg = f"Payment could not be processed: {payload.get('reason')}. Reserved inventory was released."
    elif event.event_type == EventType.INVENTORY_REJECTED:
        title = f"Order #{order_id} Cancelled"
        msg = f"Could not reserve stock: {payload.get('reason')}."

    async with AsyncSessionLocal() as db:
        notification = Notification(
            customer_id=customer_id,
            order_id=order_id,
            type=event.event_type.value,
            title=title,
            message=msg
        )
        db.add(notification)
        await db.commit()
        logger.info(f"Created notification record for customer {customer_id} (Order {order_id})")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005)
