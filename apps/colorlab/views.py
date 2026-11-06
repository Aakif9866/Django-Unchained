from django.http import JsonResponse
from django.shortcuts import get_object_or_404, render

from core.api import ApiError, api_view, validated

from . import services
from .forms import PaletteForm
from .models import SavedPalette


def index(request):
    return render(request, "colorlab/index.html")


@api_view("GET", "POST", login=True)
def palettes(request):
    if request.method == "GET":
        return JsonResponse({"palettes": services.list_palettes(request.user)})
    if SavedPalette.objects.filter(user=request.user).count() >= services.MAX_SAVED:
        raise ApiError("You've reached the saved palette limit. Delete one first.")
    palette = SavedPalette.objects.create(user=request.user, **validated(PaletteForm, request).cleaned_data)
    return JsonResponse(services.serialize(palette), status=201)


@api_view("DELETE", login=True)
def delete_palette(request, pk):
    get_object_or_404(SavedPalette, pk=pk, user=request.user).delete()
    return JsonResponse({"deleted": True})
