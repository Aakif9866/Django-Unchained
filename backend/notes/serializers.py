from rest_framework import serializers


class NoteSerializer(serializers.Serializer):
    """A plain Serializer, not a ModelSerializer — there's no Django Model
    behind a note, since notes live in MongoDB, not Django's ORM. This
    class's only job is validating input and shaping output; reading from
    and writing to Mongo happens explicitly in the views."""

    id = serializers.CharField(read_only=True)
    title = serializers.CharField(max_length=200)
    content = serializers.CharField(allow_blank=True, required=False, default='')
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
