from .models import SavedPalette

MAX_SAVED = 200


def serialize(palette):
    return {"id": palette.id, "name": palette.name, "colors": palette.colors}


def list_palettes(user):
    return [serialize(p) for p in SavedPalette.objects.filter(user=user)]


def user_stats(user):
    return [("Saved palettes", SavedPalette.objects.filter(user=user).count())]
