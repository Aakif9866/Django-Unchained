"""End-to-end smoke test: every app, as a guest and signed in, in the real system Chrome.

    uv run python manage.py runserver 8765 --noreload      # in one terminal
    uvx --with playwright python e2e/smoke.py              # in another (takes about 3 minutes)

Screenshots go to SHOTS_DIR (default /tmp/sidequest-shots). Exit code 1 on any failure,
including browser console errors and CSP violations.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from harness import SHOTS, Run, start  # noqa: E402

# A seeded Math.random so the test can rebuild exactly the maze the page generated.
SEEDED_RANDOM = """
(() => {
  let seed = 1234567;
  Math.random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
})();
"""


def platform(r):
    p = r.page
    r.goto("/")
    r.check("home: 11 app cards", p.locator(".app-card").count() == 11)
    p.fill("#app-search", "regex")
    r.check("home: search narrows to one", p.locator(".app-card:visible").count() == 1)
    p.fill("#app-search", "zzzz")
    r.check("home: empty search state", p.locator("#no-results").is_visible())
    p.click("#clear-filters")
    p.click('.filter-pill[data-category="discover"]')
    r.check("home: category filter", p.locator(".app-card:visible").count() == 2)
    # With DEBUG=1 Django shows its debug page; the custom template is checked by the Django tests and a DEBUG=0 run.
    r.check("unknown URL is a 404", r.goto("/nope/").status == 404)


def guest_apps(r):
    p = r.page
    r.goto("/apps/snake/")
    p.click("#start")
    p.keyboard.press("Space")
    r.check("snake: pause", p.locator("#overlay").is_visible())
    p.keyboard.press("Space")
    r.until("snake: wall ends the game", lambda: "Game over" in p.inner_text("#overlay-title"), timeout=10)

    r.goto("/apps/notes/")
    r.check("notes: guest sees sign-in prompt", p.get_by_role("link", name="Sign in").count() >= 1)

    r.goto("/apps/watch-roulette/")
    add_titles(r, [("Paprika", "Animation", "Japanese"), ("Arrival", "Sci-Fi", "English")])
    r.check("watch roulette: guest list works in memory", p.locator("#title-list .title-row").count() == 2)
    p.reload()
    r.check("watch roulette: guest list is not persisted", p.locator("#title-list .title-row").count() == 0)

    r.goto("/apps/focusquest/")
    r.check("focusquest: guest timer renders", p.inner_text("#time") == "25:00")
    p.click('label[for="m-custom"]')
    r.check("focusquest: custom fields appear", p.locator("#custom-fields").is_visible())


def add_titles(r, titles):
    p = r.page
    for name, genre, language in titles:
        p.fill("#a-name", name)
        p.fill("#a-genre", genre)
        p.fill("#a-language", language)
        p.click("#add-form button[type=submit]")
        r.until(f"watch roulette: added {name}", lambda n=name: n in p.inner_text("#title-list"))


def snake_signed_in(r):
    p = r.page
    r.goto("/apps/snake/")
    # Steering to food automatically isn't practical, so the save goes through the page's own API client.
    saved = p.evaluate("""() => SQ.api(document.getElementById('snake').dataset.saveUrl, {method: 'POST',
        data: {difficulty: 'normal', score: 120, items_collected: 6, duration_seconds: 30}})""")
    r.check("snake: score saved, new best", saved["is_new_best"] is True)
    p.reload()
    r.until("snake: leaderboard shows me", lambda: p.locator("#leaderboard li.is-me").count() == 1)
    r.check("snake: personal best shown", "120" in p.inner_text("#personal-best"))
    rejected = p.evaluate("""() => SQ.api(document.getElementById('snake').dataset.saveUrl, {method: 'POST',
        data: {difficulty: 'normal', score: 99999, items_collected: 1, duration_seconds: 30}}).then(() => 'saved', e => e.message)""")
    r.check(f"snake: impossible score rejected ({rejected})", rejected != "saved")


def maze_signed_in(r):
    p = r.page
    p.add_init_script(SEEDED_RANDOM)
    r.goto("/apps/maze-runner/")
    path = p.evaluate("""() => {
        let seed = 1234567;
        const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
        const maze = MazeCore.generate(12, rand);
        return MazeCore.shortestPath(maze, {x: 0, y: 0}, {x: 11, y: 11});
    }""")
    optimal = int(p.inner_text("#hud-optimal"))
    r.check("maze: rebuilt the same maze", len(path) - 1 == optimal)
    keys = {(1, 0): "ArrowRight", (-1, 0): "ArrowLeft", (0, 1): "ArrowDown", (0, -1): "ArrowUp"}
    for a, b in zip(path, path[1:]):
        p.keyboard.press(keys[(b["x"] - a["x"], b["y"] - a["y"])])
        p.wait_for_timeout(25)
    r.until("maze: completion detected", lambda: p.locator("#overlay").is_visible())
    r.check("maze: moves equal the shortest path", p.inner_text("#hud-moves") == str(optimal))
    r.until("maze: run saved to history", lambda: "moves" in p.inner_text("#history"))
    r.until("maze: leaderboard shows me", lambda: p.locator("#leaderboard li.is-me").count() == 1)
    r.shot("maze-solved")


def typerush_signed_in(r):
    p = r.page
    r.goto("/apps/typerush/")
    p.click('label[for="s-30"]')
    r.until("typerush: passage loaded", lambda: p.locator("#passage span").count() > 100)
    text = p.evaluate("[...document.querySelectorAll('#passage span')].map(s => s.dataset.newline ? '\\n' : s.textContent).join('')")
    p.click("#type-box")
    p.keyboard.type(text[:120], delay=40)
    p.keyboard.type("zz")  # Two deliberate mistakes.
    r.until("typerush: 30s run finishes", lambda: p.locator("#results").is_visible(), timeout=40)
    r.until("typerush: result saved", lambda: "Saved" in p.inner_text("#res-saved"), timeout=10)
    wpm = float(p.inner_text("#res-wpm"))
    r.check(f"typerush: WPM is the 120-correct-chars value ({wpm})", wpm == 48.0)
    r.check("typerush: mistakes counted", p.inner_text("#res-errors") == "2")
    r.check("typerush: progress chart shown", p.locator("#history-box").is_visible())
    r.shot("typerush-result")


def focusquest_signed_in(r):
    p = r.page
    r.goto("/apps/focusquest/")
    p.click('label[for="m-custom"]')
    p.fill("#custom-focus", "1")
    p.fill("#custom-break", "0")
    p.click("#start")
    r.until("focusquest: timer running", lambda: p.inner_text("#phase") == "Focusing")
    r.check("focusquest: modes locked while running", p.locator("#m-pomodoro").is_disabled())
    # A real minute: the server refuses to pay out early, so there's no shortcut here.
    r.until("focusquest: XP awarded after a real minute", lambda: p.inner_text("#s-sessions") == "1", timeout=75)
    r.check("focusquest: 2 XP for 1 minute", p.inner_text("#xp-label").startswith("2 XP"))
    r.check("focusquest: first achievement unlocked", p.locator(".achievement.is-unlocked").count() == 1)
    r.check("focusquest: streak is 1", p.inner_text("#s-streak") == "1")
    r.shot("focusquest", full=True)
    early = p.evaluate("""async () => {
        const root = document.getElementById('focus');
        const s = await SQ.api(root.dataset.startUrl, {method: 'POST', data: {mode: 'pomodoro'}});
        return SQ.api(`${root.dataset.completeBase}${s.id}/complete/`, {method: 'POST'}).then(() => 'paid', e => e.message);
    }""")
    r.check(f"focusquest: early completion refused ({early})", "still has" in early)
    p.evaluate("SQ.api(document.getElementById('focus').dataset.abandonUrl, {method: 'POST'})")


def watch_roulette_signed_in(r):
    p = r.page
    r.goto("/apps/watch-roulette/")
    add_titles(r, [("Paprika", "Animation", "Japanese"), ("Arrival", "Sci-Fi", "English"), ("Dangal", "Drama", "Hindi")])
    p.fill("#a-name", "arrival")
    p.fill("#a-genre", "Sci-Fi")
    p.fill("#a-language", "English")
    p.click("#add-form button[type=submit]")
    r.until("watch roulette: duplicate rejected", lambda: "already on your list" in p.inner_text("#toasts"))
    p.click("#spin")
    r.until("watch roulette: wheel picks a title", lambda: p.locator("#result").is_visible(), timeout=8)
    picked = p.inner_text("#result-name")
    r.check(f"watch roulette: pick is on the list ({picked})", picked in ("Paprika", "Arrival", "Dangal"))
    r.shot("watch-roulette")
    p.click("#result-watched")
    r.until("watch roulette: marked watched", lambda: p.inner_text("#n-history") == "1")
    p.select_option("#f-language", "Hindi")
    r.check("watch roulette: language filter", "1 title" in p.inner_text("#candidate-count") or "0 titles" in p.inner_text("#candidate-count"))
    p.reload()
    r.until("watch roulette: list persisted", lambda: p.inner_text("#n-history") == "1" and p.inner_text("#n-watchlist") == "2")


def colorlab_signed_in(r):
    p = r.page
    r.goto("/apps/colorlab/")
    r.check("colorlab: five swatches", p.locator(".swatch").count() == 5)
    first = p.inner_text(".swatch >> nth=0 >> .swatch-hex")
    p.click(".swatch >> nth=0 >> .swatch-tool")
    p.click("#generate")
    p.click("#generate")
    r.check("colorlab: locked colour survives regenerate", p.inner_text(".swatch >> nth=0 >> .swatch-hex") == first)
    r.check("colorlab: contrast badges", p.locator("#demo-contrast .sq-badge").count() == 4)
    p.select_option("#count", "7")
    r.check("colorlab: colour count changes", p.locator(".swatch").count() == 7)
    p.click(".swatch >> nth=1 >> .swatch-hex")
    copied = p.evaluate("navigator.clipboard.readText()")
    r.check(f"colorlab: copy HEX ({copied})", copied.startswith("#") and len(copied) == 7)
    p.fill("#save-name", "Smoke palette")
    p.click("#save-form button")
    r.until("colorlab: palette saved", lambda: "Smoke palette" in p.inner_text("#saved"))
    r.shot("colorlab", full=True)
    p.reload()
    r.until("colorlab: saved palette persisted", lambda: "Smoke palette" in p.inner_text("#saved"))
    p.click("#saved .icon-btn")
    r.until("colorlab: palette deleted", lambda: "No saved palettes" in p.inner_text("#saved"))


def notes_signed_in(r):
    p = r.page
    r.goto("/apps/notes/")
    p.click("#new-note")
    p.fill("#note-title", "Groceries")
    p.fill("#note-body", "eggs\nflour\n<script>alert(1)</script>")
    r.until("notes: autosaved", lambda: p.inner_text("#save-status").startswith("Saved"), timeout=5)
    p.click("#pin")
    r.until("notes: pinned", lambda: p.locator("#note-list .bi-pin-fill").count() == 1)
    p.reload()
    r.until("notes: persisted after reload", lambda: p.input_value("#note-title") == "Groceries")
    r.check("notes: markup kept as plain text", "<script>" in p.input_value("#note-body"))
    p.fill("#search", "flour")
    r.check("notes: search finds it", p.locator(".note-item").count() == 1)
    p.fill("#search", "")
    r.shot("notes")
    p.click("#delete")
    p.click("#confirm-delete")
    r.until("notes: deleted", lambda: "No notes yet" in p.inner_text("#note-list"))


def utilities_signed_in(r):
    p = r.page
    r.goto("/apps/regex/")
    p.fill("#save-name", "Emails")
    p.click("#save-form button")
    r.until("regex: pattern saved", lambda: "Emails" in p.inner_text("#saved"))
    p.fill("#pattern", "x")
    p.click("#saved .load")
    r.check("regex: saved pattern loads", "@" in p.input_value("#pattern"))

    r.goto("/apps/api-explorer/")
    p.fill("#url", "http://10.0.0.1/")
    p.click("#send")
    r.until("api explorer: private address blocked", lambda: "private" in p.inner_text("#res-empty"))
    p.fill("#url", "https://example.com/")
    p.fill("#save-name", "Example")
    p.click("#save-form button")
    r.until("api explorer: request saved", lambda: "Example" in p.inner_text("#saved"))
    p.click("#send")
    r.until("api explorer: public request shows status", lambda: p.locator("#res-status").is_visible() or "resolve" in p.inner_text("#res-empty"), timeout=20)
    r.until("api explorer: history recorded", lambda: "example.com" in p.inner_text("#history"))


def favourites_and_dashboard(r):
    p = r.page
    r.goto("/")
    p.click('.app-card:has-text("ColorLab") .fav-btn')
    r.until("favourite toggled", lambda: p.locator('.app-card:has-text("ColorLab") .fav-btn[aria-pressed="true"]').count() == 1)
    p.reload()
    r.check("home: favourites section", "ColorLab" in p.inner_text(".chip-row >> nth=0"))
    r.check("home: recently used section", p.locator("h2:has-text('Recently used')").count() == 1)
    r.goto("/dashboard/")
    text = p.inner_text("main")
    r.check("dashboard: real numbers", "Games saved" in text and "Saved patterns" in text)
    r.shot("dashboard", full=True)


def layouts(playwright):
    """No horizontal scroll at any width, in either theme."""
    pages = ["/", "/apps/snake/", "/apps/typerush/", "/apps/regex/", "/apps/json-doctor/", "/apps/csv-detective/",
             "/apps/maze-runner/", "/apps/focusquest/", "/apps/api-explorer/", "/apps/watch-roulette/",
             "/apps/colorlab/", "/apps/notes/", "/accounts/login/"]
    for width in (320, 375, 768, 1024, 1920):
        r = Run(playwright, width=width, height=900, color_scheme="dark")
        for theme in ("dark", "light"):
            r.page.add_init_script(f"localStorage.setItem('sq-theme', '{theme}')")
            for path in pages:
                r.goto(path)
                overflow = r.page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
                r.check(f"layout {width}px {theme} {path}: no sideways scroll ({overflow}px)", overflow <= 0)
            r.goto("/")
            r.shot(f"home-{width}-{theme}")
            r.goto("/apps/colorlab/")
            r.shot(f"colorlab-{width}-{theme}")
        yield r


def main():
    playwright = start()
    runs = []

    guest = Run(playwright)
    platform(guest)
    guest_apps(guest)
    runs.append(guest)

    user = Run(playwright)
    name = user.register()
    print(f"signed in as {name}")
    for section in (snake_signed_in, maze_signed_in, typerush_signed_in, watch_roulette_signed_in, colorlab_signed_in,
                    notes_signed_in, utilities_signed_in, focusquest_signed_in, favourites_and_dashboard):
        print(f"\n[{section.__name__}]")
        try:
            section(user)
        except Exception as error:  # Keep going so one broken section doesn't hide the rest.
            user.check(f"{section.__name__} crashed: {str(error).splitlines()[0]}", False)
            user.shot(f"crash-{section.__name__}")
    runs.append(user)

    if "--no-layout" not in sys.argv:
        print("\n[layouts]")
        runs.extend(layouts(playwright))

    passed = sum(len(r.passed) for r in runs)
    problems = [problem for r in runs for problem in r.problems]
    for r in runs:
        r.browser.close()
    playwright.stop()
    print(f"\n{passed} checks passed, {len(problems)} problems")
    for problem in problems:
        print("  !!", problem)
    (SHOTS / "smoke.json").write_text(json.dumps({"passed": passed, "problems": problems}, indent=2))
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
