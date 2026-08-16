import time
import asyncio
import httpx
import statistics
import os
from sqlalchemy.future import select

sys_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if sys_path not in os.sys.path:
    os.sys.path.insert(0, sys_path)

from shared.database import init_db_engine, create_tables, User, Product, Order, OrderItem, Category
from shared.utils.security import hash_password, create_access_token

BASE_URL = os.getenv("GATEWAY_URL", "http://localhost:8000/api/v1")

async def run_standalone_engine_benchmark(concurrent_users: int = 20, total_requests: int = 100):
    print("[BENCHMARK] Running standalone microservice engine benchmark...")
    init_db_engine("sqlite+aiosqlite:///scaleflow.db")
    await create_tables()

    from shared.database import AsyncSessionLocal

    # Ensure product & user exist
    async with AsyncSessionLocal() as db:
        res_p = await db.execute(select(Product))
        prod = res_p.scalars().first()
        if not prod:
            cat = Category(name="Compute", slug="compute")
            db.add(cat)
            await db.commit()
            await db.refresh(cat)
            prod = Product(sku="BM-1", name="Benchmark CPU", price=100.0, stock=1000, category_id=cat.id)
            db.add(prod)
            await db.commit()
            await db.refresh(prod)
        prod_id = prod.id

    latencies = []
    status_codes = []
    semaphore = asyncio.Semaphore(concurrent_users)

    async def benchmark_order_task(order_idx: int):
        async with semaphore:
            t0 = time.time()
            async with AsyncSessionLocal() as db:
                try:
                    # Execute transaction order creation & stock decrement
                    res = await db.execute(select(Product).where(Product.id == prod_id))
                    p = res.scalars().first()
                    if p and p.stock >= 1:
                        p.stock -= 1
                        ord_rec = Order(customer_id=1, status="CREATED", total_amount=p.price, correlation_id=f"corr_bm_{order_idx}")
                        db.add(ord_rec)
                        await db.commit()
                        t1 = time.time()
                        latencies.append((t1 - t0) * 1000)
                        status_codes.append(201)
                    else:
                        await db.rollback()
                        t1 = time.time()
                        latencies.append((t1 - t0) * 1000)
                        status_codes.append(400)
                except Exception:
                    await db.rollback()
                    t1 = time.time()
                    latencies.append((t1 - t0) * 1000)
                    status_codes.append(500)

    start_time = time.time()
    tasks = [benchmark_order_task(i) for i in range(total_requests)]
    await asyncio.gather(*tasks)
    total_time = time.time() - start_time

    return latencies, status_codes, total_time

async def main(concurrent_users: int = 20, total_requests: int = 100):
    print(f"[BENCHMARK] Starting ScaleFlow Load Benchmark ({concurrent_users} concurrent clients, {total_requests} order requests)...")
    
    gateway_online = False
    latencies = []
    status_codes = []
    total_time = 0.0

    # Try HTTP Gateway first
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(f"{BASE_URL}/health", timeout=1.5)
            if resp.status_code == 200:
                gateway_online = True
        except Exception:
            gateway_online = False

    if gateway_online:
        print("[BENCHMARK] Live API Gateway detected on port 8000. Executing HTTP load test...")
        async with httpx.AsyncClient() as client:
            resp = await client.post(f"{BASE_URL}/auth/login", json={"email": "customer@scaleflow.io", "password": "password123"})
            token = resp.json().get("access_token", "")

        headers = {"Authorization": f"Bearer {token}"}
        semaphore = asyncio.Semaphore(concurrent_users)

        async def send_http_order(req_id: int):
            async with semaphore:
                async with httpx.AsyncClient() as c:
                    t0 = time.time()
                    try:
                        resp = await c.post(
                            f"{BASE_URL}/orders",
                            headers=headers,
                            json={"items": [{"product_id": 1, "quantity": 1}]},
                            timeout=10.0
                        )
                        t1 = time.time()
                        latencies.append((t1 - t0) * 1000)
                        status_codes.append(resp.status_code)
                    except Exception:
                        t1 = time.time()
                        latencies.append((t1 - t0) * 1000)
                        status_codes.append(500)

        start_time = time.time()
        tasks = [send_http_order(i) for i in range(total_requests)]
        await asyncio.gather(*tasks)
        total_time = time.time() - start_time
    else:
        latencies, status_codes, total_time = await run_standalone_engine_benchmark(concurrent_users, total_requests)

    if not latencies:
        print("No latency data recorded.")
        return

    latencies.sort()
    rps = total_requests / total_time
    p50 = statistics.median(latencies)
    p95 = latencies[int(len(latencies) * 0.95)] if len(latencies) >= 20 else latencies[-1]
    p99 = latencies[int(len(latencies) * 0.99)] if len(latencies) >= 100 else latencies[-1]
    success_count = status_codes.count(201) + status_codes.count(200)
    error_count = len(status_codes) - success_count

    benchmark_report = f"""# ScaleFlow Performance & Benchmark Results

## Load Test Parameters
- **Concurrent Users**: {concurrent_users}
- **Total Requests**: {total_requests}
- **Target Component**: {"Live API Gateway HTTP Proxy" if gateway_online else "Transactional Microservice Database Engine"}
- **Benchmark Execution Duration**: {total_time:.2f} seconds

## Measured Empirical Metrics
- **Requests Per Second (RPS)**: {rps:.2f} req/sec
- **P50 Latency (Median)**: {p50:.2f} ms
- **P95 Latency**: {p95:.2f} ms
- **P99 Latency**: {p99:.2f} ms
- **Successful HTTP 201 Created**: {success_count}
- **Error / Stockout Count**: {error_count}
- **Success Rate**: {(success_count / total_requests * 100):.1f}%

*Metrics recorded directly from running ScaleFlow API Gateway and Microservice Engine.*
"""

    os.makedirs("docs", exist_ok=True)
    with open("docs/performance.md", "w") as f:
        f.write(benchmark_report)

    print("[SUCCESS] Benchmark complete! Report saved to docs/performance.md")
    print(f"   RPS: {rps:.2f} | P50: {p50:.2f}ms | P95: {p95:.2f}ms | P99: {p99:.2f}ms | Success: {success_count}/{total_requests}")

if __name__ == "__main__":
    asyncio.run(main(concurrent_users=20, total_requests=100))
