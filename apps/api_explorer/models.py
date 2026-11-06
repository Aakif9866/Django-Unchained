from django.conf import settings
from django.db import models


class SavedRequest(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="saved_requests")
    name = models.CharField(max_length=80)
    method = models.CharField(max_length=8)
    url = models.CharField(max_length=2048)
    params = models.JSONField(default=list, blank=True)
    headers = models.JSONField(default=list, blank=True)
    body = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class RequestLog(models.Model):
    """History keeps the outline only. Headers and bodies may hold secrets, so they're never logged."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="request_logs")
    method = models.CharField(max_length=8)
    url = models.CharField(max_length=2048)
    status = models.PositiveSmallIntegerField(null=True, blank=True)
    elapsed_ms = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
