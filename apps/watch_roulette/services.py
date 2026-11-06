from django.utils import timezone

from .models import Title


def serialize(title):
    return {
        "id": title.id, "name": title.name, "kind": title.kind, "genre": title.genre, "language": title.language,
        "rating": title.rating, "watched": title.watched, "favourite": title.favourite,
        "watched_at": title.watched_at.isoformat() if title.watched_at else None,
    }


def list_titles(user):
    return [serialize(t) for t in Title.objects.filter(user=user)]


def save_title(form):
    """Keeps watched_at in step with the watched flag, however the flag was changed."""
    title = form.save(commit=False)
    if title.watched and not title.watched_at:
        title.watched_at = timezone.now()
    elif not title.watched:
        title.watched_at = None
    title.user = form.user
    title.save()
    return title


def user_stats(user):
    titles = Title.objects.filter(user=user)
    return [
        ("On watchlist", titles.filter(watched=False).count()),
        ("Watched", titles.filter(watched=True).count()),
        ("Favourites", titles.filter(favourite=True).count()),
    ]
