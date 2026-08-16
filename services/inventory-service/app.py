import os
import sys
import json
import uuid
import asyncio
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import redis.asyncio as aioredis

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from shared.config import settings
from shared.database import (
    get_db, create_tables, Product, Category, InventoryReservation, EventProcessed
)
from shared.events.schemas import (
    BaseEvent, EventType, OrderCreatedPayload, InventoryReservedPayload,
    InventoryRejectedPayload, OrderItemPayload
)
from shared.events.bus import create_event_bus, EventBus
from shared.utils.logging import setup_logger
from shared.utils.security import require_role

logger = setup_logger("inventory_service")
app = FastAPI(title="ScaleFlow Inventory Service", version="1.0.0")

event_bus: Optional[EventBus] = None
redis_client: Optional[aioredis.Redis] = None

# Metrics for cache
cache_stats = {"hits": 0, "misses": 0}

@app.on_event("startup")
async def startup_event():
    global event_bus, redis_client
    await create_tables()
    
    # Initialize Redis connection
    try:
        redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        await redis_client.ping()
        logger.info("Connected to Redis cache.")
    except Exception as e:
        logger.warning(f"Redis unavailable: {e}. Running without Redis cache.")
        redis_client = None

    # Initialize Event Bus
    event_bus = create_event_bus("inventory_service", group_id="group_inventory_service")
    try:
        await event_bus.start()
        await event_bus.subscribe("scaleflow.orders", handle_order_created_event)
        await event_bus.subscribe("scaleflow.payments", handle_payment_event)
        if hasattr(event_bus, "start_consumer"):
            await event_bus.start_consumer(["scaleflow.orders", "scaleflow.payments"])
        logger.info("Inventory Service EventBus initialized.")
    except Exception as e:
        logger.error(f"EventBus initialization error: {e}")
        if settings.DEV_MODE != "in_memory":
            raise e

@app.on_event("shutdown")
async def shutdown_event():
    if event_bus:
        await event_bus.stop()
    if redis_client:
        await redis_client.close()

# Pydantic Schemas
class ProductCreate(BaseModel):
    sku: str
    name: str
    description: Optional[str] = None
    price: float
    stock: int
    category_id: int

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    stock: Optional[int] = None
    active: Optional[bool] = None

class ProductResponse(BaseModel):
    id: int
    sku: str
    name: str
    description: Optional[str]
    price: float
    stock: int
    category_id: int
    active: bool

class CategoryCreate(BaseModel):
    name: str
    slug: str

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "inventory-service", "cache_stats": cache_stats}

# Categories
@app.get("/categories")
async def list_categories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Category))
    return result.scalars().all()

@app.post("/categories", status_code=status.HTTP_201_CREATED)
async def create_category(cat: CategoryCreate, db: AsyncSession = Depends(get_db), payload: dict = Depends(require_role("ADMIN"))):
    category = Category(name=cat.name, slug=cat.slug)
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category

# Products with Redis Caching
@app.get("/products")
async def list_products(
    category_id: Optional[int] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db)
):
    cache_key = f"products:cat_{category_id}:search_{search}:skip_{skip}:limit_{limit}"
    if redis_client and not search and not category_id:
        try:
            cached = await redis_client.get(cache_key)
            if cached:
                cache_stats["hits"] += 1
                return json.loads(cached)
        except Exception:
            pass
    cache_stats["misses"] += 1

    query = select(Product).where(Product.active == True)
    if category_id:
        query = query.where(Product.category_id == category_id)
    if search:
        query = query.where(Product.name.ilike(f"%{search}%"))
    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    products = result.scalars().all()
    
    resp_data = [
        {
            "id": p.id,
            "sku": p.sku,
            "name": p.name,
            "description": p.description,
            "price": p.price,
            "stock": p.stock,
            "category_id": p.category_id,
            "active": p.active
        }
        for p in products
    ]

    if redis_client and not search and not category_id:
        try:
            await redis_client.set(cache_key, json.dumps(resp_data), ex=60)
        except Exception:
            pass

    return resp_data

