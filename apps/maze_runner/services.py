from django.db.models import Min

from .models import MazeRun


def leaderboard(difficulty, limit=10):
    rows = (
        MazeRun.objects.filter(difficulty=difficulty)
        .values("user__username")
        .annotate(best=Min("time_ms"))
        .order_by("best", "user__username")[:limit]
    )
    return [{"user": row["user__username"], "time_ms": row["best"]} for row in rows]


def history(user, limit=8):
    if not user.is_authenticated:
        return []
    runs = MazeRun.objects.filter(user=user)[:limit]
    return [{"difficulty": r.difficulty, "time_ms": r.time_ms, "moves": r.moves, "date": r.created_at.isoformat()} for r in runs]


def user_stats(user):
    runs = MazeRun.objects.filter(user=user)
    best = runs.aggregate(best=Min("time_ms"))["best"]
    return [("Mazes finished", runs.count()), ("Fastest", f"{best / 1000:.1f}s" if best else "n/a")]
