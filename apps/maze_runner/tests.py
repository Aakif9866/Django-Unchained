from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from .models import MazeRun
from .services import leaderboard

User = get_user_model()
VALID = {"difficulty": "easy", "time_ms": 15000, "moves": 40}


class MazeRunTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("ada", password="pw-for-tests-1")
        self.url = reverse("maze_runner:save_run")

    def post(self, **overrides):
        return self.client.post(self.url, {**VALID, **overrides}, content_type="application/json")

    def test_guest_cannot_save(self):
        self.assertEqual(self.client.get(reverse("maze_runner:index")).status_code, 200)
        self.assertEqual(self.post().status_code, 401)

    def test_valid_run_saved(self):
        self.client.force_login(self.user)
        self.assertEqual(self.post().status_code, 201)
        self.assertEqual(MazeRun.objects.get().user, self.user)

    def test_impossible_runs_rejected(self):
        self.client.force_login(self.user)
        self.assertEqual(self.post(moves=3).status_code, 400)  # Shorter than corner to corner.
        self.assertEqual(self.post(time_ms=10).status_code, 400)
        self.assertEqual(self.post(difficulty="insane").status_code, 400)

    def test_leaderboard_is_fastest_per_user(self):
        other = User.objects.create_user("grace", password="pw-for-tests-1")
        for user, ms in [(self.user, 9000), (self.user, 5000), (other, 7000)]:
            MazeRun.objects.create(user=user, difficulty="easy", time_ms=ms, moves=30)
        self.assertEqual(leaderboard("easy"), [{"user": "ada", "time_ms": 5000}, {"user": "grace", "time_ms": 7000}])
