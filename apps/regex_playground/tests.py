from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from .models import SavedPattern

User = get_user_model()


class PatternApiTests(TestCase):
    def setUp(self):
        self.ada = User.objects.create_user("ada", password="pw-for-tests-1")
        self.url = reverse("regex_playground:patterns")

    def post(self, **data):
        return self.client.post(self.url, {"name": "Digits", "pattern": r"\d+", "flags": "g", **data}, content_type="application/json")

    def test_guest_sees_page_but_cannot_save(self):
        self.assertEqual(self.client.get(reverse("regex_playground:index")).status_code, 200)
        self.assertEqual(self.post().status_code, 401)

    def test_create_and_list(self):
        self.client.force_login(self.ada)
        self.assertEqual(self.post().status_code, 201)
        self.assertEqual(self.client.get(self.url).json()["patterns"][0]["pattern"], r"\d+")

    def test_flags_validated(self):
        self.client.force_login(self.ada)
        for flags in ("x", "gg", "uv"):
            self.assertEqual(self.post(flags=flags).status_code, 400, flags)

    def test_cannot_delete_someone_elses_pattern(self):
        pattern = SavedPattern.objects.create(user=self.ada, name="a", pattern="a")
        self.client.force_login(User.objects.create_user("eve", password="pw-for-tests-1"))
        url = reverse("regex_playground:delete_pattern", args=[pattern.pk])
        self.assertEqual(self.client.delete(url).status_code, 404)
        self.assertTrue(SavedPattern.objects.filter(pk=pattern.pk).exists())
