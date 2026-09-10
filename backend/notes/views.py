from bson import ObjectId
from bson.errors import InvalidId
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from config.mongo import notes_collection
from .serializers import NoteSerializer


def _to_api_shape(doc):
    """Mongo document -> the dict shape NoteSerializer expects on the way out."""
    return {
        'id': str(doc['_id']),
        'title': doc['title'],
        'content': doc.get('content', ''),
        'created_at': doc['created_at'],
        'updated_at': doc['updated_at'],
    }


class NoteListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        docs = notes_collection().find({'owner_id': request.user.id}).sort('created_at', -1)
        data = [_to_api_shape(doc) for doc in docs]
        return Response(NoteSerializer(data, many=True).data)

    def post(self, request):
        serializer = NoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        now = timezone.now()
        doc = {
            'owner_id': request.user.id,
            'title': serializer.validated_data['title'],
            'content': serializer.validated_data.get('content', ''),
            'created_at': now,
            'updated_at': now,
        }
        result = notes_collection().insert_one(doc)
        doc['_id'] = result.inserted_id
        return Response(NoteSerializer(_to_api_shape(doc)).data, status=status.HTTP_201_CREATED)


class NoteDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_owned_note(self, pk, user):
        """Look up a note by id AND ownership together. A note that exists
        but belongs to someone else returns the exact same 404 as one that
        doesn't exist at all — that's deliberate (see docs/security.md):
        it avoids leaking "note 123 exists, you just can't see it" to an
        attacker probing IDs, which a 403 would."""
        try:
            object_id = ObjectId(pk)
        except InvalidId:
            return None
        return notes_collection().find_one({'_id': object_id, 'owner_id': user.id})

    def get(self, request, pk):
        doc = self._get_owned_note(pk, request.user)
        if doc is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(NoteSerializer(_to_api_shape(doc)).data)

    def patch(self, request, pk):
        doc = self._get_owned_note(pk, request.user)
        if doc is None:
            return Response(status=status.HTTP_404_NOT_FOUND)

        serializer = NoteSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updates = dict(serializer.validated_data)
        updates['updated_at'] = timezone.now()

        notes_collection().update_one({'_id': doc['_id']}, {'$set': updates})
        doc.update(updates)
        return Response(NoteSerializer(_to_api_shape(doc)).data)

    def delete(self, request, pk):
        doc = self._get_owned_note(pk, request.user)
        if doc is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        notes_collection().delete_one({'_id': doc['_id']})
        return Response(status=status.HTTP_204_NO_CONTENT)
