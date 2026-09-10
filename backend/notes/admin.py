from django.contrib import admin

from .models import Note


@admin.register(Note)
class NoteAdmin(admin.ModelAdmin):
    # Free bonus of being a real Model now — Django's admin can browse
    # notes without any extra code. (Log in at /admin/ with a superuser —
    # `uv run manage.py createsuperuser`.)
    list_display = ['title', 'owner', 'created_at', 'updated_at']
    list_filter = ['owner']
    search_fields = ['title', 'content']
