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

### Decision: Authentication mechanism
Status: **Not yet decided.** Per the project rules, this is chosen in Phase 1.7 only after
session auth, JWT, cookies, localStorage, HttpOnly, CSRF, CORS, and expiration are explained —
not chosen upfront.
