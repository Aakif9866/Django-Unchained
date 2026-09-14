#!/bin/sh
set -e

echo "Running migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput

echo "Starting gunicorn..."
# --workers: separate OS processes, each with its own GIL — the fix for
# the Phase 2 finding that PBKDF2 password hashing serialized under
# concurrency on the single-process dev server.
#
# --worker-class gthread --threads: WITHOUT this, gunicorn's default
# "sync" worker handles exactly one request at a time per process, full
# stop — 3 workers alone means only 3 requests in flight for the WHOLE
# backend, which is dramatically worse than the dev server's threaded
# model for I/O-bound requests (notes CRUD, waiting on Neon). Found by
# actually re-testing this against Docker, not assumed: the first
# version of this file (just --workers, no thread config) measured
# WORSE under load than the dev server, including on /api/auth/csrf/ —
# a GET with zero DB work — proving it was a concurrency-slot problem,
# not the CPU-bound hashing problem this was originally meant to fix.
# gthread gives each of the processes multiple threads, so it's now
# workers x threads concurrent slots, combining multi-core CPU
# parallelism with the dev server's per-request threading.
#
# threads=4 (the first attempt) was still a real regression under load —
# 3 workers x 4 threads = 12 concurrent slots, and 50 virtual users
# means 38 of them queue behind those 12 at any moment. Confirmed via a
# single-request timing test that this was pure queueing, not per-request
# slowness (individual requests: 2-20ms either way). This workload is
# I/O-bound (every request waits on a Neon network round-trip, not CPU),
# and threads are cheap for I/O-bound concurrency — unlike --workers
# (separate processes, needed for the CPU-bound PBKDF2 hashing problem),
# raising --threads doesn't cost more memory/CPU per unit the way more
# processes would.
exec gunicorn config.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers "${GUNICORN_WORKERS:-3}" \
    --worker-class gthread \
    --threads "${GUNICORN_THREADS:-20}" \
    --access-logfile - \
    --error-logfile -
