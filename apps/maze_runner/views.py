from django.http import JsonResponse
from django.shortcuts import render

from core.api import ApiError, api_view, validated

from . import services
from .forms import RunForm
from .models import MazeRun


def index(request):
    return render(request, "maze_runner/index.html", {"difficulties": MazeRun.Difficulty.choices})


def _payload(user, difficulty):
    return {"leaderboard": services.leaderboard(difficulty), "history": services.history(user)}


@api_view("GET")
def board(request):
    difficulty = request.GET.get("difficulty", MazeRun.Difficulty.EASY)
    if difficulty not in MazeRun.Difficulty.values:
        raise ApiError("Unknown difficulty.")
    return JsonResponse(_payload(request.user, difficulty))


@api_view("POST", login=True)
def save_run(request):
    data = validated(RunForm, request).cleaned_data
    MazeRun.objects.create(user=request.user, **data)
    return JsonResponse(_payload(request.user, data["difficulty"]), status=201)