@app.get("/products/{product_id}")
async def get_product(product_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalars().first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@app.post("/products", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(p: ProductCreate, db: AsyncSession = Depends(get_db), payload: dict = Depends(require_role("ADMIN"))):
    product = Product(
        sku=p.sku,
        name=p.name,
        description=p.description,
        price=p.price,
        stock=p.stock,
        category_id=p.category_id
    )
    db.add(product)
    await db.commit()
    await db.refresh(product)

    # Cache invalidation
    if redis_client:
        try:
            keys = await redis_client.keys("products:*")
            if keys:
                await redis_client.delete(*keys)
        except Exception:
            pass

    return product

@app.put("/products/{product_id}", response_model=ProductResponse)
async def update_product(product_id: int, p: ProductUpdate, db: AsyncSession = Depends(get_db), payload: dict = Depends(require_role("ADMIN"))):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalars().first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if p.name is not None: product.name = p.name
    if p.description is not None: product.description = p.description
    if p.price is not None: product.price = p.price
    if p.stock is not None: product.stock = p.stock
    if p.active is not None: product.active = p.active

    await db.commit()
    await db.refresh(product)

    if redis_client:
        try:
            keys = await redis_client.keys("products:*")
            if keys:
                await redis_client.delete(*keys)
        except Exception:
            pass

    return product

# Event Handlers (Kafka Event Bus)
async def handle_order_created_event(event: BaseEvent):
    if event.event_type != EventType.ORDER_CREATED:
        return
    logger.info(f"Inventory Service received OrderCreated event {event.event_id}")

    from shared.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        # Idempotency Check
        stmt = select(EventProcessed).where(
            EventProcessed.event_id == event.event_id,
            EventProcessed.consumer_service == "inventory_service"
        )
        res = await db.execute(stmt)
        if res.scalars().first():
            logger.info(f"Event {event.event_id} already processed by Inventory Service. Skipping.")
            return

        order_data = event.payload
        order_id = order_data["order_id"]
        customer_id = order_data["customer_id"]
        items = order_data["items"]

        # Transactional Concurrency Locking with FOR UPDATE
        try:
            items_reserved = []
            insufficient = False
            insufficient_reason = ""

            for item in items:
                p_id = item["product_id"]
                qty = item["quantity"]
                
                # PostgreSQL SELECT ... FOR UPDATE row-level lock
                stmt = select(Product).where(Product.id == p_id).with_for_update()
                result = await db.execute(stmt)
                product = result.scalars().first()

                if not product or product.stock < qty:
                    insufficient = True
                    insufficient_reason = f"Insufficient stock for product '{item['product_name']}' (available: {product.stock if product else 0}, requested: {qty})"
                    break
                
                # Atomic stock decrement inside transaction
                product.stock -= qty
                reservation = InventoryReservation(
                    reservation_id=f"res_{uuid.uuid4().hex[:12]}",
                    order_id=order_id,
                    product_id=p_id,
                    quantity=qty,
                    status="RESERVED"
                )
                db.add(reservation)
                items_reserved.append(reservation)

            if insufficient:
                await db.rollback()
                logger.warning(f"Inventory reservation failed for Order {order_id}: {insufficient_reason}")
                
                # Record idempotency record on separate commit
                async with AsyncSessionLocal() as idemp_db:
                    idemp_db.add(EventProcessed(
                        event_id=event.event_id,
                        consumer_service="inventory_service",
                        event_type=event.event_type.value
                    ))
                    await idemp_db.commit()

                # Publish InventoryRejected event
                rejected_event = BaseEvent(
                    event_type=EventType.INVENTORY_REJECTED,
                    producer="inventory_service",
                    correlation_id=event.correlation_id,
                    payload=InventoryRejectedPayload(
                        order_id=order_id,
                        customer_id=customer_id,
                        reason=insufficient_reason
                    ).model_dump()
                )
                if event_bus:
                    await event_bus.publish("scaleflow.inventory", rejected_event)
                return

            # Mark idempotency
            db.add(EventProcessed(
                event_id=event.event_id,
                consumer_service="inventory_service",
                event_type=event.event_type.value
            ))
            await db.commit()
            logger.info(f"Inventory successfully reserved for Order {order_id}.")

            # Invalidate Redis product cache after stock update
            if redis_client:
                try:
                    keys = await redis_client.keys("products:*")
                    if keys: await redis_client.delete(*keys)
                except Exception: pass

            # Publish InventoryReserved event
            reserved_event = BaseEvent(
                event_type=EventType.INVENTORY_RESERVED,
                producer="inventory_service",
                correlation_id=event.correlation_id,
                payload=InventoryReservedPayload(
                    order_id=order_id,
                    customer_id=customer_id,
                    total_amount=order_data["total_amount"],
                    items=[OrderItemPayload(**it) for it in items],
                    reservation_id=items_reserved[0].reservation_id if items_reserved else "res_0"
                ).model_dump()
            )
            if event_bus:
                await event_bus.publish("scaleflow.inventory", reserved_event)

        except Exception as e:
            await db.rollback()
            logger.error(f"Error executing inventory reservation for order {order_id}: {e}", exc_info=True)

async def handle_payment_event(event: BaseEvent):
    if event.event_type != EventType.PAYMENT_FAILED:
        return
    logger.info(f"Inventory Service handling Saga compensation for PaymentFailed event {event.event_id}")

    from shared.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        order_id = event.payload.get("order_id")
        if not order_id: return

        # Find reservations and release stock
        stmt = select(InventoryReservation).where(
            InventoryReservation.order_id == order_id,
            InventoryReservation.status == "RESERVED"
        )
        res = await db.execute(stmt)
        reservations = res.scalars().all()

        for reservation in reservations:
            # Row lock product to restore stock safely
            prod_stmt = select(Product).where(Product.id == reservation.product_id).with_for_update()
            p_res = await db.execute(prod_stmt)
            product = p_res.scalars().first()
            if product:
                product.stock += reservation.quantity
            reservation.status = "RELEASED"

        await db.commit()
        logger.info(f"[Saga Compensation] Stock released for failed order {order_id}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
