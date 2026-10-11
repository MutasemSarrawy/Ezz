# agent-memory

Permanent memory that **every** AI agent you use shares — Claude Code, Claude
Desktop, Cursor, Windsurf, Cline, VS Code Copilot, ChatGPT actions, scripts.
Tell one agent something today; any agent can recall it years from now.

- **Forever:** one SQLite file (`~/.agent-memory/memory.db`) in WAL mode with
  `synchronous=FULL`. Nothing is hard-deleted through the API — "forget"
  archives, and archived memories can be restored. Export to JSONL or hot-backup
  any time.
- **Remembers what you did:** an `activity` log with timestamps, project, agent
  and tags, plus a `timeline` view ("what did I do last week?").
- **Fast recall:** full-text search (FTS5, stemming), filters by kind, tags,
  project, agent and time (`today`, `yesterday`, `7d`, `2026-03-01`...).
- **Every agent:** MCP server (stdio), CLI, and a small HTTP/JSON API.

## Install

```bash
cd agent-memory
pip install -e .          # or: pipx install ./agent-memory
agent-memory stats        # creates ~/.agent-memory/memory.db
```

Set `AGENT_MEMORY_DB=/path/to/memory.db` to keep the file elsewhere (e.g. inside
a synced Dropbox/iCloud/Syncthing folder so it survives a dead laptop).

## Connect your agents

All MCP clients use the same command: `agent-memory-mcp`. Set
`AGENT_MEMORY_AGENT` so each memory records which agent wrote it.

**Claude Code**

```bash
claude mcp add memory --scope user -e AGENT_MEMORY_AGENT=claude-code -- agent-memory-mcp
```

**Claude Desktop** (`claude_desktop_config.json`), **Cursor** (`~/.cursor/mcp.json`),
**Windsurf** (`~/.codeium/windsurf/mcp_config.json`), **Cline**, etc.:

```json
{
  "mcpServers": {
    "memory": {
      "command": "agent-memory-mcp",
      "env": { "AGENT_MEMORY_AGENT": "cursor" }
    }
  }
}
```

The server ships instructions telling agents to call `get_context` at session
start, `recall` before answering about the past, and `log_activity` after real
work. To make it automatic, add a line to your global agent rules (e.g.
`~/.claude/CLAUDE.md`, Cursor Rules):

> Use the `memory` MCP server: call get_context at the start of every session and
> log_activity after completing any task.

**Non-MCP agents** (ChatGPT custom GPT actions, n8n, Zapier, LangChain, scripts):

```bash
AGENT_MEMORY_TOKEN=change-me agent-memory serve --port 8765
curl -H "Authorization: Bearer change-me" "localhost:8765/search?q=deploy&since=30d"
curl -H "Authorization: Bearer change-me" -X POST localhost:8765/activity \
     -d '{"summary":"Sent Q3 report to finance","project":"reports"}'
```

Endpoints: `GET /health /context /search /timeline`, `POST /memories /activity
/memories/<id>/forget`, `PATCH /memories/<id>`. The server refuses to bind a
public interface without `AGENT_MEMORY_TOKEN`; put it behind HTTPS (Caddy,
Cloudflare Tunnel, Tailscale) before exposing it to cloud agents.

## MCP tools

| Tool | Purpose |
|---|---|
| `get_context(project)` | Core memories (preferences, importance ≥ 4) + recent activity |
| `remember(content, kind, tags, project, importance)` | Store a fact/preference/decision/person/project/note |
| `log_activity(summary, details, project, tags)` | Record what was done |
| `recall(query, kind, project, tags, since, until, limit)` | Search everything |
| `timeline(since, until, project, kind)` | Chronological history |
| `update_memory(id, ...)` | Correct a memory |
| `forget(id)` | Archive (recoverable) |

## CLI

```bash
agent-memory remember "I prefer TypeScript over JavaScript" -k preference -i 5
agent-memory log "Migrated DB to Postgres 17" -p backend -t db,migration
agent-memory recall postgres --since 30d
agent-memory timeline --since yesterday
agent-memory context                 # what agents see at session start
agent-memory forget 12 && agent-memory restore 12
agent-memory export memories.jsonl   # portable, human-readable
agent-memory backup                  # ~/.agent-memory/backups/memory-<ts>.db
```

## Keeping it forever

1. Put the DB in a synced folder, or schedule `agent-memory backup` daily
   (cron / Task Scheduler).
2. Periodically `agent-memory export` to JSONL — plain text outlives any tool.
3. Never put secrets in memory; agents are told not to store them.

## Tests

```bash
pip install pytest && python -m pytest -q
```
