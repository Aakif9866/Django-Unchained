from django.conf import settings
from django.db import models


class FocusSession(models.Model):
    class Mode(models.TextChoices):
        POMODORO = "pomodoro", "25 / 5"
        DEEP = "deep", "50 / 10"
        CUSTOM = "custom", "Custom"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        COMPLETED = "completed", "Completed"
        ABANDONED = "abandoned", "Abandoned"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="focus_sessions")
    mode = models.CharField(max_length=10, choices=Mode.choices)
    planned_minutes = models.PositiveSmallIntegerField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    started_at = models.DateTimeField()  # Always set from the server clock.
    completed_at = models.DateTimeField(null=True, blank=True)
    xp_awarded = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-started_at"]
        indexes = [models.Index(fields=["user", "status"])]


class UserAchievement(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="focus_achievements")
    key = models.CharField(max_length=40)
    unlocked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "key"], name="unique_user_achievement")]
