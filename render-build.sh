#!/usr/bin/env bash
# Render build step. Installs uv, then the locked dependencies, then collects static files.
set -o errexit -o nounset -o pipefail

curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"

uv sync --frozen --no-dev --extra prod
.venv/bin/python manage.py collectstatic --noinput
