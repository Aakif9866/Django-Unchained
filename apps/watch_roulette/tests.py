from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from .models import Title

User = get_user_model()
VALID = {"name": "Spirited Away", "kind": "movie", "genre": "Animation", "language": "Japanese"}


class TitleApiTests(TestCase):
    def setUp(self):
        self.ada = User.objects.create_user("ada", password="pw-for-tests-1")
        self.client.force_login(self.ada)
        self.url = reverse("watch_roulette:titles")

    def create(self, **overrides):
        return self.client.post(self.url, {**VALID, **overrides}, content_type="application/json")

    def patch(self, pk, **data):
        return self.client.patch(reverse("watch_roulette:title_detail", args=[pk]), data, content_type="application/json")

    def test_create_and_list(self):
        self.assertEqual(self.create(rating=9).status_code, 201)
        self.assertEqual(self.client.get(self.url).json()["titles"][0]["rating"], 9)

    def test_validation(self):
        self.assertEqual(self.create(name="").status_code, 400)
        self.assertEqual(self.create(rating=11).status_code, 400)
        self.assertEqual(self.create(rating=0).status_code, 400)
        self.assertEqual(self.create(kind="podcast").status_code, 400)
        self.assertEqual(self.create(genre="").status_code, 400)

    def test_duplicates_rejected_case_insensitively_per_user(self):
        self.create()
        self.assertEqual(self.create(name="spirited away").status_code, 400)
        self.assertEqual(self.create(kind="series").status_code, 201)
        self.client.force_login(User.objects.create_user("bo", password="pw-for-tests-1"))
        self.assertEqual(self.create().status_code, 201)

    def test_watched_timestamp_follows_flag_and_patch_keeps_other_fields(self):
        pk = self.create(rating=7).json()["id"]
        watched = self.patch(pk, watched=True).json()
        self.assertIsNotNone(watched["watched_at"])
        self.assertEqual((watched["rating"], watched["name"]), (7, VALID["name"]))
        self.assertIsNone(self.patch(pk, watched=False).json()["watched_at"])

    def test_clearing_rating(self):
        pk = self.create(rating=7).json()["id"]
        self.assertIsNone(self.patch(pk, rating=None).json()["rating"])

    def test_other_users_titles_are_invisible(self):
        pk = self.create().json()["id"]
        self.client.force_login(User.objects.create_user("eve", password="pw-for-tests-1"))
        self.assertEqual(self.client.get(self.url).json()["titles"], [])
        self.assertEqual(self.patch(pk, watched=True).status_code, 404)
        self.assertEqual(self.client.delete(reverse("watch_roulette:title_detail", args=[pk])).status_code, 404)
        self.assertTrue(Title.objects.filter(pk=pk, watched=False).exists())

    def test_guest_gets_page_but_no_api(self):
        self.client.logout()
        self.assertEqual(self.client.get(reverse("watch_roulette:index")).status_code, 200)
        self.assertEqual(self.client.get(self.url).status_code, 401)
