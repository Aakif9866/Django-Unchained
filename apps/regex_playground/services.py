from .models import SavedPattern

MAX_SAVED_PATTERNS = 200


def serialize(pattern):
    return {"id": pattern.id, "name": pattern.name, "pattern": pattern.pattern, "flags": pattern.flags}


def list_patterns(user):
    return [serialize(p) for p in SavedPattern.objects.filter(user=user)]


def user_stats(user):
    return [("Saved patterns", SavedPattern.objects.filter(user=user).count())]
