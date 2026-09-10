import json

from django.conf import settings
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

# phase-2-results/ lives at the repo root, one level above backend/.
DASHBOARD_DATA_PATH = settings.BASE_DIR.parent / 'phase-2-results' / 'dashboard-data.json'


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
