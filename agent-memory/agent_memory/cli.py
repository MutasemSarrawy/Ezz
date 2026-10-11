"""Command line interface: `agent-memory <command>`."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

from .store import KINDS, MemoryStore


def _print(rows: list[dict], as_json: bool) -> None:
    if as_json:
        print(json.dumps(rows, indent=2, ensure_ascii=False))
        return
    if not rows:
        print("No matching memories.")
    for r in rows:
        extra = " ".join(x for x in (
            f"@{r['project']}" if r["project"] else "",
            f"<{r['agent']}>" if r["agent"] else "",
            " ".join("#" + t for t in r["tags"]),
        ) if x)
        print(f"#{r['id']:<5} {r['created_at'][:16].replace('T', ' ')}  {r['kind']:<10} {r['content']}  {extra}".rstrip())


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(prog="agent-memory", description="Permanent memory shared by all your AI agents.")
    p.add_argument("--db", help="database path (default: $AGENT_MEMORY_DB or ~/.agent-memory/memory.db)")
    p.add_argument("--json", action="store_true", help="JSON output")
    sub = p.add_subparsers(dest="cmd", required=True)

    a = sub.add_parser("remember", help="store a memory")
    a.add_argument("content")
    a.add_argument("-k", "--kind", default="note", choices=KINDS)
    a.add_argument("-t", "--tags", default="")
    a.add_argument("-p", "--project", default="")
    a.add_argument("-i", "--importance", type=int, default=3)
    a.add_argument("-a", "--agent", default="cli")

    lg = sub.add_parser("log", help="log something you did")
    lg.add_argument("summary")
    lg.add_argument("-p", "--project", default="")
    lg.add_argument("-t", "--tags", default="")
    lg.add_argument("-a", "--agent", default="cli")

    s = sub.add_parser("recall", help="search memories")
    s.add_argument("query", nargs="?", default="")
    s.add_argument("-k", "--kind", choices=KINDS)
    s.add_argument("-t", "--tags")
    s.add_argument("-p", "--project")
    s.add_argument("--since")
    s.add_argument("--until")
    s.add_argument("-n", "--limit", type=int, default=20)
    s.add_argument("--archived", action="store_true", help="include archived memories")

    tl = sub.add_parser("timeline", help="what happened in a time window")
    tl.add_argument("--since", default="7d")
    tl.add_argument("--until")
    tl.add_argument("-p", "--project")

    sub.add_parser("context", help="show what agents see at session start").add_argument("-p", "--project")
    sub.add_parser("stats", help="database statistics")
    sub.add_parser("forget", help="archive a memory").add_argument("id", type=int)
    sub.add_parser("restore", help="un-archive a memory").add_argument("id", type=int)

    ex = sub.add_parser("export", help="export everything to JSONL")
    ex.add_argument("file", type=Path)
    im = sub.add_parser("import", help="import a JSONL export")
    im.add_argument("file", type=Path)
    bk = sub.add_parser("backup", help="hot-copy the database file")
    bk.add_argument("dest", type=Path, nargs="?")

    sv = sub.add_parser("serve", help="run the HTTP API for non-MCP agents")
    sv.add_argument("--host", default="127.0.0.1")
    sv.add_argument("--port", type=int, default=8765)
    sub.add_parser("mcp", help="run the MCP server over stdio")

    args = p.parse_args(argv)

    if args.cmd == "mcp":
        if args.db:
            import os
            os.environ["AGENT_MEMORY_DB"] = args.db
        from .server import main as mcp_main
        return mcp_main()

    store = MemoryStore(args.db)
    try:
        if args.cmd == "remember":
            m = store.add(args.content, args.kind, args.tags, args.agent, args.project, args.importance)
            print(f"Saved #{m['id']}")
        elif args.cmd == "log":
            m = store.add(args.summary, "activity", args.tags, args.agent, args.project)
            print(f"Logged #{m['id']}")
        elif args.cmd == "recall":
            _print(store.search(args.query, args.kind, args.tags, args.project, None, args.since,
                                args.until, args.limit, args.archived), args.json)
        elif args.cmd == "timeline":
            _print(store.timeline(since=args.since, until=args.until, project=args.project), args.json)
        elif args.cmd == "context":
            ctx = store.context(args.project)
            if args.json:
                print(json.dumps(ctx, indent=2, ensure_ascii=False))
            else:
                print("== Core memories ==")
                _print(ctx["core_memories"], False)
                print("\n== Recent activity ==")
                _print(ctx["recent_activity"], False)
        elif args.cmd == "stats":
            print(json.dumps(store.stats(), indent=2))
        elif args.cmd == "forget":
            store.forget(args.id)
            print(f"Archived #{args.id}")
        elif args.cmd == "restore":
            store.restore(args.id)
            print(f"Restored #{args.id}")
        elif args.cmd == "export":
            print(f"Exported {store.export_jsonl(args.file)} memories to {args.file}")
        elif args.cmd == "import":
            print(f"Imported {store.import_jsonl(args.file)} memories")
        elif args.cmd == "backup":
            dest = args.dest or store.path.parent / "backups" / f"memory-{datetime.now():%Y%m%d-%H%M%S}.db"
            print(f"Backed up to {store.backup(dest)}")
        elif args.cmd == "serve":
            from .http_api import serve
            serve(args.host, args.port, store)
    except (KeyError, ValueError) as e:
        sys.exit(f"error: {e}")
    finally:
        store.close()


if __name__ == "__main__":
    main()
