from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import render

from .api import ApiError, api_view
from .registry import APPS, APPS_BY_SLUG, CATEGORIES, apps_in_category
from .services import dashboard_stats, favourite_slugs, recent_apps, toggle_favourite


def _sections():
    return [{"name": c, "slug": apps_in_category(c)[0].category_slug, "apps": apps_in_category(c)} for c in CATEGORIES]


def home(request):
    favourites = favourite_slugs(request.user)
    return render(request, "core/home.html", {
        "all_apps": APPS,
        "sections": _sections(),
        "favourite_slugs": favourites,
        "favourite_apps": [APPS_BY_SLUG[s] for s in favourites if s in APPS_BY_SLUG],
        "recent": recent_apps(request),
    })


@login_required
def dashboard(request):
    favourites = favourite_slugs(request.user)
    return render(request, "core/dashboard.html", {
        "app_stats": dashboard_stats(request.user),
        "favourite_apps": [APPS_BY_SLUG[s] for s in favourites if s in APPS_BY_SLUG],
        "recent": recent_apps(request),
    })


@api_view("POST", login=True)
def favourite_toggle(request, slug):
    if slug not in APPS_BY_SLUG:
        raise ApiError("Unknown app.", status=404)
    return JsonResponse({"favourite": toggle_favourite(request.user, slug)})
