# ScaleFlow — Interview Talking Points & System Design Q&A

These 10 interview questions and answers reflect the exact implementation of ScaleFlow.

---

### Q1: How do you prevent race conditions and overselling when 10,000 users buy 5 remaining items?
**Answer**: ScaleFlow uses PostgreSQL transactional row-level locking via `SELECT stock FROM products WHERE id = :id FOR UPDATE`. Within the transaction, the database locks the row, verifies `stock >= requested`, decrements stock atomically, and records an `InventoryReservation`. If stock is insufficient, the transaction rolls back and emits an `InventoryRejected` event. Stock never becomes negative.

---

### Q2: How do you handle idempotency in Kafka consumers?
**Answer**: Every Kafka message contains an `event_id`. Before processing, the consumer queries the `events_processed` table for `(event_id, consumer_service)`. If present, the consumer skips processing. If absent, it processes the event and commits the idempotency record inside the database transaction.

---

### Q3: Why use Saga Pattern instead of Two-Phase Commit (2PC)?
**Answer**: 2PC introduces blocking database locks across microservice network boundaries, degrading throughput and causing cascading failures. ScaleFlow uses an asynchronous Saga with compensating transactions: if Payment fails after Inventory is reserved, a `PaymentFailed` event triggers the Inventory service to release reserved stock.

---

### Q4: How is distributed tracing implemented across microservices?
**Answer**: ScaleFlow generates an `X-Correlation-ID` header at the API Gateway (or reuses the incoming client header). This ID is injected into Python `contextvars`, attached to all HTTP requests and Kafka event headers, and formatted into JSON structured logs.

---

### Q5: How do you handle consumer processing failures without dropping events?
**Answer**: ScaleFlow implements a retry mechanism (3 attempts with exponential backoff). If processing fails repeatedly, the event is wrapped in a `DLQEvent` and published to topic `scaleflow.dlq`, while also persisting into the `dlq_events` table for admin inspection.

---

### Q6: How is API rate limiting implemented?
**Answer**: The API Gateway uses a Redis sliding-window algorithm (`ZADD` timestamp score + `ZREMRANGEBYSCORE`). Anonymous users are capped at 30 req/min, authenticated customers at 100 req/min, and admins at 300 req/min. Requests breaching the threshold receive HTTP `429 Too Many Requests`.

---

### Q7: How does Redis caching work for the product catalog?
**Answer**: Product queries check Redis key `products:cat_{id}:search_{query}`. On cache hit, data is returned instantly (sub-millisecond). On product updates or stock adjustments, cache keys matching `products:*` are invalidated.

---

### Q8: How do WebSockets deliver real-time order tracking?
**Answer**: Order Service exposes `/ws/orders/{order_id}`. When Kafka events update order status (`CREATED` → `INVENTORY_RESERVED` → `CONFIRMED`), the Order Service broadcasts JSON status pushes to connected WebSocket clients.

---

### Q9: How are Prometheus metrics collected?
**Answer**: Microservices expose `/metrics` endpoints using `prometheus-client`. The API Gateway records request rate and latency histograms (`scaleflow_gateway_request_duration_seconds`), while Analytics Service tracks revenue and event counters.

---

### Q10: How do you ensure high availability and scalability?
**Answer**: All microservices are stateless and containerized. Kubernetes deployment manifests configure `HorizontalPodAutoscaler` (HPA) targeting 70% CPU utilization, scaling pod replicas dynamically.
