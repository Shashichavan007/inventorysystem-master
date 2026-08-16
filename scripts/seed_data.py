import os
import sys
import asyncio
from sqlalchemy.future import select

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from shared.database import init_db_engine, create_tables, User, Product, Category
from shared.utils.security import hash_password

async def seed():
    init_db_engine()
    await create_tables()

    from shared.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        print("[+] Seeding ScaleFlow Database...")

        # 1. Seed Admin & Customer Users
        res_admin = await db.execute(select(User).where(User.email == "admin@scaleflow.io"))
        if not res_admin.scalars().first():
            admin = User(
                email="admin@scaleflow.io",
                password_hash=hash_password("password123"),
                full_name="ScaleFlow System Admin",
                role="ADMIN"
            )
            db.add(admin)
            print("  - Created Admin user: admin@scaleflow.io / password123")

        res_cust = await db.execute(select(User).where(User.email == "customer@scaleflow.io"))
        if not res_cust.scalars().first():
            customer = User(
                email="customer@scaleflow.io",
                password_hash=hash_password("password123"),
                full_name="Demo Customer",
                role="CUSTOMER"
            )
            db.add(customer)
            print("  - Created Customer user: customer@scaleflow.io / password123")

        # 2. Seed Categories
        categories_data = [
            {"name": "Microprocessors & Compute", "slug": "microprocessors"},
            {"name": "Distributed Storage & SSD", "slug": "storage"},
            {"name": "Network Switches & Fiber", "slug": "networking"},
            {"name": "Cloud Infrastructure", "slug": "cloud"}
        ]
        cat_map = {}
        for c in categories_data:
            res_c = await db.execute(select(Category).where(Category.slug == c["slug"]))
            existing_c = res_c.scalars().first()
            if not existing_c:
                new_c = Category(name=c["name"], slug=c["slug"])
                db.add(new_c)
                await db.commit()
                await db.refresh(new_c)
                cat_map[c["slug"]] = new_c.id
            else:
                cat_map[c["slug"]] = existing_c.id

        # 3. Seed Products
        products_data = [
            {
                "sku": "CPU-NV-H100-80G",
                "name": "NVIDIA H100 Tensor Core 80GB",
                "description": "High-density enterprise GPU accelerator for distributed AI/ML workloads.",
                "price": 29999.00,
                "stock": 25,
                "category_slug": "microprocessors"
            },
            {
                "sku": "CPU-AMD-EPYC-9654",
                "name": "AMD EPYC 9654 96-Core Processor",
                "description": "Server processor featuring 96 Zen 4 cores and 12-channel DDR5 support.",
                "price": 11805.00,
                "stock": 50,
                "category_slug": "microprocessors"
            },
            {
                "sku": "SSD-SN850X-4TB",
                "name": "Enterprise NVMe SSD 3.84TB PCIe 4.0",
                "description": "Low-latency NVMe solid state drive optimized for PostgreSQL write transactions.",
                "price": 499.99,
                "stock": 100,
                "category_slug": "storage"
            },
            {
                "sku": "NET-MELLANOX-400G",
                "name": "NVIDIA Quantum-2 400G InfiniBand Switch",
                "description": "Ultra-low latency switch engineered for distributed Kafka cluster traffic.",
                "price": 14500.00,
                "stock": 15,
                "category_slug": "networking"
            },
            {
                "sku": "MEM-DDR5-128GB",
                "name": "128GB DDR5 4800MHz ECC Registered RAM",
                "description": "Server memory module with error-correcting code for mission-critical nodes.",
                "price": 650.00,
                "stock": 200,
                "category_slug": "storage"
            },
            {
                "sku": "LIMITED-RARE-CHIP",
                "name": "Experimental Quantum Processing Unit (Limited 5 In Stock)",
                "description": "Limited supply QPU for concurrency race condition testing.",
                "price": 49999.00,
                "stock": 5,
                "category_slug": "microprocessors"
            }
        ]

        for p in products_data:
            res_p = await db.execute(select(Product).where(Product.sku == p["sku"]))
            if not res_p.scalars().first():
                prod = Product(
                    sku=p["sku"],
                    name=p["name"],
                    description=p["description"],
                    price=p["price"],
                    stock=p["stock"],
                    category_id=cat_map[p["category_slug"]]
                )
                db.add(prod)
                print(f"  - Created Product: {p['name']} (Stock: {p['stock']})")

        await db.commit()
        print("[SUCCESS] Database seeding completed successfully!")

if __name__ == "__main__":
    asyncio.run(seed())
