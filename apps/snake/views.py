from django.http import JsonResponse
from django.shortcuts import render

from core.api import ApiError, api_view, validated

from . import services
from .forms import ScoreForm
from .models import SnakeScore


def index(request):
    return render(request, "snake/index.html", {"difficulties": SnakeScore.Difficulty.choices})


def _board_payload(user, difficulty):
    return {
        "leaderboard": services.leaderboard(difficulty),
        "personal_best": services.personal_best(user, difficulty),
    }


@api_view("GET")
def board(request):
    difficulty = request.GET.get("difficulty", SnakeScore.Difficulty.NORMAL)
    if difficulty not in SnakeScore.Difficulty.values:
        raise ApiError("Unknown difficulty.")
    return JsonResponse(_board_payload(request.user, difficulty))


@api_view("POST", login=True)
def save_score(request):
    data = validated(ScoreForm, request).cleaned_data
    previous_best = services.personal_best(request.user, data["difficulty"])
    SnakeScore.objects.create(user=request.user, **data)
    is_new_best = previous_best is None or data["score"] > previous_best
    return JsonResponse({"is_new_best": is_new_best, **_board_payload(request.user, data["difficulty"])}, status=201)
