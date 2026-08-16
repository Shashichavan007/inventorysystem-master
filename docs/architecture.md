# ScaleFlow — System Architecture & Design Decisions

## 1. Executive Summary
ScaleFlow is a distributed, event-driven commerce platform designed to handle high-concurrency order placement, safe stock reservations, idempotent payment processing, and real-time order tracking.

---

## 2. Core Architectural Principles

### 2.1 Why Microservices over Monolith?
- **Domain Isolation**: Order placement, inventory locking, payment settlement, and analytical reporting evolve independently.
- **Independent Scalability**: High checkout volume scales `order-service` and `inventory-service` horizontally without over-provisioning notification or analytics workers.
- **Fault Isolation**: A payment gateway timeout or third-party outage does not bring down catalog browsing or order registration.

### 2.2 Why Apache Kafka for Event Bus?
- **Durability & Replayability**: Events are persisted to partitioned append-only logs. Consumer groups can reprocess historical events for audit recovery.
- **Decoupled Asynchronous Saga**: Order creation is non-blocking. The API Gateway responds immediately after publishing `OrderCreated`, delegating inventory reservation and payment processing to asynchronous Kafka consumers.

### 2.3 Why PostgreSQL for Concurrency Locking?
- **ACID Guarantee**: Transactions require strong consistency. Stock decrements use PostgreSQL row-level locks (`SELECT ... FOR UPDATE`) to prevent negative inventory under simultaneous checkout attempts.
- **Idempotency Persistence**: The `events_processed` table enforces unique constraint `(event_id, consumer_service)` to prevent duplicate event execution.

### 2.4 Why Redis for Caching & Rate Limiting?
- **Product Catalog Caching**: Frequent catalog reads hit sub-millisecond Redis cache. Cache invalidation clears entries on product updates.
- **Sliding-Window Rate Limiting**: Protects API Gateway against DDOS and resource exhaustion using Redis sorted sets (`ZADD`, `ZREMRANGEBYSCORE`).

### 2.5 Why WebSockets for Real-Time Status?
- Eliminates wasteful client HTTP polling. The `order-service` maintains WebSocket connections to clients and pushes state updates (`CREATED` → `INVENTORY_RESERVED` → `CONFIRMED` / `CANCELLED`) instantly.

---

## 3. Saga Pattern & Failure Compensation

```
Order Created
     │
     ▼ (OrderCreated Event)
Inventory Service ──► [SELECT FOR UPDATE Stock Decrement]
     │
     ├─► Stock Sufficient ──► (InventoryReserved) ──► Payment Service
     │                                                     │
     │                                                     ├─► Payment Success ──► Order CONFIRMED
     │                                                     │
     └─► Stock Out ──► (InventoryRejected)                 └─► Payment Fail ────► (PaymentFailed)
              │                                                                         │
              ▼                                                                         ▼
       Order CANCELLED                                                        Inventory RELEASED
                                                                              & Order CANCELLED
```

---

## 4. Dead Letter Queue (DLQ) & Retry Policy
1. Consumer attempts processing up to **3 times** with exponential backoff (`0.5s`, `1.0s`, `2.0s`).
2. If retries are exhausted, event is wrapped as `DLQEvent` and routed to Kafka topic `scaleflow.dlq`.
3. Event details and stack traces are logged into `dlq_events` database for admin inspection.
