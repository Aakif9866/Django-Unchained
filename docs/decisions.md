# Architectural Decisions

## Template

```
### Decision:
Alternatives:
Why we chose this:
Tradeoffs:
```

---

### Decision: Django + Django REST Framework for the backend
Alternatives: Flask, FastAPI, Express/Node, plain Django without DRF
Why we chose this: Given as the project's backend stack — Django gives batteries-included
structure (auth scaffolding, admin, settings/middleware conventions), and DRF is the standard
way to build REST APIs on top of it, which is exactly what's being learned here.
Tradeoffs: More opinionated/heavier than Flask or FastAPI. Django's built-in ORM assumes a
relational database, which we are deliberately not using — see the MongoDB decision below for
what that costs us.

### Decision: React + Vite for the frontend
Alternatives: Next.js, Vue, plain HTML/JS
Why we chose this: React is the most widely used component framework, and Vite gives a fast,
simple dev server without the added complexity (routing conventions, SSR) that a meta-framework
like Next.js would introduce. Keeps focus on frontend fundamentals rather than framework magic.
Tradeoffs: No built-in SSR/routing/API layer like Next.js — we add client-side routing ourselves,
which is more to learn but also more to see explicitly instead of it being hidden.

### Decision: MongoDB as the database — SUPERSEDED 2026-09-11, see below
Alternatives: PostgreSQL, MySQL/SQLite
Why we chose this: Given as the project's database. It's a deliberate deviation from Django's
"native" relational assumption, specifically so we learn how Django/DRF integrate with a
non-relational database and what that costs.
Tradeoffs: Django's ORM does not speak MongoDB natively — an additional library (an ODM, or the
raw `pymongo` driver) is required, and we lose things a relational DB + Django ORM give for free:
migrations in the Django sense, `ForeignKey`/joins, and some of Django's admin/auth integration
that assumes `django.contrib.auth`'s relational User model. This will be spelled out concretely
in Phase 1.5 before writing any database code, including the exact library chosen and why.
Status: this entry (and the pymongo/SQLite-hybrid entry below it) describe Phase 1 as originally
built. Kept here, not deleted, because the friction described above is exactly what the project
set out to teach, and it *was* learned — see the migration decision at the bottom of this file
for what changed and why.

### Decision: uv for Python dependency/environment management
Alternatives: pip + venv (the stdlib default), Poetry, Pipenv
Why we chose this: uv (Astral) manages the virtual environment, dependency resolution, and a
lockfile (`uv.lock`) through one tool and one `pyproject.toml`, and is dramatically faster than
pip. `uv sync` reproduces the exact same environment from the lockfile every time, which
`pip install -r requirements.txt` cannot guarantee (that file has no real dependency tree, just
a flat snapshot).
Tradeoffs: One more tool to learn, and newer/less ubiquitous than pip — some tutorials and CI
examples online still assume pip. The `.venv` uv creates is still a completely normal Python
virtual environment underneath, so nothing about *how Python itself works* changes, just how we
manage it.

