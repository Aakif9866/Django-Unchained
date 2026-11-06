from django.http import JsonResponse
from django.shortcuts import render

from core.api import ApiError, api_view, validated

from . import services
from .forms import ResultForm
from .models import TypingResult


def index(request):
    return render(request, "typerush/index.html", {"durations": services.DURATIONS})


def _seconds_param(request):
    try:
        seconds = int(request.GET.get("seconds", 60))
    except ValueError:
        raise ApiError("Unknown duration.")
    if seconds not in services.DURATIONS:
        raise ApiError("Unknown duration.")
    return seconds


@api_view("GET")
def passage(request):
    mode = request.GET.get("mode", "prose")
    if mode not in TypingResult.Mode.values:
        raise ApiError("Unknown mode.")
    return JsonResponse({"text": services.build_passage(mode, _seconds_param(request))})


def _stats_payload(user, seconds):
    return {"leaderboard": services.leaderboard(seconds), "history": services.history(user)}


@api_view("GET")
def stats(request):
    return JsonResponse(_stats_payload(request.user, _seconds_param(request)))


@api_view("POST", login=True)
def save_result(request):
    data = validated(ResultForm, request).cleaned_data
    result = TypingResult.objects.create(user=request.user, **data)
    return JsonResponse({"wpm": result.wpm, "accuracy": result.accuracy, **_stats_payload(request.user, result.seconds)}, status=201)
