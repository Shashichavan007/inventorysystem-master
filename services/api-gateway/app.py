import os
import sys
import uuid
import time
from typing import Optional
from fastapi import FastAPI, Request, Response, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, JSONResponse
import httpx
import redis.asyncio as aioredis
from prometheus_client import Counter, Histogram, generate_latest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from shared.config import settings
from shared.utils.logging import setup_logger, correlation_id_ctx
from shared.utils.security import decode_token

logger = setup_logger("api_gateway")
app = FastAPI(title="ScaleFlow API Gateway", version="1.0.0")

# CORS Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Prometheus Gateway Metrics
GATEWAY_REQUESTS_TOTAL = Counter(
    "scaleflow_gateway_requests_total",
    "Total HTTP requests routed through API Gateway",
    ["method", "path_group", "status_code"]
)

GATEWAY_REQUEST_LATENCY = Histogram(
    "scaleflow_gateway_request_duration_seconds",
    "Request latency histogram for API Gateway",
    ["path_group"],
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0]
)

redis_client: Optional[aioredis.Redis] = None
http_client: Optional[httpx.AsyncClient] = None

@app.on_event("startup")
async def startup_event():
    global redis_client, http_client
    http_client = httpx.AsyncClient(timeout=30.0)
    try:
        redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        await redis_client.ping()
        logger.info("API Gateway connected to Redis for rate limiting.")
    except Exception as e:
        logger.warning(f"Redis unavailable for API Gateway rate limiter: {e}")
        redis_client = None

@app.on_event("shutdown")
async def shutdown_event():
    if http_client:
        await http_client.aclose()
    if redis_client:
        await redis_client.close()

# Rate Limiter Helper (Redis Sliding Window)
async def check_rate_limit(client_identifier: str, limit: int, window_sec: int = 60) -> bool:
    if not redis_client:
        return True  # Bypass if Redis not running
    try:
        key = f"rate_limit:{client_identifier}"
        now = time.time()
        pipeline = redis_client.pipeline()
        pipeline.zremrangebyscore(key, 0, now - window_sec)
        pipeline.zadd(key, {str(now): now})
        pipeline.zcard(key)
        pipeline.expire(key, window_sec)
        results = await pipeline.execute()
        request_count = results[2]
        return request_count <= limit
    except Exception as e:
        logger.error(f"Rate limiting check failed: {e}")
        return True

# Gateway Middleware: Correlation ID & Rate Limiting & Auth Header Propagation
@app.middleware("http")
async def gateway_middleware(request: Request, call_next):
    start_time = time.time()
    
    # 1. Correlation ID Handling
    corr_id = request.headers.get("X-Correlation-ID", f"corr_{uuid.uuid4().hex[:12]}")
    correlation_id_ctx.set(corr_id)

    # Health check bypass
    if request.url.path in ["/health", "/metrics"]:
        response = await call_next(request)
        response.headers["X-Correlation-ID"] = corr_id
        return response

    # 2. JWT Validation & User Extraction
    user_id = "anonymous"
    user_role = "ANONYMOUS"
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            payload = decode_token(token)
            user_id = str(payload.get("sub", "anonymous"))
            user_role = str(payload.get("role", "CUSTOMER"))
        except Exception:
            pass  # Let downstream authentication handle invalid tokens if necessary

    # 3. Rate Limiting Limits based on Role
    rate_limit = 30  # Anonymous limit
    if user_role == "CUSTOMER":
        rate_limit = 100
    elif user_role == "ADMIN":
        rate_limit = 300

    client_ip = request.client.host if request.client else "127.0.0.1"
    rate_key = f"{user_role}:{user_id if user_id != 'anonymous' else client_ip}"
    
    allowed = await check_rate_limit(rate_key, limit=rate_limit)
    if not allowed:
        logger.warning(f"Rate limit exceeded for key {rate_key} (Limit: {rate_limit}/min)")
        GATEWAY_REQUESTS_TOTAL.labels(method=request.method, path_group="rate_limited", status_code=429).inc()
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={"detail": f"Rate limit exceeded ({rate_limit} requests/min limit). Try again in 60 seconds."},
            headers={"Retry-After": "60", "X-Correlation-ID": corr_id}
        )

    response = await call_next(request)
    duration = time.time() - start_time
    
    path_group = request.url.path.split("/")[3] if len(request.url.path.split("/")) > 3 else "root"
    GATEWAY_REQUESTS_TOTAL.labels(method=request.method, path_group=path_group, status_code=response.status_code).inc()
    GATEWAY_REQUEST_LATENCY.labels(path_group=path_group).observe(duration)
    
    response.headers["X-Correlation-ID"] = corr_id
    return response

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "api-gateway"}

