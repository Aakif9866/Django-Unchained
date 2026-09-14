from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.db.models import Q
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils.decorators import method_decorator
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import RegisterSerializer, UserSerializer

# Every load-test/security-probe/reliability-probe script in testing/
# registers real User rows against this same database — there's no
# separate test database for any of that (only manage.py test gets a
# throwaway one). Discovered when the "N people have joined" badge
# showed 617, and 613 of them turned out to be loadtest_*/k6_*/probe_*
# accounts from this project's own testing, not real signups. Any new
# test script MUST prefix its generated usernames with something added
# here, or it'll silently inflate this count again.
TEST_USERNAME_PREFIXES = [
    'loadtest_',        # testing/locustfile.py
    'k6_',               # testing/k6_script.js
    'probe_',            # testing/security_probe.py (register_and_login helper)
    'race_condition_target',  # testing/reliability_probe.py (REL-03) — no
                               # trailing underscore: also catches the bare
                               # "race_condition_target" username from
                               # before the script was fixed to suffix it
    'reliability_probe_user',  # testing/reliability_probe.py (REL-02)
    'cookie_probe_',     # ad-hoc manual testing (SEC-06 cookie-flag check)
    'csrf_probe_user',   # ad-hoc manual testing (early CSRF check)
    'sec_recheck_user',  # ad-hoc manual testing
    'docker_test_user',  # manual Docker Compose smoke test
]


@method_decorator(ensure_csrf_cookie, name='dispatch')
class CsrfView(APIView):
    """GET this once on app load — and again after login (see LoginView).

    Originally just set the csrftoken cookie for the frontend to read via
    document.cookie. That reading is what actually broke in production:
    frontend and backend are genuinely different domains on Railway (not
    same-origin like Docker, not same-site like localhost:5173/:8000), and
    a cookie set by one domain is invisible to JS running on the other —
    browser cookie-visibility rules, unrelated to SameSite/CORS (which
    were already correct; the cookie was still being *sent* on requests
    fine, just never *readable* by the frontend's own JS). Fixed by
    handing the token to the frontend directly in the response body,
    the standard pattern for exactly this cross-domain case — see
    frontend/src/api/client.js."""
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({'detail': 'CSRF cookie set', 'csrfToken': get_token(request)})


class UserCountView(APIView):
    """Public, deliberately minimal: a raw count only, no usernames, no
    IDs, no timestamps. Shown on the login/register screens ('N people
    have joined') before anyone's authenticated — a plain aggregate
    count isn't the kind of thing that needs protecting the way the
    Phase 2 dashboard's findings do.

    Excludes known test-script usernames (see TEST_USERNAME_PREFIXES)
    so this stays a meaningful number instead of counting our own load
    tests. Filters, doesn't delete — the rows themselves aren't touched,
    this view just doesn't count them."""

    permission_classes = [AllowAny]

    def get(self, request):
        exclusion = Q()
        for prefix in TEST_USERNAME_PREFIXES:
            exclusion |= Q(username__startswith=prefix)
        count = User.objects.exclude(exclusion).count()
        return Response({'user_count': count})


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        user = authenticate(request, username=username, password=password)
        if user is None:
            return Response(
                {'detail': 'Invalid username or password.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        login(request, user)  # creates the session + sets the sessionid cookie
        # django.contrib.auth.login() also rotates the CSRF token (calls
        # rotate_token() internally, a defense against session-fixation-
        # adjacent CSRF attacks) — the frontend's in-memory token goes
        # stale the instant this returns. It re-fetches via CsrfView
        # right after a successful login; see AuthContext.jsx.
        return Response(UserSerializer(user).data)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        logout(request)  # invalidates the session server-side
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)
