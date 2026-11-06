from django.conf import settings
from django.db import models


class Title(models.Model):
    class Kind(models.TextChoices):
        MOVIE = "movie", "Movie"
        SERIES = "series", "Series"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="watch_titles")
    name = models.CharField(max_length=200)
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.MOVIE)
    genre = models.CharField(max_length=40)
    language = models.CharField(max_length=40)
    rating = models.PositiveSmallIntegerField(null=True, blank=True)
    watched = models.BooleanField(default=False)
    watched_at = models.DateTimeField(null=True, blank=True)
    favourite = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [models.UniqueConstraint(fields=["user", "name", "kind"], name="unique_title_per_user")]
