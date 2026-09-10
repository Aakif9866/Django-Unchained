# Architecture

## High-Level Request Flow

```
User
 ↓
React (Vite dev server / built static assets)
 ↓
HTTP / REST API (JSON over HTTP)
 ↓
Django
 ↓
Django REST Framework (serialization, views, permissions)
 ↓
MongoDB (via an ODM — library choice explained in docs/decisions.md)
```

### What each layer does

- **React** — renders the UI in the browser, holds client-side state (e.g.
  "is the user logged in", "what notes are loaded"), and makes HTTP
  requests to the Django API. It does not talk to MongoDB directly — ever.
- **REST API** — the contract between frontend and backend: a set of URLs
  (`/api/notes/`, `/api/auth/login/`, ...) that accept/return JSON and use
  HTTP methods (GET/POST/PUT/PATCH/DELETE) to mean specific things.
- **Django** — the web framework: routes incoming HTTP requests (via
  `urls.py`) to Python functions/classes (views), and returns HTTP
  responses. Also owns settings, middleware (code that runs on every
  request/response), and (normally) the ORM — though here MongoDB replaces
  the relational ORM, which is a deliberate deviation covered in
  `docs/decisions.md`.
- **Django REST Framework (DRF)** — a layer on top of Django specifically
  for building APIs: serializers (convert between Python objects and
  JSON, with validation), API views/viewsets, authentication classes,
  permission classes.
- **MongoDB** — a document database. Stores users' notes as JSON-like
  documents rather than rows in tables. No foreign keys, no joins — data
  modeling works differently than in a relational database like
  PostgreSQL, which matters for how we structure notes and authorization.

## Request Lifecycle Examples

_These will be filled in with real detail once each piece exists — for now,
conceptually:_

### User opens the application
```
Browser requests React app
 ↓
Vite serves index.html + JS bundle
 ↓
React checks: is there a valid session/token?
 ↓
If yes → fetch current user + notes
If no  → show login/register screen
```

### User registers
```
React form submit
 ↓
POST /api/auth/register/  { username, password }
 ↓
DRF serializer validates input
 ↓
Django hashes the password (never stored in plain text)
 ↓
User document created in MongoDB
 ↓
Response: success (or validation errors)
```

### User logs in
```
POST /api/auth/login/  { username, password }
 ↓
Django checks credentials against stored password hash
 ↓
On success: issue session cookie or token (mechanism TBD — Phase 1.7)
 ↓
Frontend stores/relies on that credential for future requests
```

### User creates a note
```
POST /api/notes/  { title, content }  (with auth credential attached)
 ↓
DRF permission check: is this request authenticated?
 ↓
Serializer validates title/content
 ↓
Note document created in MongoDB, tagged with the owning user's id
 ↓
Response: the created note (with its id)
```

### User retrieves notes
```
GET /api/notes/  (with auth credential attached)
 ↓
DRF permission check: authenticated?
 ↓
Query MongoDB for notes WHERE owner == current user
 ↓
Response: list of the user's notes only
```

This last step is where **authorization** (as opposed to authentication)
matters: being logged in only proves who you are, not what you're allowed
to see. `GET /api/notes/123` must check that note 123 belongs to the
requesting user before returning it — otherwise it's an IDOR vulnerability,
which we intentionally test for in Phase 2.

### User logs out
```
POST /api/auth/logout/
 ↓
Server invalidates the session / client discards the token
 ↓
Frontend clears local state, redirects to login
```

## Authentication Flow

Session-cookie based (see `docs/decisions.md` for why over JWT).

```
Browser loads React app
 ↓
GET /api/auth/csrf/  → Django sets a `csrftoken` cookie (readable by JS —
                        it's not the secret, it's the anti-forgery proof)
 ↓
POST /api/auth/login/  { username, password }, header X-CSRFToken: <cookie value>
 ↓
Django's CsrfViewMiddleware checks the header matches the cookie
 ↓
authenticate() checks the password hash, login() creates a session row +
 sets `sessionid` cookie — HttpOnly, unreadable by JS (XSS can't steal it)
 ↓
Every later request: browser auto-attaches `sessionid` (credentials:'include'
 in fetch) + we manually attach X-CSRFToken on unsafe methods
 ↓
DRF's SessionAuthentication resolves `sessionid` → request.user on every view
```

Why both a session cookie *and* a CSRF token: the session cookie alone would
let any site the user has open silently ride their session (classic CSRF) —
a `<form>` on an attacker's page can make the browser send the cookie
automatically, but it can't read/forge the CSRF header without already
having JS access to this origin (which is what SameSite + CORS also guard).

## Database Flow

Two databases, deliberately:

```
django.contrib.auth (User, Session, admin)  →  SQLite (Django's own ORM)
notes (title, content, owner_id)            →  MongoDB, via pymongo directly
                                                 (config/mongo.py, notes/views.py)
```

A note document looks like:
```json
{
  "_id": ObjectId("..."),
  "owner_id": 1,
  "title": "First note",
  "content": "hello mongo",
  "created_at": "2026-...",
  "updated_at": "2026-..."
}
```

`owner_id` is Django's numeric `User.id` — the link between the two
databases is just that plain integer, not a real foreign key (MongoDB
doesn't enforce referential integrity across collections, let alone across
a different database entirely). Every notes query filters by
`owner_id: request.user.id` — that filter *is* the authorization check.

## Docker Architecture

_Filled in during Phase 3.4–3.5._

## Deployment Architecture

_Filled in during Phase 3.6–3.8._