### Decision: Session authentication (HttpOnly cookie) over JWT
Alternatives: JWT in localStorage, JWT in an HttpOnly cookie
Why we chose this: Django + DRF's SessionAuthentication is the framework default, stores no
token in JS-reachable storage (the sessionid cookie is HttpOnly — XSS can't read it), and DRF
enforces CSRF checks on session-authenticated requests automatically, so we get both protections
"for free" instead of hand-rolling refresh-token logic. JWT earns its complexity when you need
stateless auth across multiple independent backends/services or long-lived mobile clients —
neither applies to one Django monolith serving one React frontend.
Tradeoffs: Session auth means the backend holds server-side state per logged-in user (a session
row), which matters for horizontal scaling (sessions need a shared store, e.g. a database or
cache, across backend instances) — not a concern at our scale, but the honest reason "JWT scales
better" gets said in interviews. Also cookie-based auth requires CORS + CSRF configured
correctly for the cross-origin dev setup (React on :5173, Django on :8000) — see
`config/settings.py` (CORS_ALLOWED_ORIGINS, CSRF_TRUSTED_ORIGINS) for exactly what that took.
Explained in depth: this was a compressed "speedrun" pass (see PROGRESS.md) — the full
session-vs-JWT walkthrough that was supposed to precede this decision is still owed and worth
doing before Phase 2's CSRF/CORS testing.

### Decision: MongoDB reached via raw pymongo, not an ODM, with Django's own auth/sessions on SQLite — SUPERSEDED 2026-09-11
Alternatives: djongo/mongoengine (map Mongo into Django's ORM shape), a single database for
everything
Why we chose this: djongo-style ORM shims lag behind current Django versions and reintroduce a
relational mental model (via a document store) that hides real differences. Talking to Mongo
directly with `pymongo` (see `backend/config/mongo.py`) means what's on screen is what actually
happens: no `_id` vs `id` confusion, no hidden query translation. Django's own `User`/session
tables still need *some* database — using the default SQLite for those (not Mongo) means
`django.contrib.auth`'s password hashing, admin, and session machinery work completely normally,
and we only hand-roll the parts that are genuinely MongoDB (notes).
Tradeoffs: Two databases running for one small app is genuinely more moving parts than a single
Postgres would be — this is a deliberate, visible cost of the "learn real Mongo integration"
goal from `docs/decisions.md`'s MongoDB entry above, not an accident.
Deployment caveat (confirmed with user 2026-09-10, revisit in Phase 3.4/3.5): SQLite is a local
file, not a networked service — it breaks silently on ephemeral container filesystems (data
wiped on restart/redeploy) and doesn't work at all across multiple backend instances (each gets
its own file). Fine for local dev now; before any real deployment, swap `DATABASES['default']`
to PostgreSQL, which is a small, mechanical change. Not done now — no reason to run Postgres
before Phase 3 actually needs it.

### Decision: JavaScript (not TypeScript) for the frontend
Alternatives: TypeScript
Why we chose this: Given the speedrun's time constraint and that this stack (React notes CRUD)
is already familiar territory from a prior MERN project, plain JS kept the build fast with zero
type-plumbing overhead. TypeScript's real value here is compile-time safety on the shape of API
responses/props — genuinely worth having on a bigger or longer-lived codebase.
Tradeoffs: No compile-time guarantee the frontend and `NoteSerializer`/`UserSerializer` stay in
sync — a backend field rename would only surface as a runtime `undefined`, not a build error.
Worth revisiting if this project grows past the current small page count.

### Decision: Migrate from MongoDB + SQLite-for-auth to a single PostgreSQL database (Neon)
Alternatives: keep the MongoDB + SQLite hybrid; MongoDB + Postgres-for-auth (still two DBs, just
swap which relational engine); a Mongo ODM (djongo/mongoengine) to keep one Django-ORM-shaped
codebase without leaving Mongo
Why we chose this: Django's ORM, migrations, `ModelSerializer`, admin, and `django.contrib.auth`
are all built assuming a relational store — the user directly identified this after building
and living with the MongoDB version ("django is extremely SQL-oriented"), and correctly read
that as a reason to reconsider, not just an annoyance to push through. The original MongoDB
decision (above) was deliberately about *learning that specific friction* — hand-writing
`pymongo` queries instead of using the ORM, tracking `owner_id` as a bare int instead of a real
foreign key, running two separate database connections/credentials. That friction was fully felt
(including two separate cloud-provider IP-allowlist incidents — Atlas, and this decision doesn't
remove that class of problem, just consolidates it to one provider). Once the lesson lands,
paying its ongoing cost forever stops being educational and just becomes overhead. A single
Postgres database is also the far more conventional, job-realistic Django setup — most real
Django codebases look like this, not like the MongoDB hybrid.
What actually changed: `notes` went from hand-rolled `pymongo` CRUD (`config/mongo.py`, manual
dict shaping in `notes/views.py`) to a real `Note` model (`notes/models.py`) with a genuine
`ForeignKey(User)`, a `ModelSerializer`, and Django's migration system generating
`notes/migrations/0001_initial.py`. `DATABASES` now points at Neon via `DATABASE_URL`
(`dj_database_url` + `psycopg`), required with no SQLite fallback — a missing env var fails
loudly (`KeyError`) rather than silently running against the wrong store. `db.sqlite3` and
`config/mongo.py` are deleted; `pymongo` dropped, `dj-database-url` + `psycopg[binary]` added.
Note IDs changed shape: Mongo `ObjectId` hex strings → plain Postgres integers (URL routing in
`notes/urls.py` changed from `<str:pk>` to `<int:pk>` accordingly). The authorization logic
(look up by id AND owner together, 404 either way so existence can't be probed) is unchanged —
same guarantee, now backed by a real FK instead of an unenforced int.
Tradeoffs: We deliberately walked away from the MongoDB-integration curriculum this project
originally specified — anyone reading only this file without the superseded entries above would
reasonably ask "why does the spec say MongoDB." The honest answer is in this entry: the lesson
was completed, then the project pivoted toward a more conventional, deployable shape. Also worth
naming: this consolidates two credential/IP-allowlist headaches into one (Neon), not zero — the
"cloud database needs your IP allowlisted" lesson from Atlas still applies here.
