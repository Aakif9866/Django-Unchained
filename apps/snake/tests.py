from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from .models import SnakeScore
from .services import leaderboard

User = get_user_model()
VALID = {"difficulty": "normal", "score": 40, "items_collected": 2, "duration_seconds": 12.5}


class SnakeTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("ada", password="pw-for-tests-1")
        self.url = reverse("snake:save_score")

    def post(self, **overrides):
        return self.client.post(self.url, {**VALID, **overrides}, content_type="application/json")

    def test_guest_can_play_but_not_save(self):
        self.assertEqual(self.client.get(reverse("snake:index")).status_code, 200)
        self.assertEqual(self.post().status_code, 401)
        self.assertEqual(SnakeScore.objects.count(), 0)

    def test_score_saved_against_session_user(self):
        self.client.force_login(self.user)
        response = self.post(user=999)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(SnakeScore.objects.get().user, self.user)
        self.assertTrue(response.json()["is_new_best"])

    def test_impossible_scores_rejected(self):
        self.client.force_login(self.user)
        self.assertEqual(self.post(score=999_999).status_code, 400)
        self.assertEqual(self.post(items_collected=100, score=100, duration_seconds=1).status_code, 400)
        self.assertEqual(self.post(difficulty="nightmare").status_code, 400)
        self.assertEqual(self.post(score=-1).status_code, 400)
        self.assertEqual(SnakeScore.objects.count(), 0)

    def test_leaderboard_keeps_best_per_user_per_difficulty(self):
        other = User.objects.create_user("grace", password="pw-for-tests-1")
        for user, score, level in [(self.user, 10, "normal"), (self.user, 30, "normal"), (other, 20, "normal"), (other, 90, "hard")]:
            SnakeScore.objects.create(user=user, score=score, difficulty=level, items_collected=9, duration_seconds=9)
        self.assertEqual(leaderboard("normal"), [{"user": "ada", "score": 30}, {"user": "grace", "score": 20}])
