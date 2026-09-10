"""
A single shared pymongo connection for the whole project.

Django's own ORM (SQLite here — see docs/decisions.md) still owns the
User/Session/admin tables. Application data (notes) lives in MongoDB,
reached directly through pymongo rather than Django's ORM, which doesn't
speak MongoDB. This module is the one place that knows how to get a
MongoDB database handle so every view imports from here instead of each
opening its own connection.
"""

from django.conf import settings
from pymongo import MongoClient

_client = None


def get_db():
    """Return the notes-app MongoDB database, opening the connection once
    and reusing it for the life of the process."""
    global _client
    if _client is None:
        _client = MongoClient(settings.MONGODB_URI)
    return _client[settings.MONGODB_DB_NAME]


def notes_collection():
    return get_db()['notes']
