# Django Unchained — Full-Stack Engineering Lab

**Django Unchained** is a small full-stack Notes application built as a hands-on engineering lab.

It covers the lifecycle of a realistic web application:

```text
Build
  ↓
Test
  ↓
Secure
  ↓
Load Test
  ↓
Containerize
  ↓
Automate
  ↓
Deploy
  ↓
Monitor
  ↓
Learn / Revisit
```

The project is being built with **React + Django REST Framework + PostgreSQL**, with security, performance, Docker, CI/CD, deployment, and monitoring explored around the application.

> **Important:** This project is both a development project and a learning project. Due to time constraints, some implementation is being completed quickly first. Those concepts are tracked for deeper learning afterward.

See `CLAUDE.md` for the working rules and `PROGRESS.md` for implementation progress.

See `LEARNING.md` for concepts that still need deeper study.

---

## Project Overview

The application is a private Notes application where users can:

- Register
- Log in
- Create notes
- Read their notes
- Update notes
- Delete notes
- Access only their own data

The Notes application itself is intentionally simple.

The real purpose of the project is to use a small but realistic application to explore full-stack engineering.

---

## Engineering Areas

The project covers:

### 1. Application Engineering

- Git
- React
- Vite
- Django
- Django REST Framework
- PostgreSQL
- REST APIs
- Authentication
- Authorization
- CRUD
- Database modeling

### 2. Automated Testing

- Unit testing
- Integration testing
- API testing
- Authentication testing
- Authorization testing

### 3. Security Engineering

- HTTP fundamentals
- Authentication security
- Authorization
- IDOR
- CSRF
- CORS
- Security headers
- Session security
- Input validation
- API security
- Manual testing with Burp Suite

### 4. Performance Engineering

- Baseline performance
- Load testing
- Stress testing
- Concurrency
- Latency
- Throughput
- Error rates
- Database performance

Tools may include:

- Locust
- k6
- JMeter

Some tools may be deferred if their setup is disproportionately large compared with the learning value at the current stage.

### 5. Containerization

- Docker
- Docker Compose
- Container networking
- Environment configuration
- Health checks
- Production-style containers

### 6. DevOps

- Git workflows
- GitHub Actions
- CI
- CD
- Environment management
- Deployment

### 7. Production Engineering

- Nginx
- Reverse proxying
- Logging
- Monitoring
- Reliability
- Failure handling

---

## Architecture

Current target architecture:

```text
                    ┌─────────────────┐
                    │      User       │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ React + Vite    │
                    │   Frontend      │
                    └────────┬────────┘
                             │ HTTP
                             ▼
                    ┌─────────────────┐
                    │ Django + DRF    │
                    │   REST API      │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   PostgreSQL    │
                    │      Neon       │
                    └─────────────────┘
```

Production-oriented architecture will additionally introduce:

```text
Internet
   │
   ▼
 Nginx
   │
   ▼
 React / Django
   │
   ▼
PostgreSQL
```

The detailed architecture is documented in:

`docs/architecture.md`

---

## Tech Stack

| Layer             | Technology                       |
| ----------------- | -------------------------------- |
| Frontend          | React + Vite                     |
| Frontend Language | JavaScript                       |
| Backend           | Python + Django                  |
| API               | Django REST Framework            |
| Database          | PostgreSQL                       |
| Database Hosting  | Neon                             |
| Authentication    | Session Cookie + HttpOnly + CSRF |
| Containers        | Docker + Docker Compose          |
| CI/CD             | GitHub Actions                   |
| Reverse Proxy     | Nginx                            |
| Security Testing  | Burp Suite                       |
| Load Testing      | Locust / k6 / JMeter             |

Architectural reasoning is documented in:

`docs/decisions.md`

---

## Current Development Philosophy

Originally, the project was intended to follow a strict:

```text
Learn → Implement → Test
```

workflow.

Because of development deadlines, the workflow has evolved into:

```text
Implement → Verify → Document → Learn Deeply Later
```

This is intentional.

The project therefore distinguishes between:

### Implementation Status

What has actually been built and verified.

### Learning Status

What the developer can currently explain and understand deeply.

A feature can therefore be:

```text
Implemented: YES
Verified: YES
Deeply Understood: NOT YET
```

That is acceptable.

The goal is to eventually close that learning gap.

---

## Documentation

| File                   | Purpose                              |
| ---------------------- | ------------------------------------ |
| `README.md`            | Project overview                     |
| `CLAUDE.md`            | AI/project working rules             |
| `PROGRESS.md`          | Implementation progress              |
| `LEARNING.md`          | Concepts to revisit and learn        |
| `docs/architecture.md` | System architecture                  |
| `docs/decisions.md`    | Architectural decisions              |
| `docs/security.md`     | Security findings                    |
| `docs/performance.md`  | Performance testing                  |
| `docs/`                | Additional engineering documentation |

---

## Testing

Testing is treated as an engineering activity rather than simply checking whether buttons work.

The project explores:

```text
Functional correctness
        ↓
Security
        ↓
Performance
        ↓
Scalability
        ↓
Reliability
        ↓
Failure recovery
```

Actual testing results and evidence are stored in the project's testing documentation and result artifacts.

Tests that cannot reasonably be performed during the current development window are marked as:

```text
DEFERRED
```

rather than being falsely presented as completed.

---

## Security

Security testing focuses on understanding how a real web application can fail.

Areas include:

- Authentication
- Authorization
- IDOR
- CSRF
- CORS
- Session management
- Security headers
- Input validation
- API security
- Information disclosure

Manual testing may be performed using Burp Suite against the authorized development/test environment.

Security findings are documented in:

`docs/security.md`

---

## Performance

Performance testing focuses on understanding how the application behaves as load increases.

The general approach is:

```text
Baseline
   ↓
Normal Load
   ↓
Higher Load
   ↓
Stress
   ↓
Observe Bottleneck
   ↓
Optimize
   ↓
Retest
```

Results are documented in:

`docs/performance.md`

---

## Docker & DevOps

The application will eventually be containerized using Docker and Docker Compose.

The DevOps portion explores:

- Reproducible environments
- Containers
- Networking
- Environment variables
- CI
- CD
- Reverse proxies
- Deployment
- Logging
- Monitoring

---

## Learning After Implementation

One of the important goals of this project is to eventually understand **why everything works**, not merely have working code.

Topics that were implemented quickly are tracked in:

`LEARNING.md`

The intended future workflow is:

```text
Finished Application
        ↓
Read Architecture
        ↓
Trace Request Flow
        ↓
Understand Database Flow
        ↓
Understand Authentication
        ↓
Understand Security
        ↓
Understand Performance
        ↓
Understand Docker
        ↓
Understand CI/CD
        ↓
Understand Deployment
```

This turns the completed application into a personal full-stack engineering laboratory.

---

## Status

The project is actively being developed.

For the actual implementation status, see:

`PROGRESS.md`

For unresolved learning topics, see:

`LEARNING.md`
