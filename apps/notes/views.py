from django.http import JsonResponse
from django.shortcuts import get_object_or_404, render

from core.api import ApiError, api_view, json_body

from . import services
from .forms import NoteForm
from .models import Note


def index(request):
    return render(request, "notes/index.html")


def _save(data, user, instance=None):
    form = NoteForm(data, instance=instance)
    if not form.is_valid():
        fields = {name: [str(e) for e in errors] for name, errors in form.errors.items()}
        raise ApiError(next(iter(fields.values()))[0], fields=fields)
    note = form.save(commit=False)
    note.user = user
    note.save()
    return note


@api_view("GET", "POST", login=True)
def notes(request):
    if request.method == "GET":
        return JsonResponse({"notes": services.list_notes(request.user)})
    if Note.objects.filter(user=request.user).count() >= services.MAX_NOTES:
        raise ApiError("You've reached the note limit. Delete one first.")
    return JsonResponse(services.serialize(_save(json_body(request), request.user)), status=201)


@api_view("PATCH", "DELETE", login=True)
def note_detail(request, pk):
    note = get_object_or_404(Note, pk=pk, user=request.user)
    if request.method == "DELETE":
        note.delete()
        return JsonResponse({"deleted": True})
    merged = {"title": note.title, "body": note.body, "pinned": note.pinned, **json_body(request)}
    return JsonResponse(services.serialize(_save(merged, request.user, note)))
