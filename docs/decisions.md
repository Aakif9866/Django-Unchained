# Architectural decisions

Only decisions that shape the project, with the reason and the trade-off accepted.

## 1. SIDEQUEST lives on its own orphan branch

`10-projects` shares no history with `main`, which holds the earlier Django Unchained project. The two are unrelated
codebases, and an orphan branch keeps each history readable without a second repository.
**Trade-off:** the branch can't be merged into `main` in the usual way, and isn't meant to be.

## 2. No Django REST Framework

The JSON endpoints are small and same-origin. Django forms already validate input, and `core/api.py` adds the three
things DRF would have supplied: method and login enforcement, JSON body binding, and consistent error responses.
**Trade-off:** no browsable API or serializers. Revisit if a public or third-party API is ever needed.

## 3. Vanilla JS, vendored assets, strict CSP

There's no build step, Bootstrap and Chart.js are vendored into `static/vendor/`, and every script is a first-party
file. That allows `script-src 'self'; style-src 'self'` with no inline code at all, which shuts out most XSS
techniques even if a bug slips through. Styles set from JavaScript go through the CSSOM, which CSP permits.
**Trade-off:** no inline `<script>` or `style=""` anywhere, and data reaches scripts through `data-*` attributes.

## 4. One registry drives the platform

`core/registry.py` lists every app. The homepage, navigation, dashboard and recently-used tracking read from it, and
core reaches each app's numbers only through a dotted function path. Adding an app is one registry entry plus a route.
**Trade-off:** the registry is code, not data, which is fine at this scale.

## 5. Custom user model from day one

`accounts.User` extends `AbstractUser` with `display_name` and `bio`. Swapping the user model later is one of Django's
most painful migrations, and doing it up front costs nothing.

## 6. Server-authoritative FocusQuest XP

XP isn't something the browser reports. The server timestamps session starts, refuses completions before the planned
time has passed, pays each session once, and abandons the previous session whenever a new one starts. Together these
cap earnings at the real-time rate.
**Trade-off:** pausing makes a session take longer in real time, which is correct: it still pays out once enough time
has passed.

## 7. Game scores are validated for plausibility, not proven

Snake, TypeRush and Maze Runner run in the browser, so a determined user can always forge a request. The server
rejects what's impossible (more points than items allow, more correct characters than keystrokes, fewer moves than the
maze's corner-to-corner distance) and derives WPM itself.
**Trade-off:** leaderboards are honest-ish, not tamper-proof. Making them tamper-proof would need the server to replay
games, which is out of scope.

## 8. API Explorer: resolve, check, pin, revalidate

The SSRF guard resolves the hostname once, requires every answer to be public, connects to that exact IP, and
revalidates every redirect hop. It uses the standard library's `http.client` with a pinned-socket connection class
instead of `requests`, which keeps the connection logic small enough to audit and avoids a dependency.
**Trade-off:** no HTTP/2 and no automatic decompression. Responses are requested with `Accept-Encoding: identity`.

## 9. JSON Doctor runs only in the browser

Formatting and validation need no server, and keeping pasted data local is a privacy feature worth stating in the UI.

## 10. CSV Detective is stateless

The browser keeps the `File` and re-sends it for the cleaned download, instead of the server storing uploads between
requests. That means no temporary files to clean up, nothing persisted, and no cross-user access to worry about.
**Trade-off:** the file is uploaded twice. Fine at the 10 MB cap.

## 11. Cheap, honest rate limiting

`core/ratelimit.py` is a fixed-window counter on Django's cache, used for login, CSV uploads and API Explorer. It keys
on `REMOTE_ADDR`, never on a client-supplied header.
**Trade-off:** counts are per process under the default local-memory cache, and clients behind one proxy share a
bucket, which errs towards too strict rather than too loose. A shared cache backend fixes both.

## 12. SQLite in development, PostgreSQL by environment variable

`DATABASE_URL` switches databases with no code change. The full test suite has been run on both.
