from django.http import HttpResponse

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


class HealthCheckMiddleware:
    """Answers /healthz/ before host and HTTPS checks.

    Platform health checks come from inside the network, often by internal IP over plain HTTP, which
    ALLOWED_HOSTS and the HTTPS redirect would otherwise reject. The response reveals nothing.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path == "/healthz/":
            return HttpResponse("ok", content_type="text/plain")
        return self.get_response(request)
