#!/usr/bin/env python3
"""Read-only run viewer for the monthly redesign.

Shows, for the current or a past run of sreeraj-redesign.service:
  - service state and the runner's stage log (journald)
  - the chosen trend spec and the full rebuild prompt
  - every Claude Code session the run started: prompts, thinking, tool calls,
    tool results and replies, read from ~/.claude/projects/<repo>/*.jsonl
  - the layout-QA summary

Standard library only. Bind it to the Tailscale address; it serves no secrets
(the env file is never read) but transcripts can contain file contents.

  VIEWER_BIND=100.104.153.63 VIEWER_PORT=8790 python3 run-viewer.py
"""
import glob
import json
import os
import re
import subprocess
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

HOME = os.path.expanduser("~")
UNIT = os.environ.get("VIEWER_UNIT", "sreeraj-redesign.service")
REPO = os.environ.get("REDESIGN_REPO_DIR", f"{HOME}/.local/share/sreeraj-redesign/repo")
STATE = os.environ.get("REDESIGN_STATE_DIR", f"{HOME}/.local/share/sreeraj-redesign/state")
SESSIONS = f"{HOME}/.claude/projects/" + REPO.replace("/", "-").replace(".", "-")
BIND = os.environ.get("VIEWER_BIND", "127.0.0.1")
PORT = int(os.environ.get("VIEWER_PORT", "8790"))
HERE = os.path.dirname(os.path.abspath(__file__))

# Runner log lines that mark a stage, in order.
STAGES = [
    ("start", r"=== Monthly redesign"),
    ("auth", r"Auth preflight OK"),
    ("archive", r"Archiving outgoing design|No outgoing edition"),
    ("trend", r"^\[[^\]]+\] Trend: "),
    ("rebuild", r"Rebuild changed|claude rebuild exited"),
    ("build", r"Checkpoint saved"),
    ("layout-qa", r"=== Layout QA & Fix stage ==="),
    ("qa-done", r"layout-qa exit:"),
    ("archives", r"Generating archive snapshots"),
    ("pr", r"https://github\.com/\S+/pull/\d+"),
    ("done", r"=== done ==="),
]
FAILED = re.compile(r"FAILED rc=|FATAL")
TEXT_LIMIT = 20000


def sh(*cmd):
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=20).stdout
    except Exception as err:  # the viewer must never crash on a missing tool
        return f"<{err}>"


def service_state():
    out = sh("systemctl", "--user", "show", UNIT, "-p", "ActiveState", "-p", "SubState",
             "-p", "ExecMainStartTimestamp", "-p", "ExecMainExitTimestamp", "-p", "ExecMainStatus")
    return dict(line.split("=", 1) for line in out.splitlines() if "=" in line)


def run_starts():
    """Start times of every run in the journal, newest first."""
    out = sh("journalctl", "--user", "-u", UNIT, "--no-pager", "-o", "short-iso",
             "--grep", "=== Monthly redesign")
    starts = []
    for line in out.splitlines():
        m = re.match(r"(\S+)\s", line)
        if m and "Monthly redesign" in line:
            starts.append(m.group(1))
    return list(reversed(starts))


def run_log(since, until=None):
    cmd = ["journalctl", "--user", "-u", UNIT, "--no-pager", "-o", "cat", "--since", since]
    if until:
        cmd += ["--until", until]
    return sh(*cmd).splitlines()


def to_epoch(iso):
    return datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp()


def stages_from(lines):
    reached, failed = {}, None
    for line in lines:
        for name, pattern in STAGES:
            if name not in reached and re.search(pattern, line):
                reached[name] = line[:300]
        if FAILED.search(line) and not failed:
            failed = line[:300]
    return [{"name": n, "reached": n in reached, "line": reached.get(n)} for n, _ in STAGES], failed


def read(path, limit=TEXT_LIMIT * 5):
    try:
        with open(path, encoding="utf-8", errors="replace") as f:
            return f.read(limit)
    except OSError:
        return None


def block_text(block):
    kind = block.get("type")
    if kind == "text":
        return block.get("text", "")
    if kind == "thinking":
        # Transcripts keep only a signature for most thinking blocks, not the text.
        return block.get("thinking") or "(thinking text not stored in the transcript)"
    if kind in ("tool_use", "server_tool_use"):
        return json.dumps(block.get("input", {}), indent=2, ensure_ascii=False)
    if kind in ("tool_result", "advisor_tool_result", "web_search_tool_result"):
        content = block.get("content")
        if isinstance(content, list):
            parts = []
            for c in content:
                if c.get("type") == "text":
                    parts.append(c.get("text", ""))
                elif c.get("type") == "image":
                    parts.append("[image]")
                else:
                    parts.append(json.dumps(c, ensure_ascii=False)[:2000])
            return "\n".join(parts)
        if isinstance(content, dict):
            return content.get("text") or json.dumps(content, ensure_ascii=False)
        return str(content or "")
    return json.dumps(block, ensure_ascii=False)[:2000]


