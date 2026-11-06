from django.db.models import Max

from .models import SnakeScore


def leaderboard(difficulty, limit=10):
    rows = (
        SnakeScore.objects.filter(difficulty=difficulty)
        .values("user__username")
        .annotate(best=Max("score"))
        .order_by("-best", "user__username")[:limit]
    )
    return [{"user": row["user__username"], "score": row["best"]} for row in rows]


def personal_best(user, difficulty):
    if not user.is_authenticated:
        return None
    return SnakeScore.objects.filter(user=user, difficulty=difficulty).aggregate(best=Max("score"))["best"]


def user_stats(user):
    scores = SnakeScore.objects.filter(user=user)
    return [("Games saved", scores.count()), ("Best score", scores.aggregate(best=Max("score"))["best"] or 0)]
