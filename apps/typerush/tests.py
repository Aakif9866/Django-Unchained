from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase
from django.urls import reverse

from .models import TypingResult
from .services import build_passage, calculate_accuracy, calculate_wpm

VALID = {"mode": "prose", "seconds": 60, "correct_chars": 300, "keystrokes": 320, "errors": 10}


class CalculationTests(SimpleTestCase):
    def test_wpm_uses_five_chars_per_word_and_scales_with_time(self):
        self.assertEqual(calculate_wpm(300, 60), 60.0)
        self.assertEqual(calculate_wpm(300, 30), 120.0)
        self.assertEqual(calculate_wpm(300, 120), 30.0)

    def test_accuracy(self):
        self.assertEqual(calculate_accuracy(100, 5), 95.0)
        self.assertEqual(calculate_accuracy(0, 0), 0.0)

    def test_passage_outlasts_timer(self):
        for mode in ("prose", "code"):
            self.assertGreaterEqual(len(build_passage(mode, 120)), 120 * 30)


class ResultApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user("ada", password="pw-for-tests-1")
        self.url = reverse("typerush:save_result")

    def post(self, **overrides):
        return self.client.post(self.url, {**VALID, **overrides}, content_type="application/json")

    def test_server_computes_wpm_and_ignores_client_values(self):
        self.client.force_login(self.user)
        response = self.post(wpm=999, accuracy=100)
        self.assertEqual(response.status_code, 201)
        result = TypingResult.objects.get()
        self.assertEqual(result.wpm, 60.0)
        self.assertEqual(result.accuracy, 96.9)

    def test_rejects_impossible_counts(self):
        self.client.force_login(self.user)
        self.assertEqual(self.post(correct_chars=400).status_code, 400)  # More than keystrokes.
        self.assertEqual(self.post(errors=400).status_code, 400)
        self.assertEqual(self.post(seconds=45).status_code, 400)
        self.assertEqual(self.post(correct_chars=9000, keystrokes=9000, errors=0).status_code, 400)  # 1800 WPM.
        self.assertEqual(TypingResult.objects.count(), 0)

    def test_guest_cannot_save(self):
        self.assertEqual(self.post().status_code, 401)

    def test_bad_query_params_are_400(self):
        self.assertEqual(self.client.get(reverse("typerush:passage"), {"mode": "nope"}).status_code, 400)
        self.assertEqual(self.client.get(reverse("typerush:stats"), {"seconds": "abc"}).status_code, 400)
