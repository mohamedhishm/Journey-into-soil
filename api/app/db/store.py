"""Tiny SQLite store for shareable analyses. Results are immutable and keyed by the request hash."""
from __future__ import annotations

import json
import sqlite3
from contextlib import closing
from pathlib import Path

from ..config import get_settings


def _connect() -> sqlite3.Connection:
    path = Path(get_settings().db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS analyses (id TEXT PRIMARY KEY, request TEXT NOT NULL, result TEXT NOT NULL,"
        " created_at TEXT DEFAULT CURRENT_TIMESTAMP)"
    )
    return conn


def save(analysis_id: str, request: dict, result: dict) -> None:
    with closing(_connect()) as conn, conn:
        conn.execute(
            "INSERT OR REPLACE INTO analyses (id, request, result) VALUES (?, ?, ?)",
            (analysis_id, json.dumps(request), json.dumps(result)),
        )


def load(analysis_id: str) -> tuple[dict, dict] | None:
    with closing(_connect()) as conn:
        row = conn.execute("SELECT request, result FROM analyses WHERE id = ?", (analysis_id,)).fetchone()
    return (json.loads(row[0]), json.loads(row[1])) if row else None
