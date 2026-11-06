"""Small helpers shared by every mini-app's JSON endpoints."""
import json
from functools import wraps

from django.http import JsonResponse


class ApiError(Exception):
    def __init__(self, message, status=400, fields=None):
        super().__init__(message)
        self.message = message
        self.status = status
        self.fields = fields or {}


def api_view(*methods, login=False):
    """Enforce HTTP methods and optional auth, and turn ApiError into a JSON error response."""

    def decorator(view):
        @wraps(view)
        def wrapper(request, *args, **kwargs):
            if request.method not in methods:
                return JsonResponse({"error": "Method not allowed."}, status=405)
            if login and not request.user.is_authenticated:
                return JsonResponse({"error": "Sign in to save this."}, status=401)
            try:
                return view(request, *args, **kwargs)
            except ApiError as error:
                return JsonResponse({"error": error.message, "fields": error.fields}, status=error.status)

        return wrapper

    return decorator


def json_body(request):
    try:
        payload = json.loads(request.body or b"{}")
    except (ValueError, UnicodeDecodeError):
        raise ApiError("Request body must be valid JSON.")
    if not isinstance(payload, dict):
        raise ApiError("Request body must be a JSON object.")
    return payload


def validated(form_class, request, **form_kwargs):
    """Bind a JSON body to a Django form and return the valid form, or raise ApiError."""
    form = form_class(json_body(request), **form_kwargs)
    if not form.is_valid():
        fields = {name: [str(e) for e in errors] for name, errors in form.errors.items()}
        first = next(iter(fields.values()))[0]
        raise ApiError(first, fields=fields)
    return form
