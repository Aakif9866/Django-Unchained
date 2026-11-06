from django.conf import settings
from django.db import models


class Favourite(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="favourite_apps")
    app_slug = models.CharField(max_length=40)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [models.UniqueConstraint(fields=["user", "app_slug"], name="unique_favourite_app")]


class RecentApp(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="recent_apps")
    app_slug = models.CharField(max_length=40)
    last_used = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-last_used"]
        constraints = [models.UniqueConstraint(fields=["user", "app_slug"], name="unique_recent_app")]
