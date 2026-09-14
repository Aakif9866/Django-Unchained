import json

from django.conf import settings
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

# A bundled copy, not a reach-outside-backend/ path. The original lives
# in phase-2-results/dashboard-data.json at the repo root — but Railway
# builds this service with rootDirectory="backend", so its Docker build
# context is backend/ ONLY; a path like BASE_DIR.parent (one level above
# backend/) simply isn't there at build or runtime, regardless of what
# exists in the git repo. Docker Compose's local dev setup worked around
# that with a host volume mount, but Railway has no equivalent "mount the
# repo" mechanism. Keeping this file inside the Django app itself makes
# it work identically everywhere with no deployment-specific config.
# NOTE: this is a copy, not a symlink (Docker COPY doesn't reliably
# follow host symlinks) — re-copy from phase-2-results/dashboard-data.json
# whenever that file is regenerated.
DASHBOARD_DATA_PATH = settings.BASE_DIR / 'dashboard' / 'data' / 'dashboard-data.json'


class Phase2DashboardView(APIView):
    """Serves the Phase 2 testing/results data to logged-in users only.

    This data describes real findings (including open vulnerabilities)
    about this app. A static JSON file under frontend/public/ would be
    world-readable by direct URL regardless of any client-side route
    guard — React Router protecting a page does nothing to protect a
    static asset next to it. Gating this behind the same IsAuthenticated
    permission the rest of the API uses keeps it consistent with how
    everything else here is actually secured, not just how it looks in
    the UI.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not DASHBOARD_DATA_PATH.exists():
            return Response(
                {'detail': 'No Phase 2 results have been generated yet.'},
                status=404,
            )
        with open(DASHBOARD_DATA_PATH) as f:
            data = json.load(f)
        return Response(data)
