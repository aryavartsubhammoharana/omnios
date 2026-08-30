import sys
import re
import logging
from typing import Dict, Any

class DeduplicatingLogHandler(logging.Handler):
    def __init__(self, stream=None):
        super().__init__()
        self.stream = stream or sys.stdout
        self.last_key = None
        self.last_formatted = None
        self.repeat_count = 1
        self.in_carriage_return = False

    def emit(self, record):
        try:
            msg = self.format(record)
            key = re.sub(r"127\.0\.0\.1:\d+", "127.0.0.1", msg)
            key = re.sub(r"\[\d+\]", "", key)
            key_clean = re.sub(r"\x1b\[[0-9;]*m", "", key).strip()

            if key_clean == self.last_key:
                self.repeat_count += 1
                out_line = f"\r{self.last_formatted} (x{self.repeat_count})    "
                self.stream.write(out_line)
                self.stream.flush()
                self.in_carriage_return = True
            else:
                if self.in_carriage_return:
                    self.stream.write("\n")
                    self.in_carriage_return = False

                self.last_key = key_clean
                self.last_formatted = msg
                self.repeat_count = 1
                self.stream.write(f"{msg}\n")
                self.stream.flush()
        except Exception:
            self.handleError(record)


def get_smart_log_config() -> Dict[str, Any]:
    return {
        "version": 1,
        "disable_existing_loggers": False,
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
                "()": "app.utils.smart_logger.DeduplicatingLogHandler",
                "formatter": "default",
            },
            "access": {
                "()": "app.utils.smart_logger.DeduplicatingLogHandler",
                "formatter": "access",
            },
        },
        "loggers": {
            "uvicorn": {"handlers": ["default"], "level": "INFO", "propagate": False},
            "uvicorn.error": {"handlers": ["default"], "level": "INFO", "propagate": False},
            "uvicorn.access": {"handlers": ["access"], "level": "INFO", "propagate": False},
        },
    }


def setup_smart_logging():
    handler = DeduplicatingLogHandler(sys.stdout)
    formatter = logging.Formatter("%(levelname)s:     %(message)s")
    handler.setFormatter(formatter)

    for logger_name in ["uvicorn", "uvicorn.access", "uvicorn.error"]:
        l = logging.getLogger(logger_name)
        l.handlers = [handler]
        l.propagate = False