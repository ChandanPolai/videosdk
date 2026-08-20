#!/usr/bin/env python3
"""Local dashboard API for Agent Script load / save / VideoSDK push.

Run from zrt-demo-agent:

    uv run python script_api.py
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

AGENT_DIR = Path(__file__).resolve().parent
SCRIPT_JSON = AGENT_DIR / "script.json"
INSTRUCTIONS_MD = AGENT_DIR / "instructions.md"
YAML_PATH = AGENT_DIR / "videosdk.yaml"
ENV_PATH = AGENT_DIR / ".env"
IMAGE_TAG_RE = re.compile(
    r"^(?P<indent>\s*image:\s*)(?P<repo>[^\s#]+):v(?P<num>\d+)\s*$",
    re.MULTILINE,
)
HOST = os.getenv("SCRIPT_API_HOST", "127.0.0.1")
PORT = int(os.getenv("SCRIPT_API_PORT", "8787"))

DEFAULT_SCRIPT = {
    "agent_name": "Priya",
    "company": "Raaj Investment",
    "opening_line": "Hello, kya main {name} ji se baat kar rahi hoon?",
    "instructions": "",
    "call_transfer_to": "",
}

_lock = threading.Lock()
_deploy = {
    "status": "idle",
    "log": [],
    "error": None,
    "image": None,
}


def _read_json(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _read_env_value(key: str) -> str:
    """Read a single key from the .env file without loading into os.environ."""
    if not ENV_PATH.exists():
        return ""
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        if k.strip() == key:
            return v.strip().strip('"').strip("'")
    return ""


def _write_env_value(key: str, value: str) -> None:
    """Update or append a key in the .env file."""
    content = ENV_PATH.read_text(encoding="utf-8") if ENV_PATH.exists() else ""
    lines = content.splitlines(keepends=True)
    updated = False
    new_lines = []
    for line in lines:
        stripped = line.strip()
        if not stripped.startswith("#") and "=" in stripped:
            k, _, _ = stripped.partition("=")
            if k.strip() == key:
                new_lines.append(f"{key}={value}\n")
                updated = True
                continue
        new_lines.append(line)
    if not updated:
        if new_lines and not new_lines[-1].endswith("\n"):
            new_lines.append("\n")
        new_lines.append(f"{key}={value}\n")
    ENV_PATH.write_text("".join(new_lines), encoding="utf-8")


def load_script() -> dict:
    stored = _read_json(SCRIPT_JSON)
    instructions = stored.get("instructions") or ""
    if not instructions and INSTRUCTIONS_MD.exists():
        instructions = INSTRUCTIONS_MD.read_text(encoding="utf-8")
    # call_transfer_to: prefer .env as source of truth, fall back to script.json cache
    call_transfer_to = _read_env_value("CALL_TRANSFER_TO") or str(stored.get("call_transfer_to") or "").strip()
    return {
        "agent_name": (stored.get("agent_name") or DEFAULT_SCRIPT["agent_name"]).strip(),
        "company": (stored.get("company") or DEFAULT_SCRIPT["company"]).strip(),
        "opening_line": (stored.get("opening_line") or DEFAULT_SCRIPT["opening_line"]).strip(),
        "instructions": instructions,
        "call_transfer_to": call_transfer_to,
    }


def save_script(payload: dict) -> dict:
    script = {
        "agent_name": str(payload.get("agent_name") or DEFAULT_SCRIPT["agent_name"]).strip() or "Priya",
        "company": str(payload.get("company") or DEFAULT_SCRIPT["company"]).strip() or "Raaj Investment",
        "opening_line": str(payload.get("opening_line") or "").strip(),
        "instructions": str(payload.get("instructions") or "").strip(),
        "call_transfer_to": str(payload.get("call_transfer_to") or "").strip(),
    }
    SCRIPT_JSON.write_text(
        json.dumps(
            {
                "agent_name": script["agent_name"],
                "company": script["company"],
                "opening_line": script["opening_line"],
                "call_transfer_to": script["call_transfer_to"],
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )
    INSTRUCTIONS_MD.write_text(script["instructions"].rstrip() + "\n", encoding="utf-8")
    _write_env_value("CALL_TRANSFER_TO", script["call_transfer_to"])
    return script


def _yaml_image() -> str | None:
    if not YAML_PATH.exists():
        return None
    match = IMAGE_TAG_RE.search(YAML_PATH.read_text(encoding="utf-8"))
    if not match:
        return None
    return f"{match.group('repo')}:v{match.group('num')}"


def bump_image_tag() -> str:
    if not YAML_PATH.exists():
        raise FileNotFoundError(f"Missing {YAML_PATH.name}")
    text = YAML_PATH.read_text(encoding="utf-8")
    match = IMAGE_TAG_RE.search(text)
    if not match:
        raise ValueError("videosdk.yaml has no image tag like :v19")
    new_num = int(match.group("num")) + 1
    new_image = f"{match.group('repo')}:v{new_num}"
    new_text, count = IMAGE_TAG_RE.subn(
        lambda m: f"{m.group('indent')}{m.group('repo')}:v{int(m.group('num')) + 1}",
        text,
        count=1,
    )
    if count != 1:
        raise ValueError("Could not bump image tag in videosdk.yaml")
    YAML_PATH.write_text(new_text, encoding="utf-8")
    return new_image


def deploy_snapshot() -> dict:
    with _lock:
        return {
            "status": _deploy["status"],
            "log": list(_deploy["log"]),
            "error": _deploy["error"],
            "image": _deploy["image"] or _yaml_image(),
        }


def _append_log(line: str) -> None:
    text = line.rstrip("\n")
    if not text:
        return
    with _lock:
        _deploy["log"].append(text)
        if len(_deploy["log"]) > 400:
            _deploy["log"] = _deploy["log"][-400:]
        image = _extract_image(text)
        if image:
            _deploy["image"] = image


def _extract_image(line: str) -> str | None:
    lowered = line.lower()
    if "vcr.videosdk.live/" in line:
        for part in line.replace(",", " ").split():
            if "vcr.videosdk.live/" in part:
                return part.strip().rstrip(".,;")
    if "image:" in lowered:
        return line.split(":", 1)[-1].strip() or None
    return None


def _python_bin() -> str:
    venv_python = AGENT_DIR / ".venv" / "bin" / "python"
    if venv_python.exists():
        return str(venv_python)
    return sys.executable


def _push_command() -> list[str]:
    python_bin = _python_bin()
    code = (
        "import sys\n"
        "from videosdk_cli.main import cli\n"
        "sys.argv = ['videosdk'] + sys.argv[1:]\n"
        "cli()\n"
    )
    return [python_bin, "-c", code, "agent", "up"]


def start_push() -> bool:
    with _lock:
        if _deploy["status"] == "running":
            return False
        _deploy.update({"status": "running", "log": [], "error": None})
        _deploy["log"].append("Saving script and starting VideoSDK push…")
        _deploy["log"].append("Command: videosdk agent up")

    thread = threading.Thread(target=_run_push, name="videosdk-push", daemon=True)
    thread.start()
    return True


def _run_push() -> None:
    try:
        image = bump_image_tag()
        _append_log(f"Bumped videosdk.yaml image to {image}")
        with _lock:
            _deploy["image"] = image
    except Exception as exc:
        with _lock:
            _deploy["status"] = "error"
            _deploy["error"] = str(exc)
            _deploy["log"].append(f"Failed to bump image tag: {exc}")
        return

    env = os.environ.copy()
    env.setdefault("PYTHONUNBUFFERED", "1")
    try:
        proc = subprocess.Popen(
            _push_command(),
            cwd=str(AGENT_DIR),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            env=env,
        )
    except Exception as exc:
        with _lock:
            _deploy["status"] = "error"
            _deploy["error"] = str(exc)
            _deploy["log"].append(f"Failed to start push: {exc}")
        return

    assert proc.stdout is not None
    for line in proc.stdout:
        _append_log(line)

    code = proc.wait()
    with _lock:
        if code == 0:
            _deploy["status"] = "success"
            _deploy["log"].append("Push finished successfully.")
        else:
            _deploy["status"] = "error"
            _deploy["error"] = f"videosdk agent up exited with {code}"
            _deploy["log"].append(_deploy["error"])


def _send_json(handler: BaseHTTPRequestHandler, status: int, payload: dict) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "GET, PUT, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.end_headers()
    handler.wfile.write(body)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:
        sys.stderr.write("[script-api] " + (format % args) + "\n")

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, PUT, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:
        path = urlparse(self.path).path.rstrip("/") or "/"
        if path == "/script":
            _send_json(self, 200, load_script())
            return
        if path == "/deploy/status":
            _send_json(self, 200, deploy_snapshot())
            return
        _send_json(self, 404, {"detail": "Not found"})

    def do_PUT(self) -> None:
        path = urlparse(self.path).path.rstrip("/") or "/"
        if path != "/script":
            _send_json(self, 404, {"detail": "Not found"})
            return

        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        try:
            payload = json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            _send_json(self, 400, {"detail": "Invalid JSON"})
            return

        if not str(payload.get("opening_line") or "").strip() or not str(payload.get("instructions") or "").strip():
            _send_json(self, 400, {"detail": "Opening line and script both required"})
            return

        saved = save_script(payload)
        push = bool(payload.get("push"))
        push_started = False
        if push:
            push_started = start_push()

        _send_json(
            self,
            200,
            {
                **saved,
                "push_started": push_started if push else None,
                "deploy": deploy_snapshot(),
            },
        )


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Agent Script API listening on http://{HOST}:{PORT}")
    print("GET /script  PUT /script  GET /deploy/status")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Agent Script API")
        server.server_close()


if __name__ == "__main__":
    main()
