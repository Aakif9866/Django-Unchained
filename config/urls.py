from django.contrib import admin
from django.urls import include, path

MINI_APP_ROUTES = {
    "snake/": "apps.snake.urls",
    "typerush/": "apps.typerush.urls",
    "regex/": "apps.regex_playground.urls",
    "json-doctor/": "apps.json_doctor.urls",
    "csv-detective/": "apps.csv_detective.urls",
    "maze-runner/": "apps.maze_runner.urls",
    "focusquest/": "apps.focusquest.urls",
    "api-explorer/": "apps.api_explorer.urls",
    "watch-roulette/": "apps.watch_roulette.urls",
    "colorlab/": "apps.colorlab.urls",
    "notes/": "apps.notes.urls",
}

urlpatterns = [
    path("admin/", admin.site.urls),
    path("accounts/", include("accounts.urls")),
    path("", include("core.urls")),
    *[path(f"apps/{route}", include(module)) for route, module in MINI_APP_ROUTES.items()],
]
