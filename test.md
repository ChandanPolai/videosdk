https://api.videosdk.live/v2/sip/call

{
    "sipCallFrom": "+912269980418",
    "sipCallTo": "+919535051051",
    "routingRuleId": "rr_vuzrma",
    "metadata": {
        "name": "Indu"
    }
}

Authorization

eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhcGlrZXkiOiI1YTBhYjYwMS05NWVlLTRmZTMtYmQ5Yi01MDM0ZTczYmE4NGEiLCJwZXJtaXNzaW9ucyI6WyJhbGxvd19qb2luIl0sImlhdCI6MTc4NjQzODU5NSwiZXhwIjoxNzg3MDQzMzk1fQ.OLyuhLIgBY20maaVcGgNUfGwZw7BAn-XWf5PLcP6FfI


Poora setup + run commands:

```bash
# 1. Project folder
cd /home/mark-pc/Desktop/chandan/videosdk/zrt-demo-agent

# 2. uv install (agar nahi hai)
pip install uv

# 3. Dependencies + videosdk-cli
uv sync

# 4. CLI check + login (agar pehle se login nahi)
.venv/bin/videosdk --help
.venv/bin/videosdk auth login
.venv/bin/videosdk auth whoami

# 5. Voice agent (terminal 1)
uv run main.py

# 6. Script API / dashboard backend (terminal 2)
uv run python script_api.py
```

**Sirf CLI alag se install** (agar zarurat pade):
```bash
cd /home/mark-pc/Desktop/chandan/videosdk/zrt-demo-agent
uv pip install videosdk-cli
```

**Manual cloud push** (dashboard ke bina):
```bash
cd /home/mark-pc/Desktop/chandan/videosdk/zrt-demo-agent
.venv/bin/videosdk agent up
```

Push se pehle Docker chal raha hona chahiye.