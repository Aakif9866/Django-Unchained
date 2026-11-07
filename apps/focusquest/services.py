"""FocusQuest rules. XP is derived here from the server clock; the browser never supplies it.

The invariant: a user can't earn more than XP_PER_MINUTE per minute of real elapsed time, because
a session pays out only once its planned time has really passed, starting a new session abandons
the previous one, and a session can only pay out once.
"""
from dataclasses import dataclass
from datetime import timedelta

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from .models import FocusSession, UserAchievement

XP_PER_MINUTE = 2
XP_LEVEL_STEP = 50
PRESET_MINUTES = {FocusSession.Mode.POMODORO: 25, FocusSession.Mode.DEEP: 50}
MAX_CUSTOM_MINUTES = 180
GRACE_SECONDS = 5  # Tolerates a little network and timer jitter on the final tick.
MAX_OVERRUN = timedelta(hours=2)  # Longer than this, and the session was left running, not worked.

Status = FocusSession.Status


class SessionError(Exception):
    """Message is safe to show the user."""


def xp_for_level(level):
    """Total XP needed to reach a level: 0, 100, 300, 600, 1000, ..."""
    return XP_LEVEL_STEP * level * (level - 1)


def level_for_xp(xp):
    level = 1
    while xp >= xp_for_level(level + 1):
        level += 1
    return level


def start_session(user, mode, custom_minutes=None):
    minutes = PRESET_MINUTES.get(mode, custom_minutes)
    with transaction.atomic():
        FocusSession.objects.filter(user=user, status=Status.ACTIVE).update(status=Status.ABANDONED)
        return FocusSession.objects.create(user=user, mode=mode, planned_minutes=minutes, started_at=timezone.now())


def abandon_session(user):
    FocusSession.objects.filter(user=user, status=Status.ACTIVE).update(status=Status.ABANDONED)


def complete_session(user, session_id):
    """Returns (session, newly_unlocked_achievement_keys). Raises SessionError if it hasn't been earned."""
    now = timezone.now()
    with transaction.atomic():
        session = FocusSession.objects.select_for_update().filter(pk=session_id, user=user, status=Status.ACTIVE).first()
        if session is None:
            raise SessionError("That session isn't active, so it can't be completed.")
        planned = timedelta(minutes=session.planned_minutes)
        elapsed = now - session.started_at
        if elapsed < planned - timedelta(seconds=GRACE_SECONDS):
            remaining = int((planned - elapsed).total_seconds())
            raise SessionError(f"This session still has {remaining} seconds to run.")
        if elapsed > planned + MAX_OVERRUN:
            # Commit the abandonment, then raise outside the block: raising in here would roll it back.
            session.status = Status.ABANDONED
            session.save(update_fields=["status"])
            overrun = True
        else:
            overrun = False
            session.status = Status.COMPLETED
            session.completed_at = now
            session.xp_awarded = session.planned_minutes * XP_PER_MINUTE
            session.save(update_fields=["status", "completed_at", "xp_awarded"])
            unlocked = _unlock_achievements(user)
    if overrun:
        raise SessionError("That session was left running too long to count.")
    return session, unlocked


def _active_days(user):
    days = FocusSession.objects.filter(user=user, status=Status.COMPLETED).values_list("completed_at", flat=True)
    return {timezone.localdate(moment) for moment in days}


def streaks(user, today=None):
    """Returns (current, longest). A streak survives until a full calendar day passes with no session."""
    today = today or timezone.localdate()
    days = _active_days(user)
    current = 0
    cursor = today if today in days else today - timedelta(days=1)
    while cursor in days:
        current += 1
        cursor -= timedelta(days=1)
    longest = run = 0
    previous = None
    for day in sorted(days):
        run = run + 1 if previous and day - previous == timedelta(days=1) else 1
        longest = max(longest, run)
        previous = day
    return current, longest


def _totals(user):
    done = FocusSession.objects.filter(user=user, status=Status.COMPLETED)
    numbers = done.aggregate(xp=Sum("xp_awarded"), minutes=Sum("planned_minutes"))
    return {"sessions": done.count(), "xp": numbers["xp"] or 0, "minutes": numbers["minutes"] or 0}


