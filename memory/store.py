import sqlite3
import threading
from datetime import datetime
from pathlib import Path


_DB_DIR = Path.home() / ".nexu"
_DB_PATH = _DB_DIR / "memory.db"

_local = threading.local()


def _get_conn() -> sqlite3.Connection:
    _DB_DIR.mkdir(parents=True, exist_ok=True)
    if not hasattr(_local, "conn") or _local.conn is None:
        _local.conn = sqlite3.connect(str(_DB_PATH))
        _local.conn.execute("PRAGMA journal_mode=WAL")
        _init_db(_local.conn)
    return _local.conn


def _init_db(conn: sqlite3.Connection):
    conn.execute("""
        CREATE TABLE IF NOT EXISTS facts (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)
    conn.commit()


def save(key: str, value: str):
    now = datetime.now().isoformat()
    conn = _get_conn()
    conn.execute("""
        INSERT INTO facts (key, value, created_at, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updated_at = excluded.updated_at
    """, (key.lower(), value, now, now))
    conn.commit()


def get(key: str) -> str | None:
    conn = _get_conn()
    row = conn.execute(
        "SELECT value FROM facts WHERE key = ?", (key.lower(),)
    ).fetchone()
    return row[0] if row else None


def get_all() -> dict[str, str]:
    conn = _get_conn()
    rows = conn.execute("SELECT key, value FROM facts").fetchall()
    return dict(rows)


def delete(key: str):
    conn = _get_conn()
    conn.execute("DELETE FROM facts WHERE key = ?", (key.lower(),))
    conn.commit()
