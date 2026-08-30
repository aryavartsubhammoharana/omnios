import sys
import logging
from typing import Dict, Any

class QuietPollingFilter(logging.Filter):
    IGNORED_ENDPOINTS = (
        "/api/upload/list",
        "/api/analytics/my-streak",
        "/api/classroom/list",
        "/api/classroom/2/posts",
        "/api/classroom/3/posts",
        "/api/classroom/2/students",
        "/api/classroom/3/students",
        "/api/quiz/list/",
        "/vite.svg",
        "/assets/",
        "/api/health",
        "/api/auth/me"
    )

    def filter(self, record: logging.LogRecord) -> bool:
        msg = record.getMessage()
        if "GET " in msg and (" 200 " in msg or " 200 OK" in msg or " 304 " in msg):
            if any(endpoint in msg for endpoint in self.IGNORED_ENDPOINTS):
                return False
        return True


def get_smart_log_config() -> Dict[str, Any]:
    return {
        "version": 1,
        "disable_existing_loggers": False,
        "filters": {
            "quiet_polling": {
                "()": "app.utils.smart_logger.QuietPollingFilter",
            },
        },
        "formatters": {
            "default": {
                "()": "uvicorn.logging.DefaultFormatter",
                "fmt": "%(levelprefix)s %(message)s",
                "use_colors": True,
            },
            "access": {
                "()": "uvicorn.logging.AccessFormatter",
                "fmt": '%(levelprefix)s %(client_addr)s - "%(request_line)s" %(status_code)s',
                "use_colors": True,
            },
        },
        "handlers": {
            "default": {
                "class": "logging.StreamHandler",
                "formatter": "default",
                "stream": "ext://sys.stderr",
            },
            "access": {
                "class": "logging.StreamHandler",
                "formatter": "access",
                "filters": ["quiet_polling"],
                "stream": "ext://sys.stderr",
            },
        },
        "loggers": {
            "uvicorn": {"handlers": ["default"], "level": "INFO", "propagate": False},
            "uvicorn.error": {"handlers": ["default"], "level": "INFO", "propagate": False},
            "uvicorn.access": {"handlers": ["access"], "level": "INFO", "propagate": False},
        },
    }


def setup_smart_logging():
    access_logger = logging.getLogger("uvicorn.access")
    quiet_filter = QuietPollingFilter()
    if not any(isinstance(f, QuietPollingFilter) for f in access_logger.filters):
        access_logger.addFilter(quiet_filter)