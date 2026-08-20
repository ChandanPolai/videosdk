# ZRT Demo Agent — Setup & Run Guide

AI voice calling agent built with [ZeroRuntime](https://videosdk.live) that handles IPO investor calls for Raaj Investment.

---

## Prerequisites

- Python **3.12** (exactly, not 3.13+)
- [`uv`](https://docs.astral.sh/uv/getting-started/installation/) package manager

Install `uv` if you don't have it:

```bash
pip install uv
```

---

## 1. Clone & Navigate

```bash
cd zrt-demo-agent
```

---

## 2. Set Up Environment Variables

Copy the example and fill in your values:

```bash
cp .env.example .env   # if .env.example exists, otherwise edit .env directly
```

Your `.env` should have:

```env
ZERORUNTIME_AUTH_TOKEN=your_token_here
AGENT_ID=your_agent_id
CALL_TRANSFER_TO=+91XXXXXXXXXX
```

---

## 3. Install Dependencies

```bash
uv sync
```

This creates a `.venv` folder and installs all packages from `pyproject.toml`.

---

## Running Locally

### Voice Agent (main process)

Starts the voice agent that connects to VideoSDK and handles live calls:

```bash
uv run main.py
```

Or using the virtual environment directly:

```bash
# Windows
.venv\Scripts\python main.py

# macOS / Linux
.venv/bin/python main.py
```

### Script API Server (local dashboard backend)

Starts a local HTTP API on `http://127.0.0.1:8787` for reading/updating the agent script and instructions without redeploying:

```bash
uv run python script_api.py
```

Available endpoints:

| Method | Endpoint          | Description                        |
|--------|-------------------|------------------------------------|
| GET    | `/script`         | Load current agent script          |
| PUT    | `/script`         | Save script + optionally push live |
| GET    | `/deploy/status`  | Check deploy status and logs       |

> **Tip:** Run both commands in separate terminal windows — the voice agent and the script API are independent processes.

---

## Running on Server (Docker / VideoSDK Cloud)

### Build Docker Image

```bash
docker build -t raaj-investment-priya:latest .
```

### Run with Docker

```bash
docker run --env-file .env raaj-investment-priya:latest
```

### Deploy to VideoSDK Cloud

Make sure you have the VideoSDK CLI installed and are logged in, then:

```bash
videosdk agent up
```

This uses the config in `videosdk.yaml` to build and deploy the agent to the cloud.

> The `script_api.py` also has a built-in deploy trigger — send a `PUT /script` request with `"push": true` to save the script and kick off `videosdk agent up` automatically.

---

## Project Structure

```
zrt-demo-agent/
├── main.py           # Voice agent entry point
├── instruction.py    # INSTRUCTIONS constant loaded by main.py
├── instructions.md   # Agent script / conversation guide (editable)
├── script.json       # Agent name, company, opening line
├── script_api.py     # Local HTTP API for script management
├── videosdk.yaml     # VideoSDK Cloud deploy config
├── Dockerfile        # Docker build definition
├── pyproject.toml    # Python dependencies
├── uv.lock           # Locked dependency versions
└── .env              # Environment variables (never commit this)
```

---

## Common Issues

| Problem | Fix |
|---|---|
| `uv: command not found` | Install uv: `pip install uv` |
| Python version mismatch | Install Python 3.12 exactly — 3.13 is not supported |
| Auth token error | Check `ZERORUNTIME_AUTH_TOKEN` in `.env` |
| Port 8787 already in use | Set `SCRIPT_API_PORT=8788` in `.env` before running `script_api.py` |
