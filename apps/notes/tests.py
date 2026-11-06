from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from .models import Note

User = get_user_model()


class NoteApiTests(TestCase):
    def setUp(self):
        self.ada = User.objects.create_user("ada", password="pw-for-tests-1")
        self.client.force_login(self.ada)
        self.url = reverse("notes:items")

    def create(self, **data):
        return self.client.post(self.url, data, content_type="application/json")

    def patch(self, pk, **data):
        return self.client.patch(reverse("notes:item", args=[pk]), data, content_type="application/json")

    def test_blank_note_allowed_for_new_note_flow(self):
        self.assertEqual(self.create().status_code, 201)

    def test_patch_is_partial_and_keeps_whitespace(self):
        pk = self.create(title="A", body="B").json()["id"]
        updated = self.patch(pk, body="hello ").json()
        self.assertEqual((updated["title"], updated["body"]), ("A", "hello "))

    def test_pinned_sort_first(self):
        first = self.create(title="old").json()["id"]
        self.create(title="new")
        self.patch(first, pinned=True)
        self.assertEqual(self.client.get(self.url).json()["notes"][0]["title"], "old")

    def test_length_limits(self):
        self.assertEqual(self.create(title="x" * 201).status_code, 400)
        self.assertEqual(self.create(body="x" * 100_001).status_code, 400)

    def test_notes_are_private(self):
        pk = self.create(title="secret").json()["id"]
        self.client.force_login(User.objects.create_user("eve", password="pw-for-tests-1"))
        self.assertEqual(self.client.get(self.url).json()["notes"], [])
        self.assertEqual(self.patch(pk, title="hacked").status_code, 404)
        self.assertEqual(self.client.delete(reverse("notes:item", args=[pk])).status_code, 404)
        self.assertEqual(Note.objects.get(pk=pk).title, "secret")

    def test_guest(self):
        self.client.logout()
        self.assertContains(self.client.get(reverse("notes:index")), "Sign in")
        self.assertEqual(self.client.get(self.url).status_code, 401)
        self.assertEqual(self.create(title="x").status_code, 401)

    def test_markup_is_stored_as_plain_text(self):
        body = "<script>alert(1)</script>"
        self.assertEqual(self.create(body=body).json()["body"], body)  # Escaped at render by textContent/value.
