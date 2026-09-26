# Phase 4 community submission acceptance

Status: **service source published in `v0.141.0` and hardened in `v0.141.2`; production deployment
remains open**.

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
- PostgreSQL-backed fixed-window admission for authentication, reports, submissions and upload
  bytes, including replica-shared atomic counters, immutable retry reservations and exact
  `Retry-After` responses;
- bounded, privacy-preserving administrator report queues with idempotent audited resolution;
- atomic PostgreSQL report deduplication under concurrent identical requests;
- disk blob cleanup after failed writes, same-size corruption repair, exact download-time SHA-256
  authentication, and the explicit S3 command boundary;
- an offline recovery snapshot with a PostgreSQL dump, sorted content-addressed blob inventory,
  exact hashes, pre-restore verification, occupied-target refusal and staged blob publication after
  the database restore succeeds. A restore journal resumes the exact snapshot across interruption
  without claiming cross-store atomicity.

Run it with:

```sh
cd services/community
npm ci
npm test
npm run lint
npm run format:check
```

The `v0.141.0` baseline passed **43/43** community-service checks. The published `v0.141.2`
exact-head local aggregate passes **556/556**, including the direct **63/63** community-service
suite. Qualification run `36250777506` used the explicit automated-suite waiver, so it has no
hosted test total; skipped checks are not counted as passes.

The maintained tus package is used as documented in its
[Fastify integration](https://github.com/tus/tus-node-server/blob/main/packages/server/README.md),
including authenticated create/incoming/finish hooks. Better Auth uses its documented
[PostgreSQL adapter](https://better-auth.com/docs/adapters/postgresql) and server-side session API.

## Deployment boundary

Docker Compose is the local single-server shape: one PostgreSQL database, one API process, one
worker, and named volumes for tus staging and immutable packages. `ffprobe` is installed in the
service image for video packages. Production Better Auth requires a 32+ character secret, public
base URL, trusted origins, its migration command, and deliberate mail/recovery configuration.

Source now includes `npm run recovery -- backup|verify|restore --directory <path>` and focused
failure rehearsal. This is executable recovery tooling, not evidence that a production database or
remote blob store has been restored.

The production Compose/preflight contract, exact interrupted-tus fault proxy, source-to-target
recovery rehearsal and bounded deployed two-user runner shipped in `v0.141.2`. Publication evidence
is recorded in [v0.141.2-publication-evidence.md](v0.141.2-publication-evidence.md); publication does
not replace the live infrastructure gates below.

The phase is not accepted as a production launch until an operator selects infrastructure and
passes a two-user browser run, interrupted upload through the deployed proxy, corrupt-package
rejection, process restart while a job is leased, database/blob backup and restore, and automatic
catalog listing from restored state. A multi-API deployment also needs a shared tus locker and
incomplete-upload expiration. Edge timeouts and connection controls, exact trusted-proxy
deployment, stronger media-worker isolation, monitoring, production S3 wiring, domain, TLS and
mail/account recovery remain deployment work. No AWS or live PostgreSQL restore rehearsal is
claimed by this source delivery.
