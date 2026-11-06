from django.conf import settings
from django.db import models


class MazeRun(models.Model):
    class Difficulty(models.TextChoices):
        EASY = "easy", "Easy"
        MEDIUM = "medium", "Medium"
        HARD = "hard", "Hard"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="maze_runs")
    difficulty = models.CharField(max_length=10, choices=Difficulty.choices)
    time_ms = models.PositiveIntegerField()
    moves = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["difficulty", "time_ms"])]
