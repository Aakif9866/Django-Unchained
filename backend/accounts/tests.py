from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase


class RegistrationTests(APITestCase):
    def test_register_creates_user_with_hashed_password(self):
        res = self.client.post('/api/auth/register/', {
            'username': 'newuser', 'password': 'a-strong-password-9',
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(username='newuser')
        # The whole point of hashing: the raw password is never stored.
        self.assertNotEqual(user.password, 'a-strong-password-9')
        self.assertTrue(user.check_password('a-strong-password-9'))

    def test_register_rejects_duplicate_username(self):
        User.objects.create_user(username='taken', password='whatever-9-pass')
        res = self.client.post('/api/auth/register/', {
            'username': 'taken', 'password': 'a-strong-password-9',
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_enforces_password_validators(self):
        res = self.client.post('/api/auth/register/', {
            'username': 'weakpwuser', 'password': '123',
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(username='weakpwuser').exists())


class LoginLogoutTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='alice', password='correct-horse-9')

    def test_login_with_correct_credentials_succeeds(self):
        res = self.client.post('/api/auth/login/', {
            'username': 'alice', 'password': 'correct-horse-9',
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['username'], 'alice')

    def test_login_with_wrong_password_fails(self):
        res = self.client.post('/api/auth/login/', {
            'username': 'alice', 'password': 'wrong-password',
        })
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_requires_authentication(self):
        res = self.client.get('/api/auth/me/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_me_returns_current_user_when_logged_in(self):
        self.client.login(username='alice', password='correct-horse-9')
        res = self.client.get('/api/auth/me/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['username'], 'alice')

    def test_logout_ends_the_session(self):
        self.client.login(username='alice', password='correct-horse-9')
        self.client.post('/api/auth/logout/')
        res = self.client.get('/api/auth/me/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
