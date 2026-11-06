from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from .models import Favourite, RecentApp
from .ratelimit import allow
from .registry import APPS, CATEGORIES, apps_in_category

User = get_user_model()


class RegistryTests(TestCase):
    def test_eleven_apps_in_four_categories_each_with_a_route(self):
        self.assertEqual(len(APPS), 11)
        self.assertEqual(sum(len(apps_in_category(c)) for c in CATEGORIES), 11)
        for app in APPS:
            self.assertEqual(self.client.get(reverse(f"{app.slug}:index")).status_code, 200, app.slug)


class HomeTests(TestCase):
    def test_home_lists_every_app(self):
        response = self.client.get(reverse("core:home"))
        self.assertContains(response, "Small tools. Big distractions.")
        for app in APPS:
            self.assertContains(response, app.name)

    def test_custom_404(self):
        response = self.client.get("/definitely/not/here/")
        self.assertEqual(response.status_code, 404)
        self.assertContains(response, "This quest doesn", status_code=404)

    def test_csp_header_present(self):
        self.assertIn("script-src 'self'", self.client.get(reverse("core:home")).headers["Content-Security-Policy"])


class RecentAndFavouriteTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("ada", password="pw-for-tests-1")

    def test_guest_recents_live_in_session(self):
        self.client.get(reverse("snake:index"))
        self.client.get(reverse("typerush:index"))
        self.assertEqual([a.slug for a in self.client.get(reverse("core:home")).context["recent"]], ["typerush", "snake"])
        self.assertEqual(RecentApp.objects.count(), 0)

    def test_user_recents_persist_without_duplicates(self):
        self.client.force_login(self.user)
        self.client.get(reverse("snake:index"))
        self.client.get(reverse("snake:index"))
        self.assertEqual(RecentApp.objects.filter(user=self.user).count(), 1)

    def test_favourite_toggle(self):
        url = reverse("core:favourite_toggle", args=["snake"])
        self.assertEqual(self.client.post(url).status_code, 401)
        self.client.force_login(self.user)
        self.assertTrue(self.client.post(url).json()["favourite"])
        self.assertEqual(Favourite.objects.get().user, self.user)
        self.assertFalse(self.client.post(url).json()["favourite"])
        self.assertEqual(Favourite.objects.count(), 0)

    def test_favourite_rejects_unknown_app_and_get(self):
        self.client.force_login(self.user)
        self.assertEqual(self.client.post(reverse("core:favourite_toggle", args=["nope"])).status_code, 404)
        self.assertEqual(self.client.get(reverse("core:favourite_toggle", args=["snake"])).status_code, 405)

    def test_dashboard_requires_login(self):
        self.assertEqual(self.client.get(reverse("core:dashboard")).status_code, 302)
        self.client.force_login(self.user)
        self.assertEqual(self.client.get(reverse("core:dashboard")).status_code, 200)


class RateLimitTests(TestCase):
    def test_blocks_after_limit(self):
        self.assertEqual([allow("t-key", 2, 60) for _ in range(3)], [True, True, False])
