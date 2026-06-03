import atexit
import logging
import logging.handlers
import os
import sys
from pathlib import Path

_LOG_DIR = Path.home() / ".nexu" / "logs"
_LOG_DIR.mkdir(parents=True, exist_ok=True)

_DEBUG = False


def set_debug(enabled: bool = True):
    global _DEBUG
    _DEBUG = enabled


def is_debug() -> bool:
    return _DEBUG


def _clean_old_logs(max_days: int = 14):
    import time
    now = time.time()
    cutoff = now - max_days * 86400
    for f in _LOG_DIR.iterdir():
        if f.suffix == ".log" and f.stat().st_mtime < cutoff:
            try:
                f.unlink()
            except OSError:
                pass


def setup_logging(debug: bool = False):
    global _DEBUG
    _DEBUG = debug

    _clean_old_logs()

    log_file = _LOG_DIR / "nexu.log"

    level = logging.DEBUG if debug else logging.INFO

    root = logging.getLogger()
    root.setLevel(level)

    fmt = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )

    fh = logging.handlers.RotatingFileHandler(
        str(log_file), maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8"
    )
    fh.setLevel(level)
    fh.setFormatter(fmt)
    root.addHandler(fh)

    ch = logging.StreamHandler(sys.stdout)
    ch.setLevel(level)
    ch.setFormatter(fmt)
    root.addHandler(ch)

    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("playwright").setLevel(logging.WARNING)

    atexit.register(_shutdown)


def _shutdown():
    logging.shutdown()


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
