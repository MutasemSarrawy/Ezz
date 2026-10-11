"""Durable, append-only memory store backed by a single SQLite file.

Nothing is ever hard-deleted through the public API: "forget" archives a
memory so it drops out of search but stays recoverable. The database file
is the whole system — copy it and you have copied every memory.
"""

from __future__ import annotations

import json
import os
import re
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable, Iterator

KINDS = ("activity", "fact", "preference", "decision", "note", "person", "project")

def default_db_path() -> Path:
    return Path(os.environ.get("AGENT_MEMORY_DB") or Path.home() / ".agent-memory" / "memory.db").expanduser()

SCHEMA = """
CREATE TABLE IF NOT EXISTS memories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at  TEXT NOT NULL,
    kind        TEXT NOT NULL,
    content     TEXT NOT NULL,
    tags        TEXT NOT NULL DEFAULT '',
    agent       TEXT NOT NULL DEFAULT '',
    project     TEXT NOT NULL DEFAULT '',
    importance  INTEGER NOT NULL DEFAULT 3,
    archived    INTEGER NOT NULL DEFAULT 0,
    metadata    TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_mem_created ON memories(created_at);
CREATE INDEX IF NOT EXISTS idx_mem_kind ON memories(kind);
CREATE INDEX IF NOT EXISTS idx_mem_project ON memories(project);

CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
    content, tags, project, agent,
    content='memories', content_rowid='id', tokenize='porter unicode61'
);

CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
    INSERT INTO memories_fts(rowid, content, tags, project, agent)
    VALUES (new.id, new.content, new.tags, new.project, new.agent);
END;
CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
    INSERT INTO memories_fts(memories_fts, rowid, content, tags, project, agent)
    VALUES ('delete', old.id, old.content, old.tags, old.project, old.agent);
END;
CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
    INSERT INTO memories_fts(memories_fts, rowid, content, tags, project, agent)
    VALUES ('delete', old.id, old.content, old.tags, old.project, old.agent);
    INSERT INTO memories_fts(rowid, content, tags, project, agent)
    VALUES (new.id, new.content, new.tags, new.project, new.agent);
END;
"""

_RELATIVE = re.compile(r"^\s*(\d+)\s*([mhdwy])\s*$", re.I)
_UNITS = {"m": "minutes", "h": "hours", "d": "days", "w": "weeks"}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def parse_time(value: str | None) -> str | None:
    """Accept ISO dates/datetimes, '7d'/'12h'/'2w'/'1y', 'today', 'yesterday'."""
    if not value:
        return None
    v = value.strip().lower()
    now = datetime.now(timezone.utc)
    if v == "today":
        return now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat(timespec="seconds")
    if v == "yesterday":
        d = now - timedelta(days=1)
        return d.replace(hour=0, minute=0, second=0, microsecond=0).isoformat(timespec="seconds")
    m = _RELATIVE.match(v)
    if m:
        n, unit = int(m.group(1)), m.group(2).lower()
        delta = timedelta(days=365 * n) if unit == "y" else timedelta(**{_UNITS[unit]: n})
        return (now - delta).isoformat(timespec="seconds")
    try:
        dt = datetime.fromisoformat(value.strip())
    except ValueError as e:
        raise ValueError(f"Unrecognised time {value!r}; use ISO date, 'today', 'yesterday' or e.g. '7d'") from e
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat(timespec="seconds")


def _norm_tags(tags: Iterable[str] | str | None) -> str:
    if not tags:
        return ""
    if isinstance(tags, str):
        tags = tags.split(",")
    clean = sorted({t.strip().lower() for t in tags if t and t.strip()})
    return ",".join(clean)


def _fts_query(text: str) -> str:
    # Quote every token so user input can never be parsed as FTS syntax.
    tokens = re.findall(r"\w+", text, flags=re.UNICODE)
    return " OR ".join(f'"{t}"' for t in tokens)


