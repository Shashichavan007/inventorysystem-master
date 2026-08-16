import logging
import json
from datetime import datetime, timezone
import contextvars

# Contextvar to hold correlation_id per task/request
correlation_id_ctx: contextvars.ContextVar[str] = contextvars.ContextVar("correlation_id", default="N/A")

class JSONCorrelationFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_obj = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "correlation_id": correlation_id_ctx.get(),
        }
        if record.exc_info:
            log_obj["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_obj)

def setup_logger(service_name: str) -> logging.Logger:
    logger = logging.getLogger(f"scaleflow.{service_name}")
    logger.setLevel(logging.INFO)
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(JSONCorrelationFormatter())
        logger.addHandler(handler)
    return logger
