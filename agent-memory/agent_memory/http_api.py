"""Tiny JSON HTTP API (stdlib only) for agents that cannot speak MCP.

Use it from ChatGPT custom GPT actions, n8n/Zapier, shell scripts, browser
extensions, LangChain/CrewAI tools, etc.

    GET  /health
    GET  /context?project=
    GET  /search?q=&kind=&project=&tags=a,b&since=&until=&limit=
    GET  /timeline?since=7d&until=&project=
    POST /memories          {"content", "kind", "tags", "project", "importance", "agent"}
    POST /activity          {"summary", "details", "project", "tags", "agent"}
    PATCH /memories/<id>    {"content", "kind", "tags", "project", "importance"}
    POST /memories/<id>/forget

Set AGENT_MEMORY_TOKEN to require "Authorization: Bearer <token>".
"""

from __future__ import annotations

import hmac
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import parse_qs, urlparse

from .store import MemoryStore


def make_handler(store: MemoryStore, token: str | None):
    class Handler(BaseHTTPRequestHandler):
        server_version = "agent-memory/0.1"

        def _send(self, code: int, body: Any) -> None:
            data = json.dumps(body, ensure_ascii=False).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def _authorized(self) -> bool:
            if not token:
                return True
            got = self.headers.get("Authorization", "")
            return hmac.compare_digest(got, f"Bearer {token}")

        def _body(self) -> dict[str, Any]:
            n = int(self.headers.get("Content-Length") or 0)
            return json.loads(self.rfile.read(n) or b"{}") if n else {}

        def _dispatch(self, method: str) -> None:
            if not self._authorized():
                return self._send(401, {"error": "unauthorized"})
            url = urlparse(self.path)
            q = {k: v[-1] for k, v in parse_qs(url.query).items()}
            parts = [p for p in url.path.split("/") if p]
            try:
                if method == "GET" and parts == ["health"]:
                    return self._send(200, {"ok": True, **store.stats()})
                if method == "GET" and parts == ["context"]:
                    return self._send(200, store.context(q.get("project")))
                if method == "GET" and parts == ["search"]:
                    return self._send(200, store.search(
                        q.get("q", ""), q.get("kind"), q.get("tags"), q.get("project"), q.get("agent"),
                        q.get("since"), q.get("until"), int(q.get("limit", 20)),
                    ))
                if method == "GET" and parts == ["timeline"]:
                    return self._send(200, store.timeline(
                        since=q.get("since", "7d"), until=q.get("until"), project=q.get("project"),
                        kind=q.get("kind"), limit=int(q.get("limit", 200)),
                    ))
                if method == "POST" and parts == ["memories"]:
                    b = self._body()
                    return self._send(201, store.add(
                        b.get("content", ""), b.get("kind", "note"), b.get("tags"), b.get("agent", ""),
                        b.get("project", ""), b.get("importance", 3), b.get("metadata"),
                    ))
                if method == "POST" and parts == ["activity"]:
                    b = self._body()
                    content = b.get("summary", "").strip()
                    if b.get("details"):
                        content += "\n\n" + b["details"].strip()
                    return self._send(201, store.add(
                        content, "activity", b.get("tags"), b.get("agent", ""), b.get("project", ""), 3,
                    ))
                if method == "PATCH" and len(parts) == 2 and parts[0] == "memories":
                    b = self._body()
                    return self._send(200, store.update(int(parts[1]), **{
                        k: b.get(k) for k in ("content", "kind", "tags", "project", "importance")
                    }))
                if method == "POST" and len(parts) == 3 and parts[0] == "memories" and parts[2] == "forget":
                    return self._send(200, store.forget(int(parts[1])))
                return self._send(404, {"error": "not found"})
            except KeyError as e:
                return self._send(404, {"error": str(e)})
            except (ValueError, json.JSONDecodeError) as e:
                return self._send(400, {"error": str(e)})

        def do_GET(self) -> None:  # noqa: N802
            self._dispatch("GET")

        def do_POST(self) -> None:  # noqa: N802
            self._dispatch("POST")

        def do_PATCH(self) -> None:  # noqa: N802
            self._dispatch("PATCH")

        def log_message(self, *args: Any) -> None:
            pass

    return Handler


def serve(host: str = "127.0.0.1", port: int = 8765, store: MemoryStore | None = None) -> None:
    store = store or MemoryStore()
    token = os.environ.get("AGENT_MEMORY_TOKEN")
    if host not in ("127.0.0.1", "localhost") and not token:
        raise SystemExit("Refusing to listen on a public interface without AGENT_MEMORY_TOKEN set.")
    httpd = ThreadingHTTPServer((host, port), make_handler(store, token))
    print(f"agent-memory HTTP API on http://{host}:{port}  (db: {store.path})")
    httpd.serve_forever()
