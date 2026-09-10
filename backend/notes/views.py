from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Note
from .serializers import NoteSerializer


class NoteListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        notes = Note.objects.filter(owner=request.user)
        return Response(NoteSerializer(notes, many=True).data)

    def post(self, request):
        serializer = NoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        note = serializer.save(owner=request.user)
        return Response(NoteSerializer(note).data, status=status.HTTP_201_CREATED)


class NoteDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_owned_note(self, pk, user):
        """Look up a note by id AND ownership together, same as the Mongo
        version — a note that exists but belongs to someone else returns
        the exact same 404 as one that doesn't exist at all, so an
        attacker probing IDs can't tell the difference (see docs/security.md)."""
        return Note.objects.filter(pk=pk, owner=user).first()

    def get(self, request, pk):
        note = self._get_owned_note(pk, request.user)
        if note is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(NoteSerializer(note).data)

    def patch(self, request, pk):
        note = self._get_owned_note(pk, request.user)
        if note is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = NoteSerializer(note, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        note = self._get_owned_note(pk, request.user)
        if note is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        note.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
