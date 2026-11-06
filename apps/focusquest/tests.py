from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase
from django.urls import reverse
from django.utils import timezone

from . import services
from .models import FocusSession, UserAchievement

User = get_user_model()
Status = FocusSession.Status


class LevelTests(SimpleTestCase):
    def test_level_thresholds(self):
        for xp, level in [(0, 1), (99, 1), (100, 2), (299, 2), (300, 3), (600, 4), (1000, 5)]:
            self.assertEqual(services.level_for_xp(xp), level, xp)


class SessionFlowTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("ada", password="pw-for-tests-1")
        self.client.force_login(self.user)

    def start(self, **data):
        return self.client.post(reverse("focusquest:start"), {"mode": "pomodoro", **data}, content_type="application/json")

    def complete(self, pk):
        return self.client.post(reverse("focusquest:complete", args=[pk]), {"xp_awarded": 99999}, content_type="application/json")

    def age(self, pk, **delta):
        FocusSession.objects.filter(pk=pk).update(started_at=timezone.now() - timedelta(**delta))

    def test_cannot_complete_before_time_has_passed(self):
        pk = self.start().json()["id"]
        self.assertEqual(self.complete(pk).status_code, 409)
        self.age(pk, minutes=24)
        self.assertEqual(self.complete(pk).status_code, 409)
        self.assertEqual(FocusSession.objects.get(pk=pk).xp_awarded, 0)

    def test_xp_comes_from_the_server_not_the_client(self):
        pk = self.start().json()["id"]
        self.age(pk, minutes=25)
        response = self.complete(pk)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["xp_awarded"], 50)
        self.assertEqual(response.json()["state"]["xp"], 50)

    def test_client_cannot_choose_preset_length(self):
        self.assertEqual(self.start(minutes=1).json()["planned_minutes"], 25)

    def test_completion_cannot_be_replayed(self):
        pk = self.start().json()["id"]
        self.age(pk, minutes=25)
        self.assertEqual(self.complete(pk).status_code, 200)
        self.assertEqual(self.complete(pk).status_code, 409)
        self.assertEqual(services.state(self.user)["xp"], 50)

    def test_starting_abandons_previous_so_sessions_cannot_stack(self):
        first = self.start().json()["id"]
        self.age(first, minutes=25)
        self.start()
        self.assertEqual(self.complete(first).status_code, 409)
        self.assertEqual(FocusSession.objects.filter(user=self.user, status=Status.ACTIVE).count(), 1)

    def test_session_left_running_does_not_pay(self):
        pk = self.start().json()["id"]
        self.age(pk, hours=5)
        self.assertEqual(self.complete(pk).status_code, 409)
        self.assertEqual(FocusSession.objects.get(pk=pk).status, Status.ABANDONED)

    def test_pausing_is_allowed_because_elapsed_only_grows(self):
        pk = self.start().json()["id"]
        self.age(pk, minutes=40)
        self.assertEqual(self.complete(pk).json()["xp_awarded"], 50)

    def test_custom_validation(self):
        self.assertEqual(self.start(mode="custom").status_code, 400)
        self.assertEqual(self.start(mode="custom", minutes=0).status_code, 400)
        self.assertEqual(self.start(mode="custom", minutes=999).status_code, 400)
        self.assertEqual(self.start(mode="custom", minutes=10).json()["planned_minutes"], 10)
        self.assertEqual(self.start(mode="nope").status_code, 400)

    def test_cannot_complete_another_users_session(self):
        pk = self.start().json()["id"]
        self.age(pk, minutes=25)
        self.client.force_login(User.objects.create_user("eve", password="pw-for-tests-1"))
        self.assertEqual(self.complete(pk).status_code, 409)
        self.assertEqual(FocusSession.objects.get(pk=pk).status, Status.ACTIVE)

    def test_first_session_unlocks_achievement_once(self):
        pk = self.start().json()["id"]
        self.age(pk, minutes=25)
        self.assertIn("First Step", self.complete(pk).json()["unlocked"])
        pk = self.start().json()["id"]
        self.age(pk, minutes=25)
        self.assertNotIn("First Step", self.complete(pk).json()["unlocked"])
        self.assertEqual(UserAchievement.objects.filter(key="first_step").count(), 1)

    def test_abandon(self):
        pk = self.start().json()["id"]
        self.client.post(reverse("focusquest:abandon"))
        self.assertEqual(FocusSession.objects.get(pk=pk).status, Status.ABANDONED)

    def test_guest_blocked_from_all_endpoints(self):
        self.client.logout()
        self.assertEqual(self.client.get(reverse("focusquest:index")).status_code, 200)
        self.assertEqual(self.start().status_code, 401)
        self.assertEqual(self.client.get(reverse("focusquest:state")).status_code, 401)


class StreakTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("ada", password="pw-for-tests-1")

    def done_on(self, *days_ago):
        now = timezone.now()
        for ago in days_ago:
            moment = now - timedelta(days=ago)
            FocusSession.objects.create(user=self.user, mode="pomodoro", planned_minutes=25, started_at=moment,
                                        completed_at=moment, status=Status.COMPLETED, xp_awarded=50)

    def test_no_sessions(self):
        self.assertEqual(services.streaks(self.user), (0, 0))

    def test_streak_counts_consecutive_days_and_multiple_a_day_once(self):
        self.done_on(0, 0, 1, 2)
        self.assertEqual(services.streaks(self.user), (3, 3))

    def test_streak_survives_until_a_full_day_is_missed(self):
        self.done_on(1, 2)
        self.assertEqual(services.streaks(self.user)[0], 2)

    def test_gap_breaks_current_but_longest_remembers(self):
        self.done_on(0, 5, 6, 7, 8)
        self.assertEqual(services.streaks(self.user), (1, 4))

    def test_weekly_minutes_cover_last_seven_days(self):
        self.done_on(0, 1, 6, 7)
        week = services.state(self.user)["week"]
        self.assertEqual(len(week), 7)
        self.assertEqual(sum(day["minutes"] for day in week), 75)
        self.assertEqual(date.fromisoformat(week[-1]["date"]), timezone.localdate())
