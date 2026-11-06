from django.contrib import admin

from .models import RequestLog, SavedRequest

admin.site.register(SavedRequest)
admin.site.register(RequestLog)
