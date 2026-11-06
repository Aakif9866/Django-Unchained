from .models import RequestLog, SavedRequest

HISTORY_LIMIT = 50
MAX_SAVED = 100


def serialize_saved(saved):
    return {
        "id": saved.id, "name": saved.name, "method": saved.method, "url": saved.url,
        "params": saved.params, "headers": saved.headers, "body": saved.body,
    }


def list_saved(user):
    return [serialize_saved(s) for s in SavedRequest.objects.filter(user=user)]


def list_history(user):
    return [
        {"id": log.id, "method": log.method, "url": log.url, "status": log.status,
         "elapsed_ms": log.elapsed_ms, "created_at": log.created_at.isoformat()}
        for log in RequestLog.objects.filter(user=user)[:HISTORY_LIMIT]
    ]


def record_history(user, method, url, status=None, elapsed_ms=None):
    RequestLog.objects.create(user=user, method=method, url=url[:2048], status=status, elapsed_ms=elapsed_ms)
    stale = RequestLog.objects.filter(user=user).values_list("pk", flat=True)[HISTORY_LIMIT:]
    RequestLog.objects.filter(pk__in=list(stale)).delete()


def user_stats(user):
    return [
        ("Saved requests", SavedRequest.objects.filter(user=user).count()),
        ("In history", RequestLog.objects.filter(user=user).count()),
    ]
