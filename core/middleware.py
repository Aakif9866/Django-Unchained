from .registry import APPS_BY_SLUG
from .services import record_visit


class RecentAppMiddleware:
    """Records a visit whenever a mini-app's landing page is opened."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        return self.get_response(request)

    def process_view(self, request, view_func, view_args, view_kwargs):
        match = request.resolver_match
        if request.method == "GET" and match.url_name == "index" and match.namespace in APPS_BY_SLUG:
            record_visit(request, match.namespace)
