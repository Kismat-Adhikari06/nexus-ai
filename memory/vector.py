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
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS conversations (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            role       TEXT NOT NULL,
            content    TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS conversations_fts
        USING fts5(content, content=conversations, content_rowid=id);
    """)
    conn.commit()


def add(role: str, content: str):
    conn = _get_conn()
    now = datetime.now().isoformat()
    cursor = conn.execute(
        "INSERT INTO conversations (role, content, created_at) VALUES (?, ?, ?)",
        (role, content, now),
    )
    row_id = cursor.lastrowid
    conn.execute(
        "INSERT INTO conversations_fts (rowid, content) VALUES (?, ?)",
        (row_id, content),
    )
    conn.commit()


def _fts_escape(query: str) -> str:
    import re
    clean = re.sub(r"[^\w\s]", " ", query)
    clean = re.sub(r"\s+", " ", clean).strip()
    return clean if clean else "a"


def search(query: str, n: int = 3) -> list[dict]:
    conn = _get_conn()
    escaped = _fts_escape(query)
    rows = conn.execute(
        """
        SELECT c.id, c.role, c.content, c.created_at
        FROM conversations_fts f
        JOIN conversations c ON c.id = f.rowid
        WHERE conversations_fts MATCH ?
        ORDER BY rank
        LIMIT ?
        """,
        (escaped, n),
    ).fetchall()
    return [
        {"id": r[0], "role": r[1], "content": r[2], "created_at": r[3]}
        for r in rows
    ]


def get_recent(n: int = 5) -> list[dict]:
    conn = _get_conn()
    rows = conn.execute(
        "SELECT id, role, content, created_at FROM conversations ORDER BY id DESC LIMIT ?",
        (n,),
    ).fetchall()
    rows.reverse()
    return [
        {"id": r[0], "role": r[1], "content": r[2], "created_at": r[3]}
        for r in rows
    ]
