import json
import os
import sys
import threading
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

import pytest

from agent_memory.cli import main as cli
from agent_memory.http_api import make_handler
from agent_memory.store import MemoryStore, parse_time


@pytest.fixture
def store(tmp_path):
    s = MemoryStore(tmp_path / "m.db")
    yield s
    s.close()


def test_add_and_search(store):
    store.add("User prefers dark mode in every editor", "preference", ["ui"])
    store.add("Deployed billing service to production", "activity", project="billing")
    store.add("Lunch was pizza", "note")

    hits = store.search("dark mode")
    assert hits[0]["content"].startswith("User prefers dark mode")
    assert hits[0]["tags"] == ["ui"]
    assert [h["kind"] for h in store.search("deploy")] == ["activity"]  # porter stemming
    assert store.search(project="billing")[0]["project"] == "billing"
    assert len(store.search(tags="ui")) == 1


def test_fts_injection_is_harmless(store):
    store.add("quote \" and NEAR( stuff", "note")
    assert isinstance(store.search('"unterminated AND OR NEAR('), list)  # no sqlite error


def test_forget_is_soft_and_restorable(store):
    m = store.add("temporary thing", "note")
    store.forget(m["id"])
    assert store.search("temporary") == []
    assert store.search("temporary", include_archived=True)[0]["archived"] is True
    store.restore(m["id"])
    assert store.search("temporary")[0]["id"] == m["id"]


def test_persistence_across_reopen(tmp_path):
    path = tmp_path / "p.db"
    s = MemoryStore(path)
    s.add("I live in Amman", "fact", importance=5)
    s.close()
    s2 = MemoryStore(path)
    assert s2.search("Amman")[0]["importance"] == 5
    s2.close()


def test_time_filters_and_timeline(store):
    store.add("old work", "activity", created_at="2020-01-01T10:00:00")
    store.add("new work", "activity")
    assert [r["content"] for r in store.search(kind="activity", since="7d")] == ["new work"]
    assert [r["content"] for r in store.search(until="2021-01-01")] == ["old work"]
    tl = store.timeline(since="2019-01-01")
    assert [r["content"] for r in tl] == ["old work", "new work"]
    with pytest.raises(ValueError):
        parse_time("next tuesday")


def test_context_surfaces_core_and_recent(store):
    store.add("Always answer in English and Arabic", "preference")
    store.add("minor fact", "fact", importance=2)
    store.add("Wrote the README", "activity")
    ctx = store.context()
    assert [m["content"] for m in ctx["core_memories"]] == ["Always answer in English and Arabic"]
    assert ctx["recent_activity"][0]["content"] == "Wrote the README"


def test_validation(store):
    with pytest.raises(ValueError):
        store.add("   ")
    with pytest.raises(ValueError):
        store.add("x", kind="bogus")
    with pytest.raises(KeyError):
        store.update(999, content="x")


def test_export_import_roundtrip(store, tmp_path):
    store.add("a", "fact", ["x"])
    gone = store.add("b", "note")
    store.forget(gone["id"])
    out = tmp_path / "e.jsonl"
    assert store.export_jsonl(out) == 2
    other = MemoryStore(tmp_path / "o.db")
    assert other.import_jsonl(out) == 2
    assert [m["content"] for m in other.search()] == ["a"]
    other.close()


def test_backup(store, tmp_path):
    store.add("precious", "fact")
    b = MemoryStore(store.backup(tmp_path / "bk" / "b.db"))
    assert b.search("precious")
    b.close()


def test_cli(tmp_path, capsys):
    db = str(tmp_path / "c.db")
    cli(["--db", db, "remember", "Prefers tabs", "-k", "preference", "-t", "code"])
    cli(["--db", db, "log", "Shipped v2", "-p", "app"])
    capsys.readouterr()
    cli(["--db", db, "--json", "recall", "tabs"])
    assert json.loads(capsys.readouterr().out)[0]["kind"] == "preference"
    cli(["--db", db, "timeline", "--since", "1d"])
    assert "Shipped v2" in capsys.readouterr().out


def test_http_api(store):
    srv = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(store, "s3cret"))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{srv.server_address[1]}"

    def call(method, path, body=None, token="s3cret"):
        req = urllib.request.Request(base + path, method=method, data=json.dumps(body).encode() if body else None)
        req.add_header("Authorization", f"Bearer {token}")
        try:
            with urllib.request.urlopen(req) as r:
                return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())

    try:
        assert call("GET", "/health", token="wrong")[0] == 401
        code, m = call("POST", "/memories", {"content": "Uses Neovim", "kind": "preference"})
        assert code == 201
        assert call("POST", "/activity", {"summary": "Fixed bug 42", "project": "core"})[0] == 201
        assert call("GET", "/search?q=neovim")[1][0]["id"] == m["id"]
        assert call("GET", "/timeline?since=1d")[1][-1]["content"] == "Fixed bug 42"
        assert call("PATCH", f"/memories/{m['id']}", {"importance": 5})[1]["importance"] == 5
        assert call("POST", f"/memories/{m['id']}/forget")[1]["archived"] is True
        assert call("POST", "/memories", {"content": ""})[0] == 400
    finally:
        srv.shutdown()


def test_mcp_server_roundtrip(tmp_path):
    """Spawn the real MCP server over stdio and drive it with the MCP client."""
    anyio = pytest.importorskip("anyio")
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client

    params = StdioServerParameters(
        command=sys.executable, args=["-m", "agent_memory.server"],
        env={**os.environ, "AGENT_MEMORY_DB": str(tmp_path / "mcp.db"),
             "PYTHONPATH": str(Path(__file__).resolve().parents[1])},
    )

    async def run():
        async with stdio_client(params) as (r, w):
            async with ClientSession(r, w) as s:
                await s.initialize()
                names = {t.name for t in (await s.list_tools()).tools}
                assert {"remember", "recall", "log_activity", "timeline", "get_context", "forget"} <= names
                await s.call_tool("remember", {"content": "Favourite language is Python", "kind": "preference"})
                await s.call_tool("log_activity", {"summary": "Built a memory server"})
                out = await s.call_tool("recall", {"query": "python"})
                assert "Favourite language is Python" in out.content[0].text
                ctx = await s.call_tool("get_context", {})
                assert "Built a memory server" in ctx.content[0].text

    anyio.run(run)