class MemoryStore:
    def __init__(self, path: str | Path | None = None):
        self.path = Path(path).expanduser() if path else default_db_path()
        if str(self.path) != ":memory:":
            self.path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(str(self.path), check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA journal_mode=WAL")
        self.conn.execute("PRAGMA synchronous=FULL")  # durability over speed
        self.conn.executescript(SCHEMA)

    @contextmanager
    def _tx(self) -> Iterator[sqlite3.Connection]:
        with self.conn:
            yield self.conn

    def close(self) -> None:
        self.conn.close()

    # ---- writes -----------------------------------------------------------

    def add(
        self,
        content: str,
        kind: str = "note",
        tags: Iterable[str] | str | None = None,
        agent: str = "",
        project: str = "",
        importance: int = 3,
        metadata: dict[str, Any] | None = None,
        created_at: str | None = None,
    ) -> dict[str, Any]:
        content = (content or "").strip()
        if not content:
            raise ValueError("content must not be empty")
        kind = (kind or "note").strip().lower()
        if kind not in KINDS:
            raise ValueError(f"kind must be one of {', '.join(KINDS)}")
        importance = max(1, min(5, int(importance)))
        with self._tx() as c:
            cur = c.execute(
                "INSERT INTO memories(created_at, kind, content, tags, agent, project, importance, metadata)"
                " VALUES (?,?,?,?,?,?,?,?)",
                (
                    parse_time(created_at) if created_at else now_iso(),
                    kind,
                    content,
                    _norm_tags(tags),
                    (agent or "").strip(),
                    (project or "").strip(),
                    importance,
                    json.dumps(metadata or {}, ensure_ascii=False),
                ),
            )
        return self.get(cur.lastrowid)  # type: ignore[arg-type]

    def update(self, memory_id: int, **fields: Any) -> dict[str, Any]:
        allowed = {"content", "kind", "tags", "project", "importance", "archived"}
        sets, vals = [], []
        for k, v in fields.items():
            if v is None or k not in allowed:
                continue
            if k == "tags":
                v = _norm_tags(v)
            if k == "kind" and v not in KINDS:
                raise ValueError(f"kind must be one of {', '.join(KINDS)}")
            if k == "importance":
                v = max(1, min(5, int(v)))
            sets.append(f"{k} = ?")
            vals.append(v)
        if not self.get(memory_id, include_archived=True):
            raise KeyError(f"no memory with id {memory_id}")
        if sets:
            with self._tx() as c:
                c.execute(f"UPDATE memories SET {', '.join(sets)} WHERE id = ?", (*vals, memory_id))
        return self.get(memory_id, include_archived=True)  # type: ignore[return-value]

    def forget(self, memory_id: int) -> dict[str, Any]:
        """Archive (soft-delete). Recoverable with restore()."""
        return self.update(memory_id, archived=1)

    def restore(self, memory_id: int) -> dict[str, Any]:
        return self.update(memory_id, archived=0)

    # ---- reads ------------------------------------------------------------

    @staticmethod
    def _row(r: sqlite3.Row) -> dict[str, Any]:
        d = dict(r)
        d["tags"] = [t for t in d["tags"].split(",") if t]
        d["metadata"] = json.loads(d["metadata"] or "{}")
        d["archived"] = bool(d["archived"])
        d.pop("rank", None)
        return d

    def get(self, memory_id: int, include_archived: bool = False) -> dict[str, Any] | None:
        sql = "SELECT * FROM memories WHERE id = ?" + ("" if include_archived else " AND archived = 0")
        r = self.conn.execute(sql, (memory_id,)).fetchone()
        return self._row(r) if r else None

    def search(
        self,
        query: str = "",
        kind: str | None = None,
        tags: Iterable[str] | str | None = None,
        project: str | None = None,
        agent: str | None = None,
        since: str | None = None,
        until: str | None = None,
        limit: int = 20,
        include_archived: bool = False,
    ) -> list[dict[str, Any]]:
        where, params = [], []
        fts = _fts_query(query) if query else ""
        if fts:
            base = "SELECT m.*, bm25(memories_fts) AS rank FROM memories_fts JOIN memories m ON m.id = memories_fts.rowid"
            where.append("memories_fts MATCH ?")
            params.append(fts)
            # Relevance first, nudged by importance; newest breaks ties.
            order = "ORDER BY (rank - m.importance * 0.5) ASC, m.created_at DESC"
        else:
            base = "SELECT m.* FROM memories m"
            order = "ORDER BY m.created_at DESC, m.id DESC"
        if not include_archived:
            where.append("m.archived = 0")
        if kind:
            where.append("m.kind = ?")
            params.append(kind.lower())
        for t in _norm_tags(tags).split(","):
            if t:
                where.append("(',' || m.tags || ',') LIKE ?")
                params.append(f"%,{t},%")
        if project:
            where.append("m.project = ?")
            params.append(project)
        if agent:
            where.append("m.agent = ?")
            params.append(agent)
        if since:
            where.append("m.created_at >= ?")
            params.append(parse_time(since))
        if until:
            where.append("m.created_at <= ?")
            params.append(parse_time(until))
        sql = f"{base} {'WHERE ' + ' AND '.join(where) if where else ''} {order} LIMIT ?"
        params.append(max(1, min(500, int(limit))))
        return [self._row(r) for r in self.conn.execute(sql, params)]

    def timeline(self, since: str | None = "7d", until: str | None = None, **filters: Any) -> list[dict[str, Any]]:
        """Chronological (oldest first) view of what happened in a window."""
        rows = self.search("", since=since, until=until, limit=filters.pop("limit", 200), **filters)
        return list(reversed(rows))

    def context(self, project: str | None = None, recent: int = 15) -> dict[str, Any]:
        """Everything an agent should know when a session starts."""
        core = self.conn.execute(
            "SELECT * FROM memories WHERE archived = 0 AND kind IN ('preference','fact','person','decision','project')"
            " AND (importance >= 4 OR kind = 'preference')"
            + (" AND (project = ? OR project = '')" if project else "")
            + " ORDER BY importance DESC, created_at DESC LIMIT 100",
            (project,) if project else (),
        ).fetchall()
        return {
            "core_memories": [self._row(r) for r in core],
            "recent_activity": self.search(kind="activity", project=project, limit=recent),
            "stats": self.stats(),
        }

    def stats(self) -> dict[str, Any]:
        c = self.conn
        total = c.execute("SELECT COUNT(*) FROM memories WHERE archived = 0").fetchone()[0]
        by_kind = dict(c.execute("SELECT kind, COUNT(*) FROM memories WHERE archived = 0 GROUP BY kind").fetchall())
        first, last = c.execute("SELECT MIN(created_at), MAX(created_at) FROM memories").fetchone()
        return {"total": total, "by_kind": by_kind, "first": first, "last": last, "db_path": str(self.path)}

    # ---- durability -------------------------------------------------------

    def export_jsonl(self, out: Path) -> int:
        n = 0
        with open(out, "w", encoding="utf-8") as f:
            for r in self.conn.execute("SELECT * FROM memories ORDER BY id"):
                f.write(json.dumps(self._row(r), ensure_ascii=False) + "\n")
                n += 1
        return n

    def import_jsonl(self, src: Path) -> int:
        n = 0
        with open(src, encoding="utf-8") as f:
            for line in f:
                if not line.strip():
                    continue
                d = json.loads(line)
                m = self.add(
                    d["content"], d.get("kind", "note"), d.get("tags"), d.get("agent", ""),
                    d.get("project", ""), d.get("importance", 3), d.get("metadata"), d.get("created_at"),
                )
                if d.get("archived"):
                    self.forget(m["id"])
                n += 1
        return n

    def backup(self, dest: Path) -> Path:
        dest.parent.mkdir(parents=True, exist_ok=True)
        target = sqlite3.connect(str(dest))
        with target:
            self.conn.backup(target)
        target.close()
        return dest
