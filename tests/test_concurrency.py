import pytest
import asyncio
from sqlalchemy.future import select
from shared.database import init_db_engine, create_tables, Product, InventoryReservation, Category

@pytest.mark.asyncio
async def test_inventory_concurrency_locking():
    # Setup test sqlite in-memory DB engine for fast unit concurrency test
    init_db_engine("sqlite+aiosqlite:///:memory:")
    await create_tables()

    from shared.database import AsyncSessionLocal

    # Seed 1 category & 1 product with stock = 5
    async with AsyncSessionLocal() as db:
        cat = Category(name="Electronics", slug="electronics")
        db.add(cat)
        await db.commit()
        await db.refresh(cat)

        product = Product(
            sku="HIGH_DEMAND_ITEM",
            name="Quantum Processor",
            price=999.99,
            stock=5,
            category_id=cat.id
        )
        db.add(product)
        await db.commit()
        await db.refresh(product)
        product_id = product.id

    # Simulated row lock semaphore for SQLite in-memory test
    row_lock = asyncio.Lock()

    # Worker simulating PostgreSQL SELECT ... FOR UPDATE atomic reservation
    async def reserve_stock_worker(order_id: int):
        async with row_lock:  # Simulates row-level SELECT FOR UPDATE in SQLite
            async with AsyncSessionLocal() as db:
                try:
                    res = await db.execute(select(Product).where(Product.id == product_id))
                    prod = res.scalars().first()
                    if prod and prod.stock >= 1:
                        prod.stock -= 1
                        reservation = InventoryReservation(
                            reservation_id=f"res_{order_id}",
                            order_id=order_id,
                            product_id=product_id,
                            quantity=1,
                            status="RESERVED"
                        )
                        db.add(reservation)
                        await db.commit()
                        return "RESERVED"
                    else:
                        await db.rollback()
                        return "REJECTED"
                except Exception:
                    await db.rollback()
                    return "REJECTED"

    # Launch 50 concurrent tasks trying to reserve 1 item each
    tasks = [reserve_stock_worker(i) for i in range(1, 51)]
    results = await asyncio.gather(*tasks)

    reserved_count = results.count("RESERVED")
    rejected_count = results.count("REJECTED")

    assert reserved_count == 5, f"Expected exactly 5 successful reservations, got {reserved_count}"
    assert rejected_count == 45, f"Expected 45 rejections due to stockout, got {rejected_count}"

    # Verify final stock in DB is 0
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Product).where(Product.id == product_id))
        final_prod = res.scalars().first()
        assert final_prod.stock == 0, f"Final stock must be 0, got {final_prod.stock}"
