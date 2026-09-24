# Phase 4 community submission acceptance

Status: **reviewable service delivery; production deployment remains open**.

This phase adds the separately deployed service in `services/community`. It uses Fastify,
PostgreSQL, Better Auth, the maintained tus Node server and disk-backed resumable uploads. The
validation worker imports the exact game `revealline-content-bundle.v1` implementation instead of
maintaining a second permissive package parser.

## Automated acceptance

The service suite covers:

- a real Better Auth signup/session owning a creator submission;
- two-user submission isolation;
- official tus POST, interrupted PATCH, retained HEAD offset, resumed PATCH, ownership rejection,
  and exact completed-byte admission;
- SHA-256 and size mismatch rejection before queueing;
- an actual generated `.rlpack` decoded, compiled and replayed through the production validator;
- exact immutable download and bounded poster preview bytes;
- idempotent queueing, restart-safe expired leases and stale-worker commit rejection;
- catalog cursor/search behavior, anonymous report deduplication, owner/admin unlisting and removal
  from public discovery;
- disk blob cleanup after failed writes and the explicit S3 command boundary.

Run it with:

```sh
cd services/community
npm ci
npm test
npm run lint
npm run format:check
```

The maintained tus package is used as documented in its
[Fastify integration](https://github.com/tus/tus-node-server/blob/main/packages/server/README.md),
including authenticated create/incoming/finish hooks. Better Auth uses its documented
[PostgreSQL adapter](https://better-auth.com/docs/adapters/postgresql) and server-side session API.

## Deployment boundary

Docker Compose is the local single-server shape: one PostgreSQL database, one API process, one
worker, and named volumes for tus staging and immutable packages. `ffprobe` is installed in the
service image for video packages. Production Better Auth requires a 32+ character secret, public
base URL, trusted origins, its migration command, and deliberate mail/recovery configuration.

The phase is not accepted as a production launch until an operator selects infrastructure and
passes a two-user browser run, interrupted upload through the deployed proxy, corrupt-package
rejection, process restart while a job is leased, database/blob backup and restore, and automatic
catalog listing from restored state. A multi-API deployment also needs a shared tus locker and
incomplete-upload expiration. Rate limits, report triage, stronger media-worker isolation,
monitoring, production S3 wiring, domain, TLS and mail remain deployment work. No AWS or restore
rehearsal is claimed by this source delivery.