@app.get("/metrics", response_class=PlainTextResponse)
async def metrics():
    return generate_latest()

# Generic Reverse Proxy Routing Helper
async def proxy_request(service_url: str, request: Request, path: str) -> Response:
    url = f"{service_url}{path}"
    if request.query_params:
        url += f"?{request.query_params}"

    headers = dict(request.headers)
    headers["X-Correlation-ID"] = correlation_id_ctx.get()
    headers.pop("host", None)

    body = await request.body()
    try:
        upstream_resp = await http_client.request(
            method=request.method,
            url=url,
            headers=headers,
            content=body
        )
        return Response(
            content=upstream_resp.content,
            status_code=upstream_resp.status_code,
            headers=dict(upstream_resp.headers)
        )
    except httpx.RequestError as exc:
        logger.error(f"Failed to proxy request to {url}: {exc}")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"detail": f"Upstream service unavailable at {service_url}"}
        )

# Route Mappings
@app.api_route("/api/v1/auth/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def auth_proxy(request: Request, path: str):
    return await proxy_request(settings.AUTH_SERVICE_URL, request, f"/{path}")

@app.api_route("/api/v1/products/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def products_proxy(request: Request, path: str):
    return await proxy_request(settings.INVENTORY_SERVICE_URL, request, f"/products/{path}")

@app.api_route("/api/v1/products", methods=["GET", "POST"])
async def products_root_proxy(request: Request):
    return await proxy_request(settings.INVENTORY_SERVICE_URL, request, "/products")

@app.api_route("/api/v1/categories/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def categories_proxy(request: Request, path: str):
    return await proxy_request(settings.INVENTORY_SERVICE_URL, request, f"/categories/{path}")

@app.api_route("/api/v1/categories", methods=["GET", "POST"])
async def categories_root_proxy(request: Request):
    return await proxy_request(settings.INVENTORY_SERVICE_URL, request, "/categories")

@app.api_route("/api/v1/orders/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def orders_proxy(request: Request, path: str):
    return await proxy_request(settings.ORDER_SERVICE_URL, request, f"/orders/{path}")

@app.api_route("/api/v1/orders", methods=["GET", "POST"])
async def orders_root_proxy(request: Request):
    return await proxy_request(settings.ORDER_SERVICE_URL, request, "/orders")

@app.api_route("/api/v1/simulation/{path:path}", methods=["GET", "POST"])
async def simulation_proxy(request: Request, path: str):
    return await proxy_request(settings.PAYMENT_SERVICE_URL, request, f"/simulation/{path}")

@app.api_route("/api/v1/simulation", methods=["GET", "POST"])
async def simulation_root_proxy(request: Request):
    return await proxy_request(settings.PAYMENT_SERVICE_URL, request, "/simulation")

@app.api_route("/api/v1/dlq/{path:path}", methods=["GET", "POST"])
async def dlq_proxy(request: Request, path: str):
    return await proxy_request(settings.PAYMENT_SERVICE_URL, request, f"/dlq/{path}")

@app.api_route("/api/v1/dlq", methods=["GET"])
async def dlq_root_proxy(request: Request):
    return await proxy_request(settings.PAYMENT_SERVICE_URL, request, "/dlq")

@app.api_route("/api/v1/notifications/{path:path}", methods=["GET", "POST"])
async def notifications_proxy(request: Request, path: str):
    return await proxy_request(settings.NOTIFICATION_SERVICE_URL, request, f"/notifications/{path}")

@app.api_route("/api/v1/notifications", methods=["GET"])
async def notifications_root_proxy(request: Request):
    return await proxy_request(settings.NOTIFICATION_SERVICE_URL, request, "/notifications")

@app.api_route("/api/v1/analytics/{path:path}", methods=["GET"])
async def analytics_proxy(request: Request, path: str):
    return await proxy_request(settings.ANALYTICS_SERVICE_URL, request, f"/analytics/{path}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
