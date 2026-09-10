from django.conf import settings
from django.db import models


class Note(models.Model):
    # A real ForeignKey, DB-enforced — unlike the plain owner_id int we had
    # to use by hand against MongoDB. Deleting a User cascades to their
    # notes; the DB itself guarantees a note can't reference a user that
    # doesn't exist.
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notes',
    )
    title = models.CharField(max_length=200)
    content = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title
