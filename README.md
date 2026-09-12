# TensorHub

TensorHub is a responsive event-discovery and technical-community application. It includes public, paginated event discovery with external registration links; member accounts with secure password hashes and opaque server-side sessions; Technical Team/Admin event and challenge management APIs; and a coding-test submission contract that queues source for an isolated worker without executing it in the web process.

## Run locally

Requires Node.js 20+. Copy `.env.example` to `.env`, install dependencies, and start:

```sh
npm install
npm start
```

The app listens on `0.0.0.0` (not only localhost) and uses `PORT` (default `3000`). The first registered account is a normal `MEMBER`. Provision the Technical Team account through deployment secrets, never source control:

```sh
TECHNICAL_TEAM_EMAIL=team@example.com
TECHNICAL_TEAM_PASSWORD='<unique-password>'
```

On startup these variables create or promote that email to `TECHNICAL_TEAM`. The password is hashed with bcrypt and is never logged. Change it through your secret manager and restart the service. The browser exposes a restricted Technical Team console only after `/api/auth/me` confirms the role; server-side role checks remain authoritative.

## Internet-public production deployment

Use a managed Linux container host (Azure Container Apps, App Service, Fly.io, Render, or equivalent) behind its public HTTPS ingress. Build the image or deploy the Node service with `npm ci --omit=dev && npm start`, set `PORT` from the platform, and configure a custom domain with the platform's managed TLS certificate. Point the domain's DNS `A`/`CNAME` record to the platform ingress; do not expose SQLite files or the container directly to the internet.

Set `NODE_ENV=production`, a random `SESSION_SECRET` of at least 32 characters (retained across restarts), `APP_ORIGIN` to the HTTPS domain, and `TRUST_PROXY=1` only when the platform terminates TLS. Enforce HTTPS redirects at the ingress, restrict CORS to `APP_ORIGIN` if a separate frontend is introduced, configure backups, and use platform health checks against `/api/health`. Mutating API requests are same-origin protected and session cookies are HTTP-only, SameSite, and Secure in production.

SQLite with WAL is suitable for a single instance and modest write volume. For approximately 1,000 concurrent users, keep the stateless web process horizontally scalable but migrate the database to PostgreSQL (including sessions) before running multiple replicas; add a managed Redis cache/rate-limit store, CDN-cache public event GETs briefly, and use a queue-backed isolated worker for submissions. Add database connection pooling, monitoring, autoscaling on CPU/latency, and load-test the chosen SKU. The current repository does not provision cloud resources, DNS, TLS, PostgreSQL, Redis, or the untrusted-code worker, so deployment is not claimed complete.

## Coding worker boundary

`POST /api/challenges/:id/submissions` validates and stores source with `QUEUED` status. A separate worker must claim jobs, run them in disposable network-disabled containers or a sandbox with strict CPU/memory/time limits, write only `PASSED`/`FAILED`/`ERROR` status, and never share the web process or its filesystem. No endpoint in this repository executes submitted code.

## Operations and account modules

The server includes administrator-protected user/role management, moderation reports for events and challenges, append-only audit records for authentication and management actions, in-app notification records, and password-reset token contracts. Password reset requests intentionally return a development-only token when `NODE_ENV` is not `production`; production must connect this endpoint to a transactional email provider and must never expose tokens in HTTP responses. Email verification and MFA require an external identity/email service or an additional approved provider configuration and are not falsely marked as complete.

All mutating API routes require a same-origin `Origin`/`Referer` check, authenticated management routes enforce roles server-side, password-reset tokens are hashed and expire after 30 minutes, and changing a password invalidates existing sessions. The supplied Technical Team password is not present in this repository; rotate it before use.

## Checks

```sh
npm test
npm run lint
```

The end-to-end suite starts a real HTTP server against an isolated database and covers signup, login/session use,
event discovery, concurrent student registrations, duplicate-registration protection, ticket retrieval, admin
check-in/check-out scanning, and filtered CSV export.