def parse_session(path, full=False):
    events, model, title, first_ts, last_ts = [], None, None, None, None
    tokens = {"input": 0, "output": 0, "cache_read": 0, "cache_write": 0}
    tool_names = {}
    with open(path, encoding="utf-8", errors="replace") as f:
        for raw in f:
            try:
                e = json.loads(raw)
            except ValueError:
                continue
            kind, ts = e.get("type"), e.get("timestamp")
            if ts:
                first_ts = first_ts or ts
                last_ts = ts
            if kind == "ai-title" and not title:
                title = e.get("aiTitle") or e.get("title")
            if kind not in ("user", "assistant"):
                continue
            msg = e.get("message") or {}
            if kind == "assistant":
                model = msg.get("model") or model
                u = msg.get("usage") or {}
                tokens["input"] += u.get("input_tokens", 0)
                tokens["output"] += u.get("output_tokens", 0)
                tokens["cache_read"] += u.get("cache_read_input_tokens", 0)
                tokens["cache_write"] += u.get("cache_creation_input_tokens", 0)
            content = msg.get("content")
            blocks = [{"type": "text", "text": content}] if isinstance(content, str) else (content or [])
            for b in blocks:
                bt = b.get("type")
                if bt in ("tool_use", "server_tool_use"):
                    tool_names[b.get("id")] = b.get("name")
                name = b.get("name") or tool_names.get(b.get("tool_use_id"))
                text = block_text(b)
                if not full and len(text) > TEXT_LIMIT:
                    text = text[:TEXT_LIMIT] + f"\n… [{len(text) - TEXT_LIMIT} more chars]"
                events.append({"ts": ts, "role": kind, "kind": bt, "name": name, "text": text,
                               "error": bool(b.get("is_error"))})
    prompt = next((ev["text"] for ev in events if ev["role"] == "user" and ev["kind"] == "text"), "")
    return {
        "id": os.path.basename(path)[:-6],
        "title": title or (prompt.strip().splitlines()[0][:120] if prompt.strip() else None),
        "model": model, "first": first_ts, "last": last_ts, "tokens": tokens,
        "turns": sum(1 for ev in events if ev["role"] == "assistant"),
        "tools": sum(1 for ev in events if ev["kind"] in ("tool_use", "server_tool_use")),
        "events": events,
    }


def sessions_between(start_epoch, end_epoch):
    out = []
    for path in glob.glob(os.path.join(SESSIONS, "*.jsonl")):
        mtime = os.path.getmtime(path)
        if mtime < start_epoch or (end_epoch and mtime > end_epoch + 120):
            continue
        s = parse_session(path)
        s.pop("events")
        out.append(s)
    return sorted(out, key=lambda s: s.get("first") or "")


def state(since=None):
    svc = service_state()
    starts = run_starts()
    since = since or (starts[0] if starts else None)
    if not since:
        return {"service": svc, "runs": starts, "run": None}
    idx = starts.index(since) if since in starts else 0
    until = starts[idx - 1] if idx > 0 else None
    lines = run_log(since, until)
    stages, failed = stages_from(lines)
    current = idx == 0
    running = current and svc.get("ActiveState") in ("activating", "active")
    start_epoch = to_epoch(since) - 5
    end_epoch = to_epoch(until) if until else None
    artifacts = {}
    if current:
        artifacts = {
            "trend_spec": read(os.path.join(REPO, "automation/history/current-trend.json")),
            "rebuild_prompt": read("/tmp/rebuild-prompt.md"),
            "qa_summary": read(os.path.join(REPO, "automation/test-output/layout-qa-summary.md")),
            "trend_line": read(os.path.join(STATE, "trend.txt")),
        }
    return {
        "service": svc, "runs": starts, "run": since, "running": running, "failed": failed,
        "stages": stages, "log": lines[-600:], "milestones": [l for l in lines if l.startswith("[20")],
        "sessions": sessions_between(start_epoch, end_epoch), "artifacts": artifacts,
        "now": datetime.now(timezone.utc).isoformat(),
    }


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype):
        data = body.encode() if isinstance(body, str) else body
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        url = urlparse(self.path)
        q = parse_qs(url.query)
        if url.path == "/":
            return self._send(200, read(os.path.join(HERE, "run-viewer.html"), 10**7) or "missing html",
                              "text/html; charset=utf-8")
        if url.path == "/api/state":
            return self._send(200, json.dumps(state(q.get("since", [None])[0])), "application/json")
        m = re.fullmatch(r"/api/session/([0-9a-f-]{36})", url.path)
        if m:
            path = os.path.join(SESSIONS, m.group(1) + ".jsonl")
            if not os.path.exists(path):
                return self._send(404, '{"error":"no such session"}', "application/json")
            return self._send(200, json.dumps(parse_session(path, full="full" in q)), "application/json")
        return self._send(404, "not found", "text/plain")

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    print(f"run viewer on http://{BIND}:{PORT} (sessions: {SESSIONS})", flush=True)
    ThreadingHTTPServer((BIND, PORT), Handler).serve_forever()