@dataclass(frozen=True)
class Achievement:
    key: str
    name: str
    description: str
    icon: str
    earned: callable


ACHIEVEMENTS = [
    Achievement("first_step", "First Step", "Complete your first focus session", "flag", lambda s: s["sessions"] >= 1),
    Achievement("steady", "Steady Hands", "Complete 5 sessions", "hand-thumbs-up", lambda s: s["sessions"] >= 5),
    Achievement("regular", "Regular", "Complete 25 sessions", "calendar-check", lambda s: s["sessions"] >= 25),
    Achievement("deep_diver", "Deep Diver", "Finish a session of 50 minutes or more", "water", lambda s: s["longest_session"] >= 50),
    Achievement("ten_hours", "Ten Hours In", "Focus for 10 hours in total", "hourglass-bottom", lambda s: s["minutes"] >= 600),
    Achievement("spark", "Spark", "Reach a 3 day streak", "fire", lambda s: s["longest_streak"] >= 3),
    Achievement("week_warrior", "Week Warrior", "Reach a 7 day streak", "lightning-charge", lambda s: s["longest_streak"] >= 7),
    Achievement("level_five", "Level Five", "Reach level 5", "stars", lambda s: level_for_xp(s["xp"]) >= 5),
]


def _unlock_achievements(user):
    numbers = _totals(user)
    numbers["longest_streak"] = streaks(user)[1]
    numbers["longest_session"] = max(
        FocusSession.objects.filter(user=user, status=Status.COMPLETED).values_list("planned_minutes", flat=True),
        default=0,
    )
    held = set(UserAchievement.objects.filter(user=user).values_list("key", flat=True))
    fresh = [a for a in ACHIEVEMENTS if a.key not in held and a.earned(numbers)]
    UserAchievement.objects.bulk_create([UserAchievement(user=user, key=a.key) for a in fresh], ignore_conflicts=True)
    return [a.key for a in fresh]


def _weekly_minutes(user):
    today = timezone.localdate()
    days = [today - timedelta(days=offset) for offset in range(6, -1, -1)]
    minutes = {day: 0 for day in days}
    recent = FocusSession.objects.filter(
        user=user, status=Status.COMPLETED, completed_at__gte=timezone.now() - timedelta(days=8)
    ).values_list("completed_at", "planned_minutes")
    for moment, planned in recent:
        day = timezone.localdate(moment)
        if day in minutes:
            minutes[day] += planned
    return [{"date": day.isoformat(), "minutes": minutes[day]} for day in days]


def _active_payload(user):
    session = FocusSession.objects.filter(user=user, status=Status.ACTIVE).first()
    if session is None:
        return None
    return {
        "id": session.id, "mode": session.mode, "planned_minutes": session.planned_minutes,
        "elapsed_seconds": (timezone.now() - session.started_at).total_seconds(),
    }


def state(user):
    totals = _totals(user)
    level = level_for_xp(totals["xp"])
    current, longest = streaks(user)
    unlocked = dict(UserAchievement.objects.filter(user=user).values_list("key", "unlocked_at"))
    history = FocusSession.objects.filter(user=user).exclude(status=Status.ACTIVE)[:12]
    return {
        **totals,
        "level": level,
        "level_floor_xp": xp_for_level(level),
        "level_next_xp": xp_for_level(level + 1),
        "streak": current,
        "longest_streak": longest,
        "week": _weekly_minutes(user),
        "active": _active_payload(user),
        "history": [
            {"mode": s.get_mode_display(), "minutes": s.planned_minutes, "status": s.status, "xp": s.xp_awarded,
             "started_at": s.started_at.isoformat()}
            for s in history
        ],
        "achievements": [
            {"key": a.key, "name": a.name, "description": a.description, "icon": a.icon,
             "unlocked_at": unlocked[a.key].isoformat() if a.key in unlocked else None}
            for a in ACHIEVEMENTS
        ],
    }


def achievement_names(keys):
    return [a.name for a in ACHIEVEMENTS if a.key in keys]


def user_stats(user):
    totals = _totals(user)
    return [
        ("Level", level_for_xp(totals["xp"])),
        ("XP", totals["xp"]),
        ("Focus minutes", totals["minutes"]),
        ("Day streak", streaks(user)[0]),
    ]
