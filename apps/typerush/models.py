from django.conf import settings
from django.db import models


class TypingResult(models.Model):
    class Mode(models.TextChoices):
        PROSE = "prose", "Prose"
        CODE = "code", "Code"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="typing_results")
    mode = models.CharField(max_length=10, choices=Mode.choices)
    seconds = models.PositiveSmallIntegerField()
    correct_chars = models.PositiveIntegerField()
    keystrokes = models.PositiveIntegerField()
    errors = models.PositiveIntegerField()
    wpm = models.FloatField()  # Always computed by the server from the counts above.
    accuracy = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["seconds", "-wpm"])]
