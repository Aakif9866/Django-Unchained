from django.conf import settings
from django.db import models


class SnakeScore(models.Model):
    class Difficulty(models.TextChoices):
        EASY = "easy", "Easy"
        NORMAL = "normal", "Normal"
        HARD = "hard", "Hard"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="snake_scores")
    difficulty = models.CharField(max_length=10, choices=Difficulty.choices)
    score = models.PositiveIntegerField()
    items_collected = models.PositiveIntegerField()
    duration_seconds = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["difficulty", "-score"])]
