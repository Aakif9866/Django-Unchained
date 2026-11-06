from .models import Favourite
from .registry import APPS_BY_SLUG, CATEGORIES, apps_in_category


def sidequest(request):
    match = getattr(request, "resolver_match", None)
    current_app = APPS_BY_SLUG.get(match.namespace) if match else None
    user = getattr(request, "user", None)
    is_favourite = bool(
        current_app and user and user.is_authenticated
        and Favourite.objects.filter(user=user, app_slug=current_app.slug).exists()
    )
    return {
        "nav_categories": [(category, apps_in_category(category)) for category in CATEGORIES],
        "current_app": current_app,
        "is_favourite": is_favourite,
    }
