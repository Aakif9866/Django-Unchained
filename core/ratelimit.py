"""Fixed-window rate limiting on Django's cache framework."""
from django.core.cache import cache


def allow(key, limit, window_seconds):
    # ponytail: LocMemCache counts per process, so the real limit is limit x workers.
    # Point CACHES at a shared backend if this ever runs on many workers.
    cache_key = f"ratelimit:{key}"
    cache.add(cache_key, 0, window_seconds)
    try:
        return cache.incr(cache_key) <= limit
    except ValueError:  # Expired between add and incr.
        return True


def client_ip(request):
    # REMOTE_ADDR, not X-Forwarded-For, because that header is client-controlled. Behind a
    # proxy every client shares a bucket, which fails towards being too strict, not too loose.
    return request.META.get("REMOTE_ADDR", "unknown")
