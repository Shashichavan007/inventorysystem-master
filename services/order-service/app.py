import os
import sys
import json
import asyncio
from typing import List, Optional, Dict
from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from shared.config import settings
from shared.database import get_db, create_tables, Order, OrderItem, EventProcessed, Product
from shared.events.schemas import (
    BaseEvent, EventType, OrderCreatedPayload, OrderItemPayload, OrderConfirmedPayload, OrderCancelledPayload
)
from shared.events.bus import create_event_bus, EventBus
from shared.utils.logging import setup_logger, correlation_id_ctx
from shared.utils.security import get_current_user_payload

logger = setup_logger("order_service")
app = FastAPI(title="ScaleFlow Order Service", version="1.0.0")

event_bus: Optional[EventBus] = None

# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        # order_id -> list of WebSockets
        self.order_connections: Dict[int, List[WebSocket]] = {}
        # Admin broadcast sockets
        self.admin_connections: List[WebSocket] = []

    async def connect_order(self, order_id: int, websocket: WebSocket):
        await websocket.accept()
        if order_id not in self.order_connections:
            self.order_connections[order_id] = []
        self.order_connections[order_id].append(websocket)

    def disconnect_order(self, order_id: int, websocket: WebSocket):
        if order_id in self.order_connections and websocket in self.order_connections[order_id]:
            self.order_connections[order_id].remove(websocket)

    async def connect_admin(self, websocket: WebSocket):
        await websocket.accept()
        self.admin_connections.append(websocket)

    def disconnect_admin(self, websocket: WebSocket):
        if websocket in self.admin_connections:
            self.admin_connections.remove(websocket)

    async def broadcast_order_update(self, order_id: int, data: dict):
        if order_id in self.order_connections:
            for ws in list(self.order_connections[order_id]):
                try:
                    await ws.send_json(data)
                except Exception:
                    self.order_connections[order_id].remove(ws)
        for ws in list(self.admin_connections):
            try:
                await ws.send_json({"type": "ORDER_UPDATE", "data": data})
            except Exception:
                self.admin_connections.remove(ws)

    async def broadcast_admin_event(self, event_data: dict):
        for ws in list(self.admin_connections):
            try:
                await ws.send_json({"type": "EVENT_FLOW", "data": event_data})
            except Exception:
                self.admin_connections.remove(ws)

ws_manager = ConnectionManager()

@app.on_event("startup")
async def startup_event():
    global event_bus
    await create_tables()
    event_bus = create_event_bus("order_service", group_id="group_order_service")
    try:
        await event_bus.start()
        await event_bus.subscribe("scaleflow.inventory", handle_inventory_event)
        await event_bus.subscribe("scaleflow.payments", handle_payment_event)
        if hasattr(event_bus, "start_consumer"):
            await event_bus.start_consumer(["scaleflow.inventory", "scaleflow.payments"])
        logger.info("Order Service EventBus started.")
    except Exception as e:
        logger.error(f"Order Service EventBus startup error: {e}")
        if settings.DEV_MODE != "in_memory":
            raise e

@app.on_event("shutdown")
async def shutdown_event():
    if event_bus:
        await event_bus.stop()

# Pydantic Schemas
class CreateOrderItem(BaseModel):
    product_id: int
    quantity: int

class CreateOrderRequest(BaseModel):
    items: List[CreateOrderItem]

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "order-service"}

