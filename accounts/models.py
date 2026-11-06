from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    display_name = models.CharField(max_length=40, blank=True)
    bio = models.CharField(max_length=200, blank=True)

    @property
    def shown_name(self):
        return self.display_name or self.username
