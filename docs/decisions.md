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

### Decision: MongoDB as the database
Alternatives: PostgreSQL, MySQL/SQLite
Why we chose this: Given as the project's database. It's a deliberate deviation from Django's
"native" relational assumption, specifically so we learn how Django/DRF integrate with a
non-relational database and what that costs.
Tradeoffs: Django's ORM does not speak MongoDB natively — an additional library (an ODM, or the
raw `pymongo` driver) is required, and we lose things a relational DB + Django ORM give for free:
migrations in the Django sense, `ForeignKey`/joins, and some of Django's admin/auth integration
that assumes `django.contrib.auth`'s relational User model. This will be spelled out concretely
in Phase 1.5 before writing any database code, including the exact library chosen and why.

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

### Decision: MongoDB reached via raw pymongo, not an ODM, with Django's own auth/sessions on SQLite
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

### Decision: JavaScript (not TypeScript) for the frontend
Alternatives: TypeScript
Why we chose this: Given the speedrun's time constraint and that this stack (React notes CRUD)
is already familiar territory from a prior MERN project, plain JS kept the build fast with zero
type-plumbing overhead. TypeScript's real value here is compile-time safety on the shape of API
responses/props — genuinely worth having on a bigger or longer-lived codebase.
Tradeoffs: No compile-time guarantee the frontend and `NoteSerializer`/`UserSerializer` stay in
sync — a backend field rename would only surface as a runtime `undefined`, not a build error.
Worth revisiting if this project grows past the current small page count.
