from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from django.urls import reverse

User = get_user_model()
GOOD_PASSWORD = "correct-horse-battery"


class AccountTests(TestCase):
    def setUp(self):
        cache.clear()

    def register(self, **extra):
        data = {"username": "ada", "email": "a@example.com", "password1": GOOD_PASSWORD, "password2": GOOD_PASSWORD, **extra}
        return self.client.post(reverse("accounts:register"), data)

    def test_register_hashes_password_and_logs_in(self):
        self.assertRedirects(self.register(), reverse("core:dashboard"))
        user = User.objects.get(username="ada")
        self.assertNotIn(GOOD_PASSWORD, user.password)
        self.assertTrue(user.check_password(GOOD_PASSWORD))
        self.assertEqual(self.client.session["_auth_user_id"], str(user.pk))

    def test_register_rejects_weak_password(self):
        self.assertEqual(self.register(password1="123", password2="123").status_code, 200)
        self.assertFalse(User.objects.exists())

    def test_register_ignores_offsite_next(self):
        self.assertRedirects(self.register(next="https://evil.example/"), reverse("core:dashboard"))

    def test_login_logout(self):
        User.objects.create_user("ada", password=GOOD_PASSWORD)
        response = self.client.post(reverse("accounts:login"), {"username": "ada", "password": GOOD_PASSWORD})
        self.assertEqual(response.status_code, 302)
        self.assertEqual(self.client.get(reverse("accounts:logout")).status_code, 405)  # GET must not log out.
        self.client.post(reverse("accounts:logout"))
        self.assertNotIn("_auth_user_id", self.client.session)

    def test_login_is_throttled(self):
        for _ in range(10):
            self.client.post(reverse("accounts:login"), {"username": "x", "password": "y"})
        self.assertEqual(self.client.post(reverse("accounts:login"), {"username": "x", "password": "y"}).status_code, 429)

    def test_profile_update_cannot_touch_privileges(self):
        user = User.objects.create_user("ada", password=GOOD_PASSWORD)
        self.client.force_login(user)
        self.client.post(reverse("accounts:profile"), {"display_name": "Ada L", "email": "", "bio": "", "is_staff": "on"})
        user.refresh_from_db()
        self.assertEqual(user.shown_name, "Ada L")
        self.assertFalse(user.is_staff)
