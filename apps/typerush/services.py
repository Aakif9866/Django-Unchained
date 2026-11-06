import random

from django.db.models import Avg, Max

from .models import TypingResult
from .texts import COLLECTIONS

DURATIONS = (30, 60, 120)
MAX_PLAUSIBLE_WPM = 300
CHARS_PER_WORD = 5
CHARS_PER_SECOND_SUPPLIED = 30  # 360 WPM of text, so no plausible run can reach the end.


def calculate_wpm(correct_chars, seconds):
    """The standard definition: a 'word' is five correct characters."""
    return round((correct_chars / CHARS_PER_WORD) / (seconds / 60), 1)


def calculate_accuracy(keystrokes, errors):
    if keystrokes == 0:
        return 0.0
    return round((keystrokes - errors) / keystrokes * 100, 1)


def build_passage(mode, seconds):
    """Shuffled passages, repeated as needed, long enough to outlast the timer."""
    passages = COLLECTIONS[mode]
    separator = "\n\n" if mode == "code" else " "
    target = seconds * CHARS_PER_SECOND_SUPPLIED
    chosen, length = [], 0
    while length < target:
        for passage in random.sample(passages, len(passages)):
            chosen.append(passage)
            length += len(passage) + len(separator)
            if length >= target:
                break
    return separator.join(chosen)


def leaderboard(seconds, limit=10):
    rows = (
        TypingResult.objects.filter(seconds=seconds)
        .values("user__username")
        .annotate(best=Max("wpm"))
        .order_by("-best", "user__username")[:limit]
    )
    return [{"user": row["user__username"], "wpm": row["best"]} for row in rows]


def history(user, limit=20):
    if not user.is_authenticated:
        return []
    results = TypingResult.objects.filter(user=user)[:limit]
    return [
        {"wpm": r.wpm, "accuracy": r.accuracy, "seconds": r.seconds, "mode": r.mode, "date": r.created_at.isoformat()}
        for r in results
    ]


def user_stats(user):
    results = TypingResult.objects.filter(user=user)
    numbers = results.aggregate(best=Max("wpm"), avg=Avg("accuracy"))
    return [
        ("Tests saved", results.count()),
        ("Best WPM", numbers["best"] or 0),
        ("Avg accuracy", f"{numbers['avg']:.0f}%" if numbers["avg"] is not None else "n/a"),
    ]
