# --- Build stage: resolve dependencies with uv, same lockfile as local dev ---
FROM python:3.12-slim AS builder

RUN pip install --no-cache-dir uv

WORKDIR /app
COPY pyproject.toml uv.lock ./
# --frozen: fail instead of silently re-resolving if uv.lock is out of date.
# --no-dev: this image only needs runtime deps, not test/lint tooling.
RUN uv sync --frozen --no-dev --no-install-project

COPY . .
RUN uv sync --frozen --no-dev

# --- Runtime stage: only the venv + app code, not uv/pip/build tools ---
FROM python:3.12-slim

RUN useradd --create-home appuser
WORKDIR /app

COPY --from=builder --chown=appuser:appuser /app /app
# --chown above only applies to what COPY creates/copies — WORKDIR
# already created /app as root before this step, so the directory
# itself is still root-owned and appuser can't mkdir inside it (this
# broke `collectstatic`, which needs to create staticfiles/ at runtime).
RUN chown appuser:appuser /app && chmod +x /app/entrypoint.sh
ENV PATH="/app/.venv/bin:$PATH"

USER appuser
EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]
