"""The single source of truth for which mini-apps exist and how they are presented."""
from dataclasses import dataclass

PLAY = "Play"
BUILD = "Build & Explore"
FOCUS = "Focus"
DISCOVER = "Discover"
CATEGORIES = [PLAY, BUILD, FOCUS, DISCOVER]


@dataclass(frozen=True)
class MiniApp:
    slug: str  # Also the URL namespace; every app names its landing page "index".
    name: str
    description: str
    icon: str  # Bootstrap Icons name.
    category: str
    accent: str  # Suffix of an .accent-* class in sidequest.css.
    stats: str | None = None  # Dotted path to a callable(user) -> list[(label, value)].

    @property
    def category_slug(self):
        return self.category.lower().replace(" & ", "-")


APPS = [
    MiniApp("snake", "Snake Arena", "Dodge walls, grab power-ups and climb the global leaderboard.",
            "controller", PLAY, "lime", "apps.snake.services.user_stats"),
    MiniApp("typerush", "TypeRush", "Timed typing sprints with prose and code, scored on real WPM.",
            "keyboard", PLAY, "amber", "apps.typerush.services.user_stats"),
    MiniApp("maze_runner", "Maze Runner", "Race through generated mazes and see the shortest path.",
            "signpost-split", PLAY, "orange", "apps.maze_runner.services.user_stats"),
    MiniApp("regex_playground", "Regex Playground", "Live match highlighting, groups and a library of patterns.",
            "braces-asterisk", BUILD, "pink", "apps.regex_playground.services.user_stats"),
    MiniApp("json_doctor", "JSON Doctor", "Format, validate, explore and convert JSON with exact error locations.",
            "filetype-json", BUILD, "sky", None),
    MiniApp("csv_detective", "CSV Detective", "Profile a CSV: gaps, duplicates, types, statistics, charts, clean-up.",
            "table", BUILD, "emerald", None),
    MiniApp("api_explorer", "API Explorer", "Send real HTTP requests and inspect responses, safely sandboxed.",
            "send", BUILD, "indigo", "apps.api_explorer.services.user_stats"),
    MiniApp("focusquest", "FocusQuest", "A focus timer that pays out XP, levels, streaks and achievements.",
            "hourglass-split", FOCUS, "teal", "apps.focusquest.services.user_stats"),
    MiniApp("notes", "Notes", "Quick notes with autosave, pinning, search and export.",
            "journal-text", FOCUS, "yellow", "apps.notes.services.user_stats"),
    MiniApp("watch_roulette", "Watch Roulette", "Keep a watchlist and let the wheel settle movie night.",
            "film", DISCOVER, "red", "apps.watch_roulette.services.user_stats"),
    MiniApp("colorlab", "ColorLab", "Generate, lock and preview palettes with contrast checks built in.",
            "palette", DISCOVER, "purple", "apps.colorlab.services.user_stats"),
]

APPS_BY_SLUG = {app.slug: app for app in APPS}


def apps_in_category(category):
    return [app for app in APPS if app.category == category]
