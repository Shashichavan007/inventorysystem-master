import json
import asyncio
import logging
from abc import ABC, abstractmethod
from typing import Callable, Dict, List, Optional, Any
from shared.config import settings
from shared.events.schemas import BaseEvent, BaseEvent

logger = logging.getLogger("scaleflow.event_bus")

class EventBus(ABC):
    @abstractmethod
    async def start(self) -> None:
        pass

    @abstractmethod
    async def stop(self) -> None:
        pass

    @abstractmethod
    async def publish(self, topic: str, event: BaseEvent) -> None:
        pass

    @abstractmethod
    async def subscribe(self, topic: str, handler: Callable[[BaseEvent], Any]) -> None:
        pass

class InMemoryEventBus(EventBus):
    """
    In-memory event bus ONLY permitted for unit tests or explicit DEV_MODE=in_memory.
    """
    def __init__(self):
        self.handlers: Dict[str, List[Callable[[BaseEvent], Any]]] = {}
        self.published_events: List[BaseEvent] = []
        self._running = False

    async def start(self) -> None:
        self._running = True
        logger.info("[InMemoryEventBus] Started (DEV_MODE=in_memory active).")

    async def stop(self) -> None:
        self._running = False
        logger.info("[InMemoryEventBus] Stopped.")

    async def publish(self, topic: str, event: BaseEvent) -> None:
        self.published_events.append(event)
        logger.info(f"[InMemoryEventBus] Published to '{topic}': {event.event_type} (id={event.event_id}, corr_id={event.correlation_id})")
        if topic in self.handlers:
            for handler in self.handlers[topic]:
                try:
                    if asyncio.iscoroutinefunction(handler):
                        await handler(event)
                    else:
                        handler(event)
                except Exception as e:
                    logger.error(f"[InMemoryEventBus] Error in handler for topic {topic}: {e}", exc_info=True)

    async def subscribe(self, topic: str, handler: Callable[[BaseEvent], Any]) -> None:
        if topic not in self.handlers:
            self.handlers[topic] = []
        self.handlers[topic].append(handler)
        logger.info(f"[InMemoryEventBus] Subscribed handler to '{topic}'")

class KafkaEventBus(EventBus):
    """
    Authoritative Apache Kafka Event Bus using aiokafka.
    Fails startup with explicit RuntimeError if Kafka broker is unreachable
    and DEV_MODE=in_memory is not set.
    """
    def __init__(self, client_id: str, group_id: Optional[str] = None):
        self.client_id = client_id
        self.group_id = group_id or f"group_{client_id}"
        self.bootstrap_servers = settings.KAFKA_BOOTSTRAP_SERVERS
        self.producer = None
        self.consumer = None
        self.subscriptions: Dict[str, List[Callable[[BaseEvent], Any]]] = {}
        self._consume_task: Optional[asyncio.Task] = None
        self._running = False

    async def start(self) -> None:
        try:
            from aiokafka import AIOKafkaProducer, AIOKafkaConsumer
            logger.info(f"[KafkaEventBus] Connecting producer to Kafka at {self.bootstrap_servers}...")
            self.producer = AIOKafkaProducer(
                bootstrap_servers=self.bootstrap_servers,
                client_id=self.client_id,
                value_serializer=lambda v: json.dumps(v).encode("utf-8")
            )
            await self.producer.start()
            self._running = True
            logger.info(f"[KafkaEventBus] Producer connected successfully for service '{self.client_id}'.")
        except Exception as e:
            msg = (
                f"\n====================================================================\n"
                f"CRITICAL ERROR: Failed to connect to Apache Kafka at '{self.bootstrap_servers}'.\n"
                f"Kafka is the authoritative event bus for ScaleFlow production architecture.\n"
                f"Details: {str(e)}\n"
                f"If you are running isolated unit tests or off-line development, explicitly set\n"
                f"environment variable: DEV_MODE=in_memory\n"
                f"====================================================================\n"
            )
            logger.critical(msg)
            if settings.DEV_MODE == "in_memory":
                logger.warning("[KafkaEventBus] DEV_MODE=in_memory detected. Falling back ONLY because explicit override was requested.")
                raise e
            raise RuntimeError(msg) from e

    async def stop(self) -> None:
        self._running = False
        if self._consume_task:
            self._consume_task.cancel()
            try:
                await self._consume_task
            except asyncio.CancelledError:
                pass
        if self.producer:
            await self.producer.stop()
        if self.consumer:
            await self.consumer.stop()
        logger.info(f"[KafkaEventBus] Stopped service '{self.client_id}'.")

    async def publish(self, topic: str, event: BaseEvent) -> None:
        if not self.producer:
            raise RuntimeError("KafkaEventBus producer is not started!")
        event_dict = event.model_dump()
        await self.producer.send_and_wait(topic, event_dict)
        logger.info(f"[KafkaEventBus] Published to topic '{topic}': {event.event_type} (id={event.event_id}, corr={event.correlation_id})")

    async def subscribe(self, topic: str, handler: Callable[[BaseEvent], Any]) -> None:
        if topic not in self.subscriptions:
            self.subscriptions[topic] = []
        self.subscriptions[topic].append(handler)
        logger.info(f"[KafkaEventBus] Registered handler for topic '{topic}'")

    async def start_consumer(self, topics: List[str]) -> None:
        if not topics:
            return
        from aiokafka import AIOKafkaConsumer
        logger.info(f"[KafkaEventBus] Starting consumer group '{self.group_id}' for topics {topics}...")
        self.consumer = AIOKafkaConsumer(
            *topics,
            bootstrap_servers=self.bootstrap_servers,
            group_id=self.group_id,
            client_id=f"{self.client_id}_consumer",
            auto_offset_reset="earliest",
            enable_auto_commit=True,
            value_deserializer=lambda m: json.loads(m.decode("utf-8"))
        )
        await self.consumer.start()
        self._consume_task = asyncio.create_task(self._consume_loop())

    async def _consume_loop(self) -> None:
        try:
            async for msg in self.consumer:
                topic = msg.topic
                val = msg.value
                try:
                    event = BaseEvent(**val)
                    logger.info(f"[KafkaEventBus] Consumed event '{event.event_type}' from topic '{topic}' (id={event.event_id})")
                    if topic in self.subscriptions:
                        for handler in self.subscriptions[topic]:
                            if asyncio.iscoroutinefunction(handler):
                                await handler(event)
                            else:
                                handler(event)
                except Exception as ex:
                    logger.error(f"[KafkaEventBus] Error processing message on topic '{topic}': {ex}", exc_info=True)
        except asyncio.CancelledError:
            pass
        except Exception as ex:
            logger.error(f"[KafkaEventBus] Consumer loop crashed: {ex}", exc_info=True)

def create_event_bus(service_name: str, group_id: Optional[str] = None) -> EventBus:
    if settings.DEV_MODE == "in_memory":
        logger.info(f"[EventBus] Creating InMemoryEventBus for service '{service_name}' (DEV_MODE=in_memory).")
        return InMemoryEventBus()
    logger.info(f"[EventBus] Creating KafkaEventBus for service '{service_name}'.")
    return KafkaEventBus(client_id=service_name, group_id=group_id)
