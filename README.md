# SIDEQUEST

**Small tools. Big distractions.**

SIDEQUEST is one Django site hosting eleven independent mini-apps: three browser games, four developer utilities, two
focus tools and two discovery toys. They share accounts, a dashboard and one design system. Everything works without
an account. Signing in is only needed to keep scores, history and saved work.

| Category | App | What it does |
|---|---|---|
| Play | **Snake Arena** | Snake with three difficulty levels, obstacles, four power-ups, personal bests and a global leaderboard |
| Play | **TypeRush** | 30, 60 or 120 second typing tests on prose or code, live WPM and accuracy, progress chart, leaderboard |
| Play | **Maze Runner** | Randomly generated mazes in three sizes, timer, move counter, shortest-path solver, leaderboard |
| Build & Explore | **Regex Playground** | Live match highlighting, capture groups, flags, a pattern library and saved patterns |
| Build & Explore | **JSON Doctor** | Format, minify and validate JSON with exact error locations, a collapsible tree, and conversion to and from CSV |
| Build & Explore | **CSV Detective** | Upload a CSV for a Pandas profile: types, gaps, duplicates, statistics, charts, and a cleaned download |
| Build & Explore | **API Explorer** | A small Postman: send real HTTP requests through a sandboxed server-side client, save them, keep history |
| Focus | **FocusQuest** | Pomodoro (25/5), deep work (50/10) and custom timers that pay out XP, levels, streaks and achievements |
| Focus | **Notes** | Private notes with autosave, pinning, search and plain-text export |
| Discover | **Watch Roulette** | A watchlist with genres, languages, ratings and favourites, plus a wheel to pick tonight's title |
| Discover | **ColorLab** | Palette generator with colour locking, HEX and RGB copy, a live sample page and WCAG contrast checks |

The platform adds search, category filters, favourites, recently used apps, a dashboard of your real numbers, toast
notifications, light and dark themes, and a custom 404 page.

## Technology

| Layer | Choice |
|---|---|
| Backend | Python 3.13+, Django 6.1, Django ORM |
| Data | SQLite in development, PostgreSQL in production (switched by one environment variable) |
| Data processing | Pandas (CSV Detective) |
| Frontend | Django templates, vanilla JavaScript, Bootstrap 5, Bootstrap Icons, Chart.js |
| Serving | gunicorn, WhiteNoise for compressed, hashed static files |
| Tooling | uv for environments and dependencies, Django's test runner, Playwright (via `uvx`) for browser tests |

There's no React or Node build step. All frontend assets are vendored into `static/vendor/`, so the site needs no CDN
and can run under a strict Content Security Policy.

## Architecture

```text
Browser ── HTML pages (Django templates) ──┐
   │                                       │
   └── JSON calls via window.SQ.api ───────┤
                                           ▼
                                 Django (config/urls.py)
              ┌──────────────┬─────────────┴──────────────┐
            core/        accounts/                  apps/<mini-app>/
   home, dashboard,    register, login,     each owns models, forms, services,
   favourites, recents, profile, password    views, urls, templates, static, tests
   registry, shared API
   helpers, rate limits
                                           │
                                  SQLite or PostgreSQL
```

- **`core/registry.py`** is the single list of apps: name, category, icon, accent colour, and where to find the app's
  dashboard numbers. The homepage, navigation and dashboard are all generated from it.
- **Every mini-app is a self-contained Django app** in `apps/`. Views stay thin. Rules live in each app's `services.py`
  and input validation in `forms.py`. Core never imports an app's models: the dashboard asks each app for its numbers
  through a function named in the registry.
- **`core/api.py`** gives every JSON endpoint the same shape: `@api_view` enforces methods and login, `validated()` binds
  a JSON body to a Django form, and `ApiError` becomes a JSON error with the right status code.
- **`static/js/sidequest.js`** exposes `window.SQ`: a fetch wrapper with CSRF, toasts, clipboard, downloads, leaderboard
  rendering and a DOM builder that always writes user data as text, never as HTML.
