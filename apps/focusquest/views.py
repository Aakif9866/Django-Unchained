from django.http import JsonResponse
from django.shortcuts import render

from core.api import ApiError, api_view, validated

from . import services
from .forms import StartForm


def index(request):
    return render(request, "focusquest/index.html", {"max_minutes": services.MAX_CUSTOM_MINUTES, "xp_per_minute": services.XP_PER_MINUTE})


@api_view("GET", login=True)
def state(request):
    return JsonResponse(services.state(request.user))


@api_view("POST", login=True)
def start(request):
    data = validated(StartForm, request).cleaned_data
    session = services.start_session(request.user, data["mode"], data.get("minutes"))
    return JsonResponse({"id": session.id, "planned_minutes": session.planned_minutes}, status=201)


@api_view("POST", login=True)
def complete(request, pk):
    try:
        session, unlocked = services.complete_session(request.user, pk)
    except services.SessionError as error:
        raise ApiError(str(error), status=409)
    return JsonResponse({
        "xp_awarded": session.xp_awarded,
        "unlocked": services.achievement_names(unlocked),
        "state": services.state(request.user),
    })


@api_view("POST", login=True)
def abandon(request):
    services.abandon_session(request.user)
    return JsonResponse(services.state(request.user))
