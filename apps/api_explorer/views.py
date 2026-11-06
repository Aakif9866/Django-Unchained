from django.http import JsonResponse
from django.shortcuts import get_object_or_404, render

from core.api import ApiError, api_view, validated
from core.ratelimit import allow, client_ip

from . import safe_http, services
from .forms import SaveForm, SendForm
from .models import RequestLog, SavedRequest

USER_REQUESTS_PER_MINUTE = 30
GUEST_REQUESTS_PER_MINUTE = 10


def index(request):
    return render(request, "api_explorer/index.html", {
        "methods": safe_http.ALLOWED_METHODS,
        "timeout": safe_http.TOTAL_TIMEOUT_SECONDS,
        "max_mb": safe_http.MAX_RESPONSE_BYTES // (1024 * 1024),
    })


def _throttle(request):
    if request.user.is_authenticated:
        key, limit = f"api-explorer:user:{request.user.pk}", USER_REQUESTS_PER_MINUTE
    else:
        key, limit = f"api-explorer:ip:{client_ip(request)}", GUEST_REQUESTS_PER_MINUTE
    if not allow(key, limit, 60):
        raise ApiError(f"Limit reached: {limit} requests a minute. Give it a moment.", status=429)


@api_view("POST")
def send(request):
    _throttle(request)
    data = validated(SendForm, request).cleaned_data
    method = data["method"]
    url = safe_http.build_url(data["url"].strip(), data["params"])
    headers = dict(data["headers"])
    if data["body"] and method not in ("GET", "HEAD") and not any(k.lower() == "content-type" for k in headers):
        headers["Content-Type"] = "application/json"
    logged_in = request.user.is_authenticated
    try:
        result = safe_http.send(method, url, headers, data["body"] or None)
    except safe_http.BlockedDestination as error:
        raise ApiError(str(error), status=403)
    except safe_http.RequestFailed as error:
        if logged_in:
            services.record_history(request.user, method, url)
        raise ApiError(str(error), status=502)
    if logged_in:
        services.record_history(request.user, method, url, result["status"], result["elapsed_ms"])
    return JsonResponse(result)


@api_view("GET", "DELETE", login=True)
def history(request):
    if request.method == "DELETE":
        RequestLog.objects.filter(user=request.user).delete()
    return JsonResponse({"history": services.list_history(request.user)})


@api_view("GET", "POST", login=True)
def saved(request):
    if request.method == "GET":
        return JsonResponse({"saved": services.list_saved(request.user)})
    if SavedRequest.objects.filter(user=request.user).count() >= services.MAX_SAVED:
        raise ApiError("You've reached the saved request limit. Delete one first.")
    data = validated(SaveForm, request).cleaned_data
    item = SavedRequest.objects.create(user=request.user, **data)
    return JsonResponse(services.serialize_saved(item), status=201)


@api_view("DELETE", login=True)
def delete_saved(request, pk):
    get_object_or_404(SavedRequest, pk=pk, user=request.user).delete()
    return JsonResponse({"deleted": True})