@app.post("/orders", status_code=status.HTTP_201_CREATED)
async def create_order(
    req: CreateOrderRequest,
    db: AsyncSession = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    customer_id = int(user_payload.get("sub"))
    corr_id = correlation_id_ctx.get()
    
    if not req.items:
        raise HTTPException(status_code=400, detail="Cart items cannot be empty")

    total_amount = 0.0
    order_items = []

    # Fetch products and calculate total
    for item in req.items:
        res = await db.execute(select(Product).where(Product.id == item.product_id))
        product = res.scalars().first()
        if not product or not product.active:
            raise HTTPException(status_code=400, detail=f"Product ID {item.product_id} not available")
        
        item_total = product.price * item.quantity
        total_amount += item_total
        
        order_items.append({
            "product_id": product.id,
            "product_name": product.name,
            "quantity": item.quantity,
            "unit_price": product.price
        })

    # Create Order in DB
    order = Order(
        customer_id=customer_id,
        status="CREATED",
        total_amount=round(total_amount, 2),
        correlation_id=corr_id
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)

    # Save Order Items
    for oi in order_items:
        item_record = OrderItem(
            order_id=order.id,
            product_id=oi["product_id"],
            product_name=oi["product_name"],
            quantity=oi["quantity"],
            unit_price=oi["unit_price"]
        )
        db.add(item_record)
    
    await db.commit()
    await db.refresh(order, attribute_names=["items"])

    logger.info(f"Order created with ID {order.id} for Customer {customer_id} (Total: ${order.total_amount})")

    # Publish OrderCreated Event to Kafka
    event_payload = OrderCreatedPayload(
        order_id=order.id,
        customer_id=customer_id,
        total_amount=order.total_amount,
        items=[OrderItemPayload(**it) for it in order_items],
        created_at=order.created_at.isoformat()
    )

    event = BaseEvent(
        event_type=EventType.ORDER_CREATED,
        producer="order_service",
        correlation_id=corr_id,
        payload=event_payload.model_dump()
    )

    if event_bus:
        await event_bus.publish("scaleflow.orders", event)

    # Broadcast via WebSocket & Admin Event Visualizer
    await ws_manager.broadcast_order_update(order.id, {
        "order_id": order.id,
        "status": "CREATED",
        "correlation_id": corr_id,
        "total_amount": order.total_amount,
        "timestamp": event.timestamp
    })

    await ws_manager.broadcast_admin_event({
        "event_id": event.event_id,
        "event_type": event.event_type.value,
        "topic": "scaleflow.orders",
        "service": "order_service",
        "correlation_id": corr_id,
        "payload": event.payload,
        "timestamp": event.timestamp
    })

    return {
        "id": order.id,
        "status": order.status,
        "total_amount": order.total_amount,
        "correlation_id": order.correlation_id,
        "created_at": order.created_at.isoformat(),
        "items": [
            {
                "product_id": it.product_id,
                "product_name": it.product_name,
                "quantity": it.quantity,
                "unit_price": it.unit_price
            } for it in order.items
        ]
    }

@app.get("/orders")
async def list_user_orders(
    db: AsyncSession = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    customer_id = int(user_payload.get("sub"))
    role = user_payload.get("role", "CUSTOMER")

    query = select(Order).options(selectinload(Order.items)).order_by(Order.created_at.desc())
    if role != "ADMIN":
        query = query.where(Order.customer_id == customer_id)

    res = await db.execute(query)
    orders = res.scalars().all()

    return [
        {
            "id": o.id,
            "customer_id": o.customer_id,
            "status": o.status,
            "total_amount": o.total_amount,
            "correlation_id": o.correlation_id,
            "created_at": o.created_at.isoformat(),
            "items": [
                {
                    "product_id": it.product_id,
                    "product_name": it.product_name,
                    "quantity": it.quantity,
                    "unit_price": it.unit_price
                } for it in o.items
            ]
        } for o in orders
    ]

@app.get("/orders/{order_id}")
async def get_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    customer_id = int(user_payload.get("sub"))
    role = user_payload.get("role", "CUSTOMER")

    res = await db.execute(select(Order).options(selectinload(Order.items)).where(Order.id == order_id))
    order = res.scalars().first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if role != "ADMIN" and order.customer_id != customer_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this order")

    return {
        "id": order.id,
        "customer_id": order.customer_id,
        "status": order.status,
        "total_amount": order.total_amount,
        "correlation_id": order.correlation_id,
        "created_at": order.created_at.isoformat(),
        "items": [
            {
                "product_id": it.product_id,
                "product_name": it.product_name,
                "quantity": it.quantity,
                "unit_price": it.unit_price
            } for it in order.items
        ]
    }

# WebSockets Endpoints for Live Real-Time Tracking
@app.websocket("/ws/orders/{order_id}")
async def websocket_order_tracking(websocket: WebSocket, order_id: int):
    await ws_manager.connect_order(order_id, websocket)
    try:
        while True:
            # Keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect_order(order_id, websocket)

@app.websocket("/ws/admin/events")
async def websocket_admin_events(websocket: WebSocket):
    await ws_manager.connect_admin(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect_admin(websocket)

# Event Handlers for Kafka Messages
async def handle_inventory_event(event: BaseEvent):
    logger.info(f"Order Service received inventory event: {event.event_type}")
    from shared.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        order_id = event.payload.get("order_id")
        if not order_id: return

        res = await db.execute(select(Order).where(Order.id == order_id))
        order = res.scalars().first()
        if not order: return

        if event.event_type == EventType.INVENTORY_RESERVED:
            order.status = "INVENTORY_RESERVED"
            await db.commit()
            logger.info(f"Order {order_id} state updated to INVENTORY_RESERVED")
            
            await ws_manager.broadcast_order_update(order_id, {
                "order_id": order_id,
                "status": "INVENTORY_RESERVED",
                "correlation_id": event.correlation_id,
                "timestamp": event.timestamp
            })

        elif event.event_type == EventType.INVENTORY_REJECTED:
            order.status = "INVENTORY_FAILED"
            await db.commit()
            logger.warning(f"Order {order_id} state updated to INVENTORY_FAILED")

            await ws_manager.broadcast_order_update(order_id, {
                "order_id": order_id,
                "status": "INVENTORY_FAILED",
                "reason": event.payload.get("reason"),
                "correlation_id": event.correlation_id,
                "timestamp": event.timestamp
            })

        await ws_manager.broadcast_admin_event({
            "event_id": event.event_id,
            "event_type": event.event_type.value,
            "topic": "scaleflow.inventory",
            "service": "inventory_service",
            "correlation_id": event.correlation_id,
            "payload": event.payload,
            "timestamp": event.timestamp
        })

async def handle_payment_event(event: BaseEvent):
    logger.info(f"Order Service received payment event: {event.event_type}")
    from shared.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        order_id = event.payload.get("order_id")
        if not order_id: return

        res = await db.execute(select(Order).where(Order.id == order_id))
        order = res.scalars().first()
        if not order: return

        if event.event_type == EventType.PAYMENT_SUCCEEDED:
            order.status = "CONFIRMED"
            await db.commit()
            logger.info(f"Order {order_id} state updated to CONFIRMED")

            # Publish OrderConfirmed Event
            confirmed_event = BaseEvent(
                event_type=EventType.ORDER_CONFIRMED,
                producer="order_service",
                correlation_id=event.correlation_id,
                payload=OrderConfirmedPayload(
                    order_id=order_id,
                    customer_id=order.customer_id,
                    confirmed_at=event.timestamp
                ).model_dump()
            )
            if event_bus:
                await event_bus.publish("scaleflow.orders", confirmed_event)

            await ws_manager.broadcast_order_update(order_id, {
                "order_id": order_id,
                "status": "CONFIRMED",
                "correlation_id": event.correlation_id,
                "timestamp": event.timestamp
            })

        elif event.event_type == EventType.PAYMENT_FAILED:
            order.status = "CANCELLED"
            await db.commit()
            logger.warning(f"Order {order_id} state updated to CANCELLED (Payment Failed)")

            # Publish OrderCancelled Event
            cancelled_event = BaseEvent(
                event_type=EventType.ORDER_CANCELLED,
                producer="order_service",
                correlation_id=event.correlation_id,
                payload=OrderCancelledPayload(
                    order_id=order_id,
                    customer_id=order.customer_id,
                    reason=event.payload.get("reason", "Payment failed"),
                    cancelled_at=event.timestamp
                ).model_dump()
            )
            if event_bus:
                await event_bus.publish("scaleflow.orders", cancelled_event)

            await ws_manager.broadcast_order_update(order_id, {
                "order_id": order_id,
                "status": "CANCELLED",
                "reason": event.payload.get("reason"),
                "correlation_id": event.correlation_id,
                "timestamp": event.timestamp
            })

        await ws_manager.broadcast_admin_event({
            "event_id": event.event_id,
            "event_type": event.event_type.value,
            "topic": "scaleflow.payments",
            "service": "payment_service",
            "correlation_id": event.correlation_id,
            "payload": event.payload,
            "timestamp": event.timestamp
        })

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
