from .models import Note

MAX_NOTES = 1000


def serialize(note):
    return {
        "id": note.id, "title": note.title, "body": note.body, "pinned": note.pinned,
        "updated_at": note.updated_at.isoformat(),
    }


def list_notes(user):
    return [serialize(note) for note in Note.objects.filter(user=user)]


def user_stats(user):
    notes = Note.objects.filter(user=user)
    return [("Notes", notes.count()), ("Pinned", notes.filter(pinned=True).count())]
