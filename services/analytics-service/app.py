import os
import sys
import time
import asyncio
from typing import Optional
from fastapi import FastAPI, Depends
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from shared.config import settings
from shared.database import get_db, create_tables, Order, Payment, DLQMessage, EventProcessed
from shared.events.schemas import BaseEvent, EventType
from shared.events.bus import create_event_bus, EventBus
from shared.utils.logging import setup_logger

logger = setup_logger("analytics_service")
app = FastAPI(title="ScaleFlow Analytics Service", version="1.0.0")

event_bus: Optional[EventBus] = None

# Prometheus Metrics Definitions
PROMETHEUS_EVENTS_TOTAL = Counter(
    "scaleflow_kafka_events_total",
    "Total count of Kafka events processed by type",
    ["event_type", "producer"]
)

PROMETHEUS_ORDERS_TOTAL = Counter(
    "scaleflow_orders_total",
    "Total orders placed",
    ["status"]
)

PROMETHEUS_REVENUE_TOTAL = Counter(
    "scaleflow_revenue_usd_total",
    "Total revenue processed in USD"
)

PROMETHEUS_ORDER_DURATION_SECONDS = Histogram(
    "scaleflow_order_processing_duration_seconds",
    "End-to-end processing time for orders from CREATED to CONFIRMED",
    buckets=[0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
)

PROMETHEUS_DLQ_MESSAGES_GAUGE = Gauge(
    "scaleflow_dlq_messages_count",
    "Current count of dead letter queue messages"
)

# In-memory trackers for real event flow timing
order_start_times: dict = {}

@app.on_event("startup")
async def startup_event():
    global event_bus
    await create_tables()
    event_bus = create_event_bus("analytics_service", group_id="group_analytics_service")
    try:
        await event_bus.start()
        await event_bus.subscribe("scaleflow.orders", handle_analytics_event)
        await event_bus.subscribe("scaleflow.inventory", handle_analytics_event)
        await event_bus.subscribe("scaleflow.payments", handle_analytics_event)
        await event_bus.subscribe("scaleflow.dlq", handle_analytics_event)
        if hasattr(event_bus, "start_consumer"):
            await event_bus.start_consumer(["scaleflow.orders", "scaleflow.inventory", "scaleflow.payments", "scaleflow.dlq"])
        logger.info("Analytics Service EventBus started.")
    except Exception as e:
        logger.error(f"Analytics Service EventBus error: {e}")
        if settings.DEV_MODE != "in_memory":
            raise e

@app.on_event("shutdown")
async def shutdown_event():
    if event_bus:
        await event_bus.stop()

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "analytics-service"}

@app.get("/metrics", response_class=PlainTextResponse)
async def metrics(db: AsyncSession = Depends(get_db)):
    # Update DLQ gauge dynamically
    res = await db.execute(select(func.count(DLQMessage.id)))
    dlq_cnt = res.scalar() or 0
    PROMETHEUS_DLQ_MESSAGES_GAUGE.set(dlq_cnt)
    return generate_latest()

@app.get("/analytics/dashboard")
async def get_dashboard_metrics(db: AsyncSession = Depends(get_db)):
    # Real DB aggregations
    res_orders = await db.execute(select(func.count(Order.id)))
    total_orders = res_orders.scalar() or 0

    res_confirmed = await db.execute(select(func.count(Order.id)).where(Order.status == "CONFIRMED"))
    confirmed_orders = res_confirmed.scalar() or 0

    res_failed = await db.execute(select(func.count(Order.id)).where(Order.status.in_(["CANCELLED", "INVENTORY_FAILED", "PAYMENT_FAILED"])))
    failed_orders = res_failed.scalar() or 0

    res_revenue = await db.execute(select(func.sum(Payment.amount)).where(Payment.status == "SUCCEEDED"))
    total_revenue = round(res_revenue.scalar() or 0.0, 2)

    res_dlq = await db.execute(select(func.count(DLQMessage.id)))
    dlq_count = res_dlq.scalar() or 0

    res_events = await db.execute(select(func.count(EventProcessed.id)))
    total_events_processed = res_events.scalar() or 0

    success_rate = round((confirmed_orders / total_orders * 100), 1) if total_orders > 0 else 100.0

    return {
        "total_orders": total_orders,
        "confirmed_orders": confirmed_orders,
        "failed_orders": failed_orders,
        "total_revenue_usd": total_revenue,
        "success_rate_percent": success_rate,
        "dlq_count": dlq_count,
        "total_events_processed": total_events_processed
    }

async def handle_analytics_event(event: BaseEvent):
    PROMETHEUS_EVENTS_TOTAL.labels(event_type=event.event_type.value, producer=event.producer).inc()

    payload = event.payload
    order_id = payload.get("order_id")

    if event.event_type == EventType.ORDER_CREATED:
        order_start_times[order_id] = time.time()
        PROMETHEUS_ORDERS_TOTAL.labels(status="CREATED").inc()

    elif event.event_type == EventType.ORDER_CONFIRMED:
        PROMETHEUS_ORDERS_TOTAL.labels(status="CONFIRMED").inc()
        if order_id in order_start_times:
            duration = time.time() - order_start_times.pop(order_id)
            PROMETHEUS_ORDER_DURATION_SECONDS.observe(duration)
            logger.info(f"Order #{order_id} completed in {duration:.3f} seconds.")

    elif event.event_type == EventType.PAYMENT_SUCCEEDED:
        amt = payload.get("amount", 0.0)
        PROMETHEUS_REVENUE_TOTAL.inc(amt)

    elif event.event_type == EventType.ORDER_CANCELLED:
        PROMETHEUS_ORDERS_TOTAL.labels(status="CANCELLED").inc()

    elif event.event_type == EventType.DLQ_EVENT:
        PROMETHEUS_DLQ_MESSAGES_GAUGE.inc()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8006)
