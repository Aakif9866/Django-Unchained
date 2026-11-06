from django.http import JsonResponse
from django.shortcuts import get_object_or_404, render

from core.api import ApiError, api_view, validated

from . import services
from .forms import PatternForm
from .models import SavedPattern


def index(request):
    return render(request, "regex_playground/index.html")


@api_view("GET", "POST", login=True)
def patterns(request):
    if request.method == "GET":
        return JsonResponse({"patterns": services.list_patterns(request.user)})
    if SavedPattern.objects.filter(user=request.user).count() >= services.MAX_SAVED_PATTERNS:
        raise ApiError("You've reached the saved pattern limit. Delete one first.")
    pattern = validated(PatternForm, request).save(commit=False)
    pattern.user = request.user
    pattern.save()
    return JsonResponse(services.serialize(pattern), status=201)


@api_view("DELETE", login=True)
def delete_pattern(request, pk):
    get_object_or_404(SavedPattern, pk=pk, user=request.user).delete()
    return JsonResponse({"deleted": True})
