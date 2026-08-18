# ============================================================
# Stage 1 — builder
# ============================================================
ARG PYTHON_VERSION=3.12

FROM ghcr.io/astral-sh/uv:python${PYTHON_VERSION}-bookworm-slim AS builder

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/opt/venv

WORKDIR /app

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH" \
    VIRTUAL_ENV=/opt/venv

COPY pyproject.toml uv.lock ./

# --python-preference only-system: use the image's own CPython for the venv.
# Without this, uv fetches a uv-managed standalone interpreter that lives
# outside /opt/venv and never gets copied into the runtime stage, leaving
# /opt/venv/bin/python a dangling symlink -> ModuleNotFoundError at runtime.
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project --no-dev \
        --python-preference only-system \
    && uv pip install --python /opt/venv/bin/python psutil

# ponytail: no model pre-download, no site-packages stripping. zrt is a thin
# client (~50MB of pure-python deps); STT/LLM/TTS/VAD all resolve over the
# gateway. Add a warmup step back only if a local model ever ships.

# ============================================================
# Stage 2 — runtime
# ============================================================
FROM python:${PYTHON_VERSION}-slim-bookworm AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HOME=/app \
    PATH=/opt/venv/bin:$PATH

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

ARG UID=10001

RUN adduser \
    --disabled-password \
    --gecos "" \
    --home "/app" \
    --shell "/usr/sbin/nologin" \
    --uid "${UID}" \
    appuser

WORKDIR /app

COPY --from=builder --chown=appuser:appuser /opt/venv /opt/venv

COPY --chown=appuser:appuser main.py instruction.py instructions.md script.json /app/

RUN mkdir -p /var/log/agent \
    && chown -R appuser:appuser /var/log/agent

VOLUME ["/var/log/agent"]

USER appuser

CMD ["python", "main.py"]
