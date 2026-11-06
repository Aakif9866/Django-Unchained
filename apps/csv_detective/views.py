from django.http import HttpResponse, JsonResponse
from django.shortcuts import render

from core.api import ApiError, api_view
from core.ratelimit import allow, client_ip

from . import services
from .forms import CleanOptionsForm

REQUESTS_PER_MINUTE = 20


def index(request):
    return render(request, "csv_detective/index.html", {
        "max_mb": services.MAX_FILE_BYTES // (1024 * 1024),
        "max_rows": f"{services.MAX_ROWS:,}",
    })


def _upload_from(request):
    """No account needed, so uploads are throttled, and nothing is written to disk by us."""
    if not allow(f"csv:{client_ip(request)}", REQUESTS_PER_MINUTE, 60):
        raise ApiError("Too many uploads. Wait a minute and try again.", status=429)
    uploaded = request.FILES.get("file")
    if uploaded is None:
        raise ApiError("Choose a CSV file first.")
    return uploaded


@api_view("POST")
def analyze(request):
    try:
        return JsonResponse(services.profile(_upload_from(request)))
    except services.CsvError as error:
        raise ApiError(str(error))


@api_view("POST")
def clean(request):
    uploaded = _upload_from(request)
    form = CleanOptionsForm(request.POST)
    form.is_valid()  # Every field is an optional checkbox, so this can't fail.
    try:
        text, before, after = services.clean(uploaded, **form.cleaned_data)
    except services.CsvError as error:
        raise ApiError(str(error))
    response = HttpResponse(text, content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="{services.cleaned_filename(uploaded.name)}"'
    response["X-Rows-Before"] = before
    response["X-Rows-After"] = after
    return response