- **Recently used apps** are recorded by `core.middleware.RecentAppMiddleware` whenever an app's landing page opens: in
  the database for members, in the session for guests.

### Folder structure

```text
.
├── config/            settings, root URLs, WSGI
├── core/              homepage, dashboard, registry, favourites, recents, shared API and rate-limit helpers
├── accounts/          custom user model, registration, throttled login, profile, password change
├── apps/
│   ├── snake/  typerush/  maze_runner/
│   ├── regex_playground/  json_doctor/  csv_detective/  api_explorer/
│   ├── focusquest/  notes/
│   └── watch_roulette/  colorlab/
│       (each: models.py forms.py services.py views.py urls.py tests.py templates/ static/)
├── templates/         base.html, 404/500, account pages, components/ (cards, header, forms, d-pad)
├── static/            css/sidequest.css (design tokens), js/sidequest.js (shared helpers), vendor/
├── e2e/               Playwright harness and end-to-end smoke test
├── docs/decisions.md  architectural decisions
├── pyproject.toml     dependencies (uv), with uv.lock
└── requirements.txt   exported from uv.lock for platforms that expect it
```

## Getting started

You need [uv](https://docs.astral.sh/uv/). It installs a suitable Python by itself if you don't have one.

```bash
git clone <repo-url> sidequest && cd sidequest
git checkout 10-projects

cp .env.example .env            # Then put a long random value in DJANGO_SECRET_KEY.
uv sync                         # Creates .venv and installs everything from uv.lock.
uv run python manage.py migrate
uv run python manage.py createsuperuser    # Optional: for /admin/.
uv run python manage.py runserver
```

Open http://127.0.0.1:8000/. To generate a secret key:

```bash
uv run python -c "from django.core.management.utils import get_random_secret_key as k; print(k())"
```

`uv sync` replaces the classic `python -m venv` plus `pip install -r requirements.txt` steps. If you'd rather use pip,
`requirements.txt` is exported from the lock file with `uv export --no-hashes --no-dev --extra prod -o requirements.txt`.

## Configuration

All settings come from environment variables. In development they can live in `.env`, which is git-ignored.

| Variable | Default | Purpose |
|---|---|---|
| `DJANGO_SECRET_KEY` | none | Required whenever `DJANGO_DEBUG` isn't `1`. Settings refuse to load without it. |
| `DJANGO_DEBUG` | `0` | `1` for local development only. Secure by default. |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1` | Comma-separated hostnames. |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | empty | Comma-separated origins with scheme, for example `https://sidequest.example.com`. |
| `DATABASE_URL` | empty, so SQLite | For example `postgres://user:pass@host:5432/sidequest`. |
| `DJANGO_SSL_REDIRECT` | `1` when not debugging | Set to `0` only if a proxy in front already forces HTTPS, or for a local production test. |

With `DJANGO_DEBUG=0` the site also turns on secure cookies, HTTPS redirects, HSTS (one hour, raise it once you're
sure) and hashed, compressed static files.

## Testing

```bash
uv run python manage.py test        # 121 unit and integration tests, about 30 seconds
```

The end-to-end suite drives the real site in your installed Google Chrome, as a guest and as a newly registered user.
It plays the games, solves a maze by keyboard, completes a real one-minute FocusQuest session, saves and deletes
everything, and checks five screen widths in both themes for sideways scrolling. Any browser console error or CSP
violation fails it.

```bash
uv run python manage.py runserver 8765 --noreload           # Terminal 1
uvx --with playwright python e2e/smoke.py                   # Terminal 2. About 4 minutes, 199 checks.
uvx --with playwright python e2e/smoke.py --no-layout       # Skips the width and theme sweep.
BASE_URL=http://localhost:8766 uvx --with playwright python e2e/smoke.py   # Against another server.
```

Screenshots land in `/tmp/sidequest-shots` (override with `SHOTS_DIR`). Both suites pass on SQLite and on PostgreSQL
16, and the smoke test also passes against gunicorn with `DJANGO_DEBUG=0`.

## Deployment

The project is a standard WSGI app. On any host (a VPS, Render, Railway, Fly.io and so on):

1. Provision PostgreSQL and set `DATABASE_URL`.
2. Set `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS`, `DJANGO_CSRF_TRUSTED_ORIGINS`, and leave `DJANGO_DEBUG` unset.
3. Build: `uv sync --frozen --extra prod && uv run python manage.py collectstatic --noinput`.
4. Release: `uv run python manage.py migrate`.
5. Run: `uv run gunicorn config.wsgi --bind 0.0.0.0:$PORT --workers 3 --timeout 60`.

WhiteNoise serves static files, so no separate static server is needed. If you put Nginx or another proxy in front,
also cap request bodies there (for example `client_max_body_size 12m;`), because Django can only reject an oversized
CSV after it has been uploaded. Run `uv run python manage.py check --deploy` before going live. The two HSTS warnings
it raises (subdomains and preload) are left for you to opt into, because they depend on your domain.

## How each app works

**Snake Arena.** The game runs on a 24×24 canvas grid with a `setTimeout` tick that speeds up as you eat. Input is
queued, so two quick turns between ticks both register, and reversing into yourself is ignored. Obstacles are placed
away from the snake's head, and more appear as you eat. Power-ups (gold apple, double points, slow motion, ghost) have
timers that freeze while paused. Finished games post the score, items collected and duration. The server rejects
anything impossible for those numbers, and stores the score against the signed-in user.

**TypeRush.** The server builds a shuffled passage longer than anyone could type in the time, from an internal
collection of prose and code (`apps/typerush/texts.py`). A hidden textarea captures typing, including on phones, and
only changed characters are repainted. The browser reports raw counts only: correct characters, keystrokes and
mistakes. The server computes the official numbers itself: WPM = (correct characters ÷ 5) ÷ minutes, and accuracy =
correct keystrokes ÷ all keystrokes. Results above 300 WPM, or counts that don't add up, are rejected.

**Maze Runner.** `maze-core.js` generates the maze with randomized depth-first search, an iterative backtracker that
stores each cell's open sides as a bitmask, which guarantees exactly one path between any two cells. The solver is a
breadth-first search, so the first path it finds to the exit is the shortest. Runs that turned on the solver count as
practice and aren't saved. The server rejects runs with fewer moves than the corner-to-corner distance, or faster than
15 ms per move.

**Regex Playground.** Patterns run in a Web Worker with your browser's JavaScript regex engine. If a pattern takes over
a second, as catastrophic backtracking like `(a+)+$` does, the worker is killed and replaced, so the tab never freezes.
Matches are highlighted by a backdrop layer that mirrors the textarea's text exactly. Saved patterns and their flags are
validated server-side.

**JSON Doctor.** Runs entirely in the browser, so pasted data never reaches the server. A small strict validator walks
the text first, because native `JSON.parse` error messages and positions differ between browsers. It reports the exact
line and column plus a plain explanation (trailing comma, single quotes, leading zeros and so on), then `JSON.parse`
does the real parse. The tree renders children lazily, so large documents stay responsive. CSV conversion flattens
nested objects into dotted column names, and the CSV reader follows RFC 4180.

**CSV Detective.** Uploads are checked for extension, size (10 MB), row and column limits and binary content, then
parsed in memory with Pandas and never written to disk or executed. The profile covers inferred types (integer, float,
boolean, datetime, text), missing values, duplicates, quartiles, histograms and top values. Cleaning re-reads the file
as text, so values like `007` survive. It can neutralise cells starting with `=`, `+`, `-` or `@`, so the download
can't run formulas when opened in a spreadsheet. No account needed, but uploads are rate-limited.

**API Explorer.** Requests are sent by Django through `apps/api_explorer/safe_http.py`, which is built to stop
server-side request forgery (SSRF):
- **Destinations:** only `http` and `https` on ports 80, 443, 8000, 8080 and 8443, and no credentials in URLs.
- **Address checks:** every address the hostname resolves to must be public. Loopback, private, link-local, cloud
  metadata (`169.254.169.254`), carrier-grade NAT, multicast and reserved ranges are refused, including when they hide
  inside IPv6 mappings, 6to4, Teredo or NAT64.
- **DNS rebinding:** the connection opens to the exact IP that passed the check, so DNS can't switch it to an internal
  address in between. TLS still verifies the real hostname.
- **Redirects:** followed by hand, and every hop goes through all of the checks again. Authorization and cookies are
  dropped when a redirect changes origin.
- **Limits:** 15 seconds in total, 1 MB per response, 1 MB per request body, 5 redirects.
- **Headers:** headers like `Host` and `Transfer-Encoding` can't be overridden, and nothing from your SIDEQUEST session
  is ever forwarded.

History stores only the method, URL, status and timing, never headers or bodies.

**FocusQuest.** The browser runs the visible clock against a wall-clock target, so a throttled background tab can't
drift it. The server keeps the authoritative record:
- **Starting:** starting a session stamps it with the server's time and abandons any other active session.
- **Completing:** a completion pays out only if the planned time has really passed, measured by the server, and only
  once.
- **Abandoning:** a session left running more than two hours past its end is marked abandoned.
- **The result:** nobody can earn XP faster than 2 per minute of real time, whatever the browser sends.

Levels need 0, 100, 300, 600, 1000… XP in total. Streaks count calendar days with at least one completed session.
Eight achievements are evaluated after each completion.

**Notes.** Edits autosave 600 ms after you stop typing. Saves for a note are queued, so an older save can never land
after a newer one. Leaving or hiding the page flushes pending changes with a `keepalive` request. Notes are plain text,
stored and displayed without interpretation, so typed markup can't run.

**Watch Roulette.** The winner is drawn first, uniformly from every title matching the filters, using rejection
sampling over `crypto.getRandomValues`. The wheel then shows up to 12 of those titles, including the winner, and spins
to land on it. Every title has an equal chance even when the wheel can't show them all. Signed-in lists live in the
database. Guests get a fully working list held in page memory. Marking a title watched records when, which builds the
watch history.

**ColorLab.** Palettes are generated in HSL. Harmonic, analogous, complementary, triadic and monochrome schemes walk
the lightness from dark to light, so every palette is usable. Contrast ratios use the WCAG 2 relative luminance
formula. The sample page assigns roles automatically: darkest colour for the background, most saturated for the
button, and black or white text wherever palette colours can't reach AA. Every pairing it shows comes with its ratio
and grade.

## Security notes

- Passwords use Django's default hashing and validators. Login is throttled to 10 attempts per minute per IP.
- CSRF protection on every state-changing request. Logout is POST-only.
- A strict Content Security Policy with no inline scripts or styles, plus `X-Frame-Options: DENY`, `nosniff` and a
  `same-origin` referrer policy.
- Every API checks ownership in its query (`get_object_or_404(..., user=request.user)`), so one user can't read or
  change another's data. Tests cover this for every app.

## Known limitations

- **Game scores can't be proven honest.** Snake, TypeRush and Maze Runner are played in the browser, so the server can
  only reject results that are impossible, not prove they were earned. FocusQuest is different: its XP is derived from
  the server clock.
- **Rate limits are approximate.** They use Django's local-memory cache, so each worker process counts separately.
  Behind a proxy, every client shares one IP bucket, because `X-Forwarded-For` isn't trusted. Point `CACHES` at a
  shared backend if exact limits matter.
- **Streaks use UTC days.** Users far from UTC may see a day roll over at an odd local hour.
- **No password reset,** because that needs an email service.
- **Snake's leaderboard save is tested through the page's API client** rather than by an automated player steering to
  food. The game itself is tested through to game over.
- **Watch Roulette has no movie database lookup.** A TMDB integration could be added later. The app is deliberately
  complete without one.
