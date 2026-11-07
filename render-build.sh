#!/usr/bin/env bash
# Render build step. Render's Python runtime already provides Python and uv.
set -o errexit -o nounset -o pipefail

uv sync --frozen --no-dev --extra prod
.venv/bin/python manage.py collectstatic --noinput
