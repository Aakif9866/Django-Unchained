from django.utils.module_loading import import_string

from .models import Favourite, RecentApp
from .registry import APPS, APPS_BY_SLUG

RECENT_LIMIT = 4
SESSION_KEY = "recent_apps"


def record_visit(request, slug):
    if request.user.is_authenticated:
        RecentApp.objects.update_or_create(user=request.user, app_slug=slug)
        return
    recent = [slug] + [s for s in request.session.get(SESSION_KEY, []) if s != slug]
    request.session[SESSION_KEY] = recent[:RECENT_LIMIT]


def recent_apps(request):
    if request.user.is_authenticated:
        slugs = RecentApp.objects.filter(user=request.user).values_list("app_slug", flat=True)[:RECENT_LIMIT]
    else:
        slugs = request.session.get(SESSION_KEY, [])
    return [APPS_BY_SLUG[s] for s in slugs if s in APPS_BY_SLUG]


def favourite_slugs(user):
    if not user.is_authenticated:
        return []
    return list(Favourite.objects.filter(user=user).values_list("app_slug", flat=True))


def toggle_favourite(user, slug):
    """Returns True if the app is a favourite after the toggle."""
    favourite, created = Favourite.objects.get_or_create(user=user, app_slug=slug)
    if not created:
        favourite.delete()
    return created


def dashboard_stats(user):
    """Ask each app for its own numbers, so core never reaches into their models."""
    return [{"app": app, "stats": import_string(app.stats)(user)} for app in APPS if app.stats]
