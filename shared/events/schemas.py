import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

class EventType(str, Enum):
    ORDER_CREATED = "OrderCreated"
    INVENTORY_RESERVED = "InventoryReserved"
    INVENTORY_REJECTED = "InventoryRejected"
    PAYMENT_REQUESTED = "PaymentRequested"
    PAYMENT_SUCCEEDED = "PaymentSucceeded"
    PAYMENT_FAILED = "PaymentFailed"
    ORDER_CONFIRMED = "OrderConfirmed"
    ORDER_CANCELLED = "OrderCancelled"
    SHIPMENT_CREATED = "ShipmentCreated"
    DLQ_EVENT = "DLQEvent"

class BaseEvent(BaseModel):
    event_id: str = Field(default_factory=lambda: f"evt_{uuid.uuid4().hex[:12]}")
    event_type: EventType
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    correlation_id: str = Field(default_factory=lambda: f"corr_{uuid.uuid4().hex[:12]}")
    producer: str
    payload: Dict[str, Any]

class OrderItemPayload(BaseModel):
    product_id: int
    product_name: str
    quantity: int
    unit_price: float

class OrderCreatedPayload(BaseModel):
    order_id: int
    customer_id: int
    total_amount: float
    items: List[OrderItemPayload]
    created_at: str

class InventoryReservedPayload(BaseModel):
    order_id: int
    customer_id: int
    total_amount: float
    items: List[OrderItemPayload]
    reservation_id: str

class InventoryRejectedPayload(BaseModel):
    order_id: int
    customer_id: int
    reason: str

class PaymentRequestedPayload(BaseModel):
    order_id: int
    customer_id: int
    amount: float
    payment_method: str = "MOCK_CARD"

class PaymentSucceededPayload(BaseModel):
    order_id: int
    customer_id: int
    payment_id: str
    amount: float
    transaction_id: str

class PaymentFailedPayload(BaseModel):
    order_id: int
    customer_id: int
    reason: str
    attempt_count: int = 1

class OrderConfirmedPayload(BaseModel):
    order_id: int
    customer_id: int
    confirmed_at: str

class OrderCancelledPayload(BaseModel):
    order_id: int
    customer_id: int
    reason: str
    cancelled_at: str

class DLQEventPayload(BaseModel):
    original_event_id: str
    original_event_type: str
    original_topic: str
    failure_reason: str
    retry_count: int
    last_error: str
    payload: Dict[str, Any]
