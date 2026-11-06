from django.conf import settings
from django.db import models


class SavedPattern(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="saved_patterns")
    name = models.CharField(max_length=80)
    pattern = models.CharField(max_length=2000)
    flags = models.CharField(max_length=8, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
