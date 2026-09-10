# LEARNING.md — Django Unchained Learning Backlog

This file tracks concepts that were implemented before they were fully understood.

That is intentional.

Because development deadlines sometimes require moving quickly, the project follows:

```text
Build → Verify → Document → Learn Later
```

rather than requiring complete understanding before implementation.

The goal is to eventually understand the important parts of the entire system.

---

## How To Use This File

Each topic should contain:

- Where it appears in the project
- What it currently does
- Why it exists
- What I understand
- What I still need to learn
- Priority

Use these priorities:

```text
HIGH
MEDIUM
LOW
```

A topic can be marked:

```text
[ ] Not studied
[~] Partially understood
[x] Understood
```

---

## Backend

### Django Fundamentals

Status: `[ ]`

Learn:

- Django project vs app
- Settings
- URLs
- Views
- Models
- Migrations
- Middleware
- Request/response lifecycle
- Django application structure

Priority: HIGH

---

### Django ORM

Status: `[ ]`

Learn:

- Models
- QuerySets
- `filter()`
- `get()`
- `create()`
- `update()`
- `delete()`
- Relationships
- Generated SQL
- Lazy evaluation
- Transactions
- Indexes
- N+1 queries
- `select_related`
- `prefetch_related`

Priority: HIGH

---

### Django REST Framework

Status: `[ ]`

Learn:

- Serializers
- Views
- ViewSets
- Routers
- Permissions
- Authentication
- Request/response handling
- Validation
- HTTP status codes

Priority: HIGH

---

## Authentication & Security

### Session Authentication

Status: `[ ]`

Learn:

- Sessions
- Cookies
- HttpOnly
- SameSite
- Secure cookies
- Session lifecycle
- Why session authentication was selected over JWT

Priority: HIGH

---

### CSRF

Status: `[ ]`

Learn:

- What CSRF is
- Why it exists
- CSRF tokens
- Same-origin policy
- How Django protects against CSRF
- How frontend requests interact with CSRF protection

Priority: HIGH

---

### CORS

Status: `[ ]`

Learn:

- Same-origin policy
- CORS
- Preflight requests
- `Access-Control-Allow-Origin`
- Credentials
- Why CORS configuration matters

Priority: HIGH

---

### Authorization / IDOR

Status: `[ ]`

Learn:

- Authentication vs authorization
- Object-level permissions
- IDOR
- How an attacker could access another user's resource
- How the backend prevents it

Priority: HIGH

---

## PostgreSQL

### PostgreSQL Fundamentals

Status: `[ ]`

Learn:

- Tables
- Rows
- Columns
- Primary keys
- Foreign keys
- Constraints
- Indexes
- Transactions
- ACID

Priority: HIGH

---

### SQL

Status: `[ ]`

Learn:

- SELECT
- INSERT
- UPDATE
- DELETE
- JOIN
- GROUP BY
- ORDER BY
- Aggregation
- Subqueries

Priority: HIGH

---

### PostgreSQL + Django

Status: `[ ]`

Learn:

- Database connection
- Migrations
- ORM → SQL
- Connection pooling
- Transactions
- Query optimization

Priority: HIGH

---

## Frontend

### React

Status: `[ ]`

Learn:

- Components
- Props
- State
- Hooks
- `useEffect`
- Context
- Component lifecycle
- API calls
- Error handling

Priority: HIGH

---

### React ↔ Django

Status: `[ ]`

Learn:

```text
Browser
 ↓
React
 ↓
HTTP request
 ↓
Django URL
 ↓
DRF View
 ↓
Serializer
 ↓
ORM
 ↓
PostgreSQL
 ↓
Response
 ↓
React
```

Understand the complete request lifecycle.

Priority: HIGH

---

## Testing

### Unit Testing

Status: `[ ]`

Learn:

- What unit tests are
- What should be mocked
- Test isolation
- Assertions
- Fixtures

Priority: MEDIUM

---

### Integration Testing

Status: `[ ]`

Learn:

- Integration vs unit testing
- Database integration
- API integration
- Authentication flows

Priority: MEDIUM

---

## Security Testing

### Burp Suite

Status: `[ ]`

Learn:

- Proxy
- HTTP history
- Repeater
- Intruder
- Request modification
- Response analysis

Priority: HIGH

---

### Web Security Testing

Status: `[ ]`

Study:

- IDOR
- CSRF
- CORS
- Authentication weaknesses
- Session security
- Security headers
- Input validation
- Information disclosure
- Rate limiting

Priority: HIGH

---

## Performance

### Load Testing

Status: `[ ]`

Learn:

- Requests per second
- Concurrent users
- Latency
- Throughput
- Error rate
- Ramp-up
- Sustained load

Priority: HIGH

---

### Performance Analysis

Status: `[ ]`

Learn how to determine whether a bottleneck comes from:

```text
Frontend
Backend
Database
Network
CPU
Memory
I/O
```

Priority: HIGH

---

## Docker

### Docker Fundamentals

Status: `[ ]`

Learn:

- Images
- Containers
- Dockerfile
- Layers
- Ports
- Volumes
- Networks
- Environment variables

Priority: HIGH

---

### Docker Compose

Status: `[ ]`

Learn:

- Services
- Networks
- Volumes
- Dependencies
- Environment configuration
- Health checks

Priority: HIGH

---

## DevOps

### GitHub Actions

Status: `[ ]`

Learn:

- Workflow files
- Jobs
- Steps
- Runners
- Secrets
- CI
- CD
- Deployment pipelines

Priority: HIGH

---

### Nginx

Status: `[ ]`

Learn:

- Reverse proxy
- Static files
- Routing
- Headers
- TLS termination
- Why Nginx sits in front of the application

Priority: MEDIUM

---

## Observability

### Logging

Status: `[ ]`

Learn:

- Application logs
- Access logs
- Error logs
- Log levels
- Structured logging

Priority: MEDIUM

---

### Monitoring

Status: `[ ]`

Learn:

- Metrics
- Health checks
- Availability
- Performance monitoring
- Alerting

Priority: MEDIUM

---

## Architecture

### Full Request Lifecycle

Status: `[ ]`

Eventually trace a request from:

```text
Browser
 ↓
React
 ↓
HTTP
 ↓
Nginx
 ↓
Django
 ↓
DRF
 ↓
Authentication
 ↓
Authorization
 ↓
Serializer
 ↓
ORM
 ↓
PostgreSQL
 ↓
ORM
 ↓
Serializer
 ↓
HTTP Response
 ↓
React
 ↓
Browser
```

Priority: HIGH

---

## Final Goal

The ultimate goal is not simply:

> "The application works."

It is:

> **"I can explain how the entire application works, why it was designed this way, how it can fail, how it is secured, how it performs under load, and how it is deployed."**

Once this file is mostly complete, Django Unchained has served its purpose as a full-stack engineering laboratory.
