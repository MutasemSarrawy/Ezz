"""MCP server exposing the memory store to any MCP-capable agent.

Works with Claude Code, Claude Desktop, Cursor, Windsurf, Cline, Zed, VS Code
Copilot and anything else that speaks the Model Context Protocol.
"""

from __future__ import annotations

import json
import os
from typing import Any

try:  # mcp >= 2
    from mcp.server.mcpserver import MCPServer as _Server
except ImportError:  # mcp 1.x
    from mcp.server.fastmcp import FastMCP as _Server  # type: ignore[no-redef]

from .store import KINDS, MemoryStore

INSTRUCTIONS = f"""\
This server is the user's permanent, cross-agent memory. Every AI agent the user
works with reads and writes the same store, so treat it as the single source of
truth about who the user is and what they have done.

- At the start of a session call `get_context` (pass `project` if you know it).
- Before answering anything about past work, preferences or people, call `recall`.
- After finishing meaningful work, call `log_activity` with a one-line summary of
  what was done (files, decisions, outcomes). Keep it factual and specific.
- When the user states a durable fact, preference, decision or person detail,
  call `remember` with the matching kind ({", ".join(KINDS)}).
- Never store secrets, passwords, API keys or tokens.
"""

store = MemoryStore()
mcp = _Server("agent-memory", instructions=INSTRUCTIONS)
DEFAULT_AGENT = os.environ.get("AGENT_MEMORY_AGENT", "")


def _fmt(rows: list[dict[str, Any]]) -> str:
    if not rows:
        return "No matching memories."
    lines = []
    for r in rows:
        meta = [r["kind"], r["created_at"]]
        if r["project"]:
            meta.append(f"project={r['project']}")
        if r["agent"]:
            meta.append(f"agent={r['agent']}")
        if r["tags"]:
            meta.append("tags=" + ",".join(r["tags"]))
        lines.append(f"[#{r['id']}] ({'; '.join(meta)}) {r['content']}")
    return "\n".join(lines)


@mcp.tool()
def remember(
    content: str,
    kind: str = "note",
    tags: list[str] | None = None,
    project: str = "",
    importance: int = 3,
    agent: str = "",
) -> str:
    """Store a durable memory forever.

    kind: one of activity, fact, preference, decision, note, person, project.
    importance: 1 (trivia) .. 5 (critical). Preferences and importance >= 4
    facts/decisions are shown to every agent at session start.
    """
    m = store.add(content, kind, tags, agent or DEFAULT_AGENT, project, importance)
    return f"Saved memory #{m['id']} ({m['kind']})."


@mcp.tool()
def log_activity(
    summary: str,
    project: str = "",
    tags: list[str] | None = None,
    agent: str = "",
    details: str = "",
) -> str:
    """Record something the user (or you, on their behalf) just did.

    Use a concise, past-tense summary, e.g. "Refactored auth middleware to use JWT".
    Put longer notes in `details`.
    """
    content = summary.strip() + (f"\n\n{details.strip()}" if details.strip() else "")
    m = store.add(content, "activity", tags, agent or DEFAULT_AGENT, project, 3)
    return f"Logged activity #{m['id']}."


@mcp.tool()
def recall(
    query: str = "",
    kind: str = "",
    project: str = "",
    tags: list[str] | None = None,
    since: str = "",
    until: str = "",
    limit: int = 20,
) -> str:
    """Search all memories. Full-text query plus optional filters.

    since/until accept ISO dates, 'today', 'yesterday', or relative spans like
    '7d', '12h', '3w', '1y'. Leave query empty to list the newest matches.
    """
    rows = store.search(query, kind or None, tags, project or None, None, since or None, until or None, limit)
    return _fmt(rows)


@mcp.tool()
def timeline(since: str = "7d", until: str = "", project: str = "", kind: str = "", limit: int = 100) -> str:
    """Chronological list of what happened between `since` and `until` (oldest first).

    Great for "what did I do last week?" or "what happened on 2026-03-02?".
    """
    rows = store.timeline(since=since or None, until=until or None, project=project or None, kind=kind or None, limit=limit)
    return _fmt(rows)


@mcp.tool()
def get_context(project: str = "") -> str:
    """Load the user's core memories and most recent activity. Call at session start."""
    ctx = store.context(project or None)
    return (
        "## Core memories\n" + _fmt(ctx["core_memories"])
        + "\n\n## Recent activity (newest first)\n" + _fmt(ctx["recent_activity"])
        + "\n\n## Stats\n" + json.dumps(ctx["stats"])
    )


@mcp.tool()
def update_memory(
    memory_id: int,
    content: str | None = None,
    kind: str | None = None,
    tags: list[str] | None = None,
    project: str | None = None,
    importance: int | None = None,
) -> str:
    """Correct or refine an existing memory (e.g. a preference that changed)."""
    m = store.update(memory_id, content=content, kind=kind, tags=tags, project=project, importance=importance)
    return f"Updated memory #{m['id']}."


@mcp.tool()
def forget(memory_id: int) -> str:
    """Archive a memory so it no longer appears in searches. It is kept on disk and can be restored."""
    store.forget(memory_id)
    return f"Archived memory #{memory_id}. Restore with `agent-memory restore {memory_id}`."


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
