from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Note


class NoteCrudTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='alice', password='correct-horse-9')
        self.client.login(username='alice', password='correct-horse-9')

    def test_create_note(self):
        res = self.client.post('/api/notes/', {'title': 'Hello', 'content': 'World'})
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Note.objects.count(), 1)
        self.assertEqual(Note.objects.first().owner, self.user)

    def test_list_notes_returns_only_current_users_notes(self):
        Note.objects.create(owner=self.user, title='Mine')
        other = User.objects.create_user(username='bob', password='another-pass-9')
        Note.objects.create(owner=other, title='Not mine')

        res = self.client.get('/api/notes/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['title'], 'Mine')

    def test_read_single_note(self):
        note = Note.objects.create(owner=self.user, title='Read me')
        res = self.client.get(f'/api/notes/{note.id}/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['title'], 'Read me')

    def test_update_note(self):
        note = Note.objects.create(owner=self.user, title='Old title')
        res = self.client.patch(f'/api/notes/{note.id}/', {'title': 'New title'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        note.refresh_from_db()
        self.assertEqual(note.title, 'New title')

    def test_delete_note(self):
        note = Note.objects.create(owner=self.user, title='Delete me')
        res = self.client.delete(f'/api/notes/{note.id}/')
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Note.objects.filter(id=note.id).exists())

    def test_notes_endpoints_require_authentication(self):
        self.client.logout()
        res = self.client.get('/api/notes/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)


class NoteAuthorizationTests(APITestCase):
    """The core security property: a user can never reach another user's
    note, by id, through any verb — and the 'note exists but isn't yours'
    case is indistinguishable from 'note doesn't exist' (404 both ways)."""

    def setUp(self):
        self.alice = User.objects.create_user(username='alice', password='correct-horse-9')
        self.bob = User.objects.create_user(username='bob', password='another-pass-9')
        self.alices_note = Note.objects.create(owner=self.alice, title="Alice's secret")

    def test_other_user_cannot_read_note(self):
        self.client.login(username='bob', password='another-pass-9')
        res = self.client.get(f'/api/notes/{self.alices_note.id}/')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_other_user_cannot_update_note(self):
        self.client.login(username='bob', password='another-pass-9')
        res = self.client.patch(
            f'/api/notes/{self.alices_note.id}/', {'title': 'Hacked'}, format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
        self.alices_note.refresh_from_db()
        self.assertEqual(self.alices_note.title, "Alice's secret")  # unchanged

    def test_other_user_cannot_delete_note(self):
        self.client.login(username='bob', password='another-pass-9')
        res = self.client.delete(f'/api/notes/{self.alices_note.id}/')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(Note.objects.filter(id=self.alices_note.id).exists())  # not deleted

    def test_other_users_note_is_absent_from_list(self):
        self.client.login(username='bob', password='another-pass-9')
        res = self.client.get('/api/notes/')
        self.assertEqual(res.data, [])

    def test_nonexistent_and_someone_elses_note_return_identical_404(self):
        """The specific IDOR-adjacent property: an attacker probing IDs
        can't distinguish 'not yours' from 'doesn't exist' by response
        shape — both must look the same."""
        self.client.login(username='bob', password='another-pass-9')
        real_but_not_mine = self.client.get(f'/api/notes/{self.alices_note.id}/')
        made_up_id = self.alices_note.id + 999999
        does_not_exist = self.client.get(f'/api/notes/{made_up_id}/')
        self.assertEqual(real_but_not_mine.status_code, does_not_exist.status_code)
        self.assertEqual(real_but_not_mine.data, does_not_exist.data)
