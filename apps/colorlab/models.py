from django.conf import settings
from django.db import models


class SavedPalette(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="saved_palettes")
    name = models.CharField(max_length=60)
    colors = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
