from django.http import JsonResponse
from django.shortcuts import get_object_or_404, render

from core.api import ApiError, api_view, json_body

from . import services
from .forms import TitleForm
from .models import Title

MAX_TITLES = 1000


def index(request):
    return render(request, "watch_roulette/index.html")


def _validated_form(data, user, instance=None):
    form = TitleForm(data, user=user, instance=instance)
    if not form.is_valid():
        fields = {name: [str(e) for e in errors] for name, errors in form.errors.items()}
        raise ApiError(next(iter(fields.values()))[0], fields=fields)
    return form


@api_view("GET", "POST", login=True)
def titles(request):
    if request.method == "GET":
        return JsonResponse({"titles": services.list_titles(request.user)})
    if Title.objects.filter(user=request.user).count() >= MAX_TITLES:
        raise ApiError("Your list is full. Remove something first.")
    title = services.save_title(_validated_form(json_body(request), request.user))
    return JsonResponse(services.serialize(title), status=201)


@api_view("PATCH", "DELETE", login=True)
def title_detail(request, pk):
    title = get_object_or_404(Title, pk=pk, user=request.user)
    if request.method == "DELETE":
        title.delete()
        return JsonResponse({"deleted": True})
    merged = {**services.serialize(title), **json_body(request)}  # PATCH: untouched fields keep their values.
    return JsonResponse(services.serialize(services.save_title(_validated_form(merged, request.user, title))))
