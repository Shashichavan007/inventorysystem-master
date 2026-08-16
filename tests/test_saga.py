import pytest
import asyncio
from sqlalchemy.future import select
from shared.database import init_db_engine, create_tables, Product, Category, InventoryReservation, Order

@pytest.mark.asyncio
async def test_order_saga_compensation():
    init_db_engine("sqlite+aiosqlite:///:memory:")
    await create_tables()

    from shared.database import AsyncSessionLocal

    # 1. Setup Product with stock = 10
    async with AsyncSessionLocal() as db:
        cat = Category(name="Gear", slug="gear")
        db.add(cat)
        await db.commit()
        await db.refresh(cat)

        prod = Product(sku="SAGA_ITEM", name="Saga Test Item", price=100.0, stock=10, category_id=cat.id)
        db.add(prod)
        await db.commit()
        await db.refresh(prod)
        prod_id = prod.id

        order = Order(customer_id=1, status="CREATED", total_amount=100.0, correlation_id="corr_saga")
        db.add(order)
        await db.commit()
        await db.refresh(order)
        order_id = order.id

    # 2. Step 1: Inventory Reserved (Stock decremented from 10 to 8)
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Product).where(Product.id == prod_id))
        p = res.scalars().first()
        p.stock -= 2
        
        reservation = InventoryReservation(
            reservation_id="res_saga_1",
            order_id=order_id,
            product_id=prod_id,
            quantity=2,
            status="RESERVED"
        )
        db.add(reservation)

        ord_res = await db.execute(select(Order).where(Order.id == order_id))
        o = ord_res.scalars().first()
        o.status = "INVENTORY_RESERVED"

        await db.commit()

    # Verify intermediate state
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Product).where(Product.id == prod_id))
        assert res.scalars().first().stock == 8

    # 3. Step 2: Payment Fails -> Trigger Saga Compensation
    async with AsyncSessionLocal() as db:
        # Find reserved inventory for order
        stmt = select(InventoryReservation).where(
            InventoryReservation.order_id == order_id,
            InventoryReservation.status == "RESERVED"
        )
        res = await db.execute(stmt)
        reservations = res.scalars().all()

        # Compensate: restore stock & mark reservation RELEASED
        for reservation in reservations:
            p_res = await db.execute(select(Product).where(Product.id == reservation.product_id))
            p = p_res.scalars().first()
            p.stock += reservation.quantity
            reservation.status = "RELEASED"

        # Update order status to CANCELLED
        ord_res = await db.execute(select(Order).where(Order.id == order_id))
        o = ord_res.scalars().first()
        o.status = "CANCELLED"

        await db.commit()

    # 4. Verify Final Compensated State
    async with AsyncSessionLocal() as db:
        res_prod = await db.execute(select(Product).where(Product.id == prod_id))
        final_stock = res_prod.scalars().first().stock
        assert final_stock == 10, f"Expected stock restored to 10, got {final_stock}"

        res_order = await db.execute(select(Order).where(Order.id == order_id))
        final_status = res_order.scalars().first().status
        assert final_status == "CANCELLED", f"Expected order status CANCELLED, got {final_status}"
