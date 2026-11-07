#!/usr/bin/env bash
# Render build step. Render's Python runtime already provides Python and uv.
set -o errexit -o nounset -o pipefail

# An earlier version of render.yaml set these, and Render keeps a service's variables even after they
# leave the Blueprint. They clash with Render's own UV_NO_MANAGED_PYTHON, so clear them here.
unset UV_PYTHON UV_PYTHON_INSTALL_DIR UV_PYTHON_PREFERENCE

uv sync --frozen --no-dev --extra prod
.venv/bin/python manage.py collectstatic --noinput
