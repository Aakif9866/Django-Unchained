from rest_framework import serializers

from .models import Note


class NoteSerializer(serializers.ModelSerializer):
    """A real ModelSerializer now that Note is a real Model — validation
    (max_length etc.) is read straight off the model field definitions
    instead of being duplicated by hand like the Mongo version was."""

    class Meta:
        model = Note
        fields = ['id', 'title', 'content', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
