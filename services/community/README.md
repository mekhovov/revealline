# RevealLine community submission service

This separately packaged Node service implements the reviewable Phase 4 submission path. It does
not change the static game or its release version. It provides creator identity, resumable upload,
exact `.rlpack` validation, automatic publication, immutable downloads and previews, reports, and
owner/admin unlisting. Docker Compose is a development deployment fixture, not evidence of a
production launch.

## Local development

The service requires Node 20.19 or newer. Install and run its credential-free tests independently:

```sh
cd services/community
npm ci
npm test
npm run lint
npm run format:check
```

For the container development stack:

```sh
cd services/community
docker compose up --build
curl http://127.0.0.1:8787/health
```

Compose starts PostgreSQL 17, applies every numbered SQL migration in order, runs separate API and validation
worker processes, stores resumable tus uploads and content-addressed packages on named disk
volumes, and installs `ffprobe` for video validation. Its bearer token is explicitly
development-only. Copy
`.env.example` when running `npm start` directly. The server refuses to start the development token
adapter unless `COMMUNITY_ALLOW_DEV_AUTH=true`.

The Compose environment also forwards the documented production account variables. To exercise
production authentication, set `COMMUNITY_ALLOW_DEV_AUTH=false` and every uncommented Better Auth
and mail value in a private `.env`, start PostgreSQL and the numbered migration, then run the Better
Auth migration before the API:

```sh
docker compose up -d postgres migrate
docker compose run --rm api npm run auth:migrate
docker compose up -d api worker
```

This is still a single-host development fixture. It does not provide TLS or a mail gateway.

When running outside Compose, apply the checked-in migration to a disposable local database before
starting the API:

```sh
for file in migrations/*.sql; do
  psql "$COMMUNITY_DATABASE_URL" --set=ON_ERROR_STOP=1 --file="$file"
done
npm start
npm run worker
```

## HTTP contract

Public routes return JSON metadata or exact immutable package bytes:

- `GET /health`
- `GET /v1/catalog?limit=20&cursor=...`
- `GET /v1/catalog/:editionId`
- `GET /v1/catalog/:editionId/download`
- `GET /v1/catalog/:editionId/preview`
- `POST /v1/catalog/:editionId/reports` accepts a bounded public report.

Creator routes require the production Better Auth session cookie. The bearer form is available only
when the explicitly enabled development-token adapter is running:

- `POST /v1/submissions` declares `slug`, `title`, optional `description`, semantic `version`, exact
  `packageSha256`, and `packageSize`.
- `PUT /v1/submissions/:id/package` accepts `application/vnd.revealline.rlpack` or
  `application/octet-stream`. It verifies the declared byte length and SHA-256 before admitting the
  content-addressed blob.
- `GET /v1/submissions/:id` returns only the authenticated owner's submission.
- `POST /v1/submissions/:id/submit` creates or returns the same validation job for the same immutable
  submission, hash, and validator version.
- `POST /v1/publications/:editionId/unlist` lets its owner or an administrator remove a published
  edition from discovery and downloads without deleting its immutable record.

Better Auth owns the same-origin account endpoints under `/api/auth/*`. Production mode requires
email verification before sign-in and exposes its supported `send-verification-email`,
`request-password-reset`, reset callback, and `reset-password` routes. Successful password reset
revokes the account's other sessions. The game account panel supplies bounded same-origin callback
URLs, handles verification and reset returns, and never stores an account token in browser storage.

## Account verification and recovery mail

Production startup requires an HTTPS account-mail webhook and a separate 32–4096 character bearer
credential. Better Auth creates the verification or reset token; the service validates that its
action URL is HTTPS, at most 4096 characters, belongs to `BETTER_AUTH_URL`, and contains the exact
bounded token before delivery. Verification tokens default to one hour. Reset tokens default to 30
minutes, are capped at one hour by configuration, and revoke other sessions after use.

The webhook receives `POST` JSON with an `Authorization: Bearer ...` header:

```json
{
  "id": "sha256-idempotency-key",
  "kind": "verify-email",
  "to": "creator@example.test",
  "actionURL": "https://community.example.test/api/auth/verify-email?...",
  "expiresAt": "2026-09-25T01:00:00.000Z"
}
```

`kind` is `verify-email` or `reset-password`. The operator-selected gateway must render and send the
message, treat `id` as its idempotency key, accept only this authenticated HTTPS request, return a
2xx response after accepting responsibility for delivery, and avoid logging the action URL because
it contains a credential. The service uses a bounded timeout and returns a generic delivery error;
it does not expose the webhook credential or provider response to clients. Configure:

```sh
BETTER_AUTH_SECRET='at-least-32-random-characters'
BETTER_AUTH_URL='https://community.example.test'
BETTER_AUTH_TRUSTED_ORIGINS='https://game.example.test'
COMMUNITY_ACCOUNT_MAIL_WEBHOOK_URL='https://mail-gateway.example.test/revealline/account'
COMMUNITY_ACCOUNT_MAIL_WEBHOOK_TOKEN='a-separate-at-least-32-character-secret'
COMMUNITY_EMAIL_VERIFICATION_EXPIRES_SECONDS=3600
COMMUNITY_PASSWORD_RESET_EXPIRES_SECONDS=1800
COMMUNITY_ACCOUNT_MAIL_TIMEOUT_MS=5000
```

`BETTER_AUTH_URL` and every trusted origin must be an HTTPS origin without credentials, path,
query, or fragment. At most 16 trusted origins are accepted. Keep the game and API on one origin
for the built-in account client; the trusted-origin list supports an explicitly reviewed external
frontend. Run `npm run auth:migrate` with the same production configuration before starting the
API. The validation worker does not receive or parse Better Auth or mail credentials.
`MemoryAccountMailDelivery` is test-only and makes exact action messages observable without network
or a real mailbox.

Administrator sessions can operate the report queue without receiving the reporter's network
fingerprint:

- `GET /v1/admin/reports?status=open&limit=20&cursor=...` returns the oldest reports first.
- `POST /v1/admin/reports/:id/resolve` accepts a bounded plain-text `resolution`. Resolution is
  idempotent, retains the first decision, and writes an audit record.
- `POST /v1/admin/catalog/:editionId/unlist` remains the separate audited removal decision.

## Shared admission limits

Account/authentication POSTs, reports, submission declarations, and upload-byte reservations use
fixed PostgreSQL windows. The atomic upsert is shared by every API replica. Rejected requests return
HTTP 429 with both a `Retry-After` header and `error.retryAfterSeconds`. Subject and idempotency keys
are stored only as namespaced SHA-256 digests. Each admission removes at most 64 expired rows, so
cleanup work remains bounded under request load.

Defaults allow 30 account/auth attempts per five minutes for one network address, six reports per
hour for one network address, 12 submission declarations per hour for one account,
and 2 GiB of declared upload bytes per account per day. The corresponding variables are documented
in `.env.example`. A package upload reserves its full declared size before a direct write or tus
creation. Its immutable edition identity is the idempotency key, so interrupted tus resumes and
same-edition retries do not spend the quota twice.

`COMMUNITY_TRUST_PROXY_HOPS` is intentionally unset by default. Set it only to the exact count of
trusted proxies in front of the API; otherwise Fastify uses the direct peer address. These
application limits bound admitted work across replicas. The edge proxy still needs connection and
request-rate controls for traffic that never reaches a valid HTTP request.

Published catalog records include a deterministic `collectionId` plus the latest published edition
identity and version for that owner-and-slug collection. Clients use those immutable identifiers for
update discovery; display titles and shared slugs across different owners never merge collections.

`POST /v1/submissions` returns a tus creation endpoint and immutable upload metadata. The mounted
official `@tus/server` and `@tus/file-store` implementation checks the authenticated owner on create,
HEAD, PATCH, and completion. Completion rechecks size, SHA-256, edition, and submission identity
before copying bytes to the content-addressed package store. The test suite interrupts a PATCH,
reads the retained offset, resumes it, and proves another owner cannot inspect the upload.

Every executable API replica uses PostgreSQL advisory locks for tus resources. A dedicated bounded
connection pool keeps upload lock waits from consuming the repository pool. A contender sends a
PostgreSQL notification asking the current request to drain, then waits for the same shared lock;
acquisition is bounded by `COMMUNITY_TUS_LOCK_TIMEOUT_SECONDS`. All replicas therefore serialize
HEAD, PATCH, DELETE, completion, and expiry removal for the same upload even when requests land on
different API processes.

Incomplete uploads expire from their creation time after `COMMUNITY_TUS_EXPIRATION_SECONDS` (24
hours by default). Each API periodically claims at most `COMMUNITY_TUS_CLEANUP_BATCH_SIZE` expired
registry rows with `FOR UPDATE SKIP LOCKED`, records a cleanup lease, acquires the upload's shared
lock, and removes it through the configured tus datastore. Failed removals are released for a later
bounded retry; a crashed cleaner's lease can be reclaimed. The registry and lock layer are store
independent, so an injected S3 tus datastore uses the same coordination boundary. Compose still
mounts the filesystem datastore and requires shared storage if the API is scaled on one host.

Titles and descriptions are length-bounded Unicode text. The API never interprets or emits them as
HTML. Catalog clients must render these fields with text nodes (`textContent`), not HTML insertion.
Control characters are rejected. Slugs and versions use restricted filename-safe forms.

An edition identity covers owner, slug, version, and exact package hash. The database also prevents
an owner from assigning one slug/version pair to different bytes. Published downloads use immutable
cache headers and are resolved only from published rows. Draft, queued, rejected, and another
creator's records never appear in the catalog.

## Validation worker contract

`processNextValidationJob` in `src/worker.mjs` claims one job with the repository's PostgreSQL
`FOR UPDATE SKIP LOCKED` lease, opens the exact staged blob, and calls an injected validator. A valid
result is `{ accepted, report, rejectionCode? }`. Acceptance changes the submission to `published`;
content rejection changes it to `rejected`; infrastructure errors release the job for a delayed
retry. Reports are capped at 64 KiB.

Claims expire after five minutes by default. Another worker can reclaim an expired job, and the old
worker can no longer commit because completion checks its worker identity. Worker IDs must be unique
per process. Long-running validators will need a future lease-renewal method before their timeout is
raised above the bounded validation target.

`src/validator.mjs` uses the game's own `importCreatorBundle` path. It rechecks package SHA-256 and
length, parses `revealline-content-bundle.v1`, verifies its inventory and compatibility, decodes PNG
payloads with CRC checking, compiles every included mission, and reruns the template route evidence.
Video packages are decoded and measured with self-hosted `ffprobe`; a missing `ffprobe` is an
infrastructure retry, while invalid media is a content rejection. `src/worker-runner.mjs` executes
this validator against the leased PostgreSQL queue. Acceptance publishes the exact staged bytes;
the worker never trusts an uploaded approval flag.

## Adapter boundaries

- **Authentication:** production configuration creates a real Better Auth PostgreSQL instance,
  mounts `/api/auth/*`, requires verified email, supports password recovery, and resolves ownership
  from `auth.api.getSession`. An injected HTTPS webhook is the mail-delivery boundary; the provider
  remains an operator choice. Run `npm run auth:migrate` before starting production mode. The test
  suite creates a real Better Auth account using its official memory adapter, completes verification
  and password reset through the local mail adapter, and proves that the resulting session owns the
  submission. The constant-token adapter remains available only behind
  `COMMUNITY_ALLOW_DEV_AUTH=true`.
- **Blobs:** `DiskBlobStore` is runnable locally. `S3CompatibleBlobStore` accepts an injected S3
  client plus `put`, `head`, and `get` command factories, avoiding a second SDK choice in this
  scaffold. Production S3 wiring must stage and verify bytes before immutable upload, set private
  bucket policy, and rehearse database/blob restore.
- **Uploads:** the executable server mounts the maintained tus Node server with its disk store.
  `completeTusUpload` is the verified completion boundary that can also admit an S3-backed tus
  stream. PostgreSQL advisory locks coordinate API replicas, and the PostgreSQL upload registry
  leases bounded expiry work across them. The executable datastore remains disk-backed; multi-host
  deployment must inject a shared datastore such as S3 rather than a node-local filesystem.
- **Repository:** both PostgreSQL and in-memory test implementations use the same submission/job
  and admission methods. Production admission uses PostgreSQL database time, atomic conditional
  upserts, and transaction advisory locks for idempotent reservations. The memory implementation
  supports deterministic API and worker tests; it is never used by the executable server.

## Offline backup and restore

The recovery command binds one PostgreSQL custom-format dump to an exact, sorted inventory of every
content-addressed package blob. The manifest hashes the database dump and each package, rejects
symbolic links and unexpected files, and has its own deterministic snapshot identity. Restore
verifies the complete snapshot before running `pg_restore`, stages package files outside the live
root, and publishes that root only after the database command succeeds. A bounded restore journal
records the snapshot, target, staging path, and last completed boundary. Rerunning the exact restore
reuses verified staged blobs, retries an interrupted database restore, or finishes blob publication
when the database restore had already completed.

Stop both writers before backup or restore. This is an intentionally offline contract: keeping the
API or worker active could create a database/blob boundary that no filesystem copy can make atomic.
On a direct installation, with PostgreSQL client tools on `PATH`:

```sh
cd services/community
export COMMUNITY_DATABASE_URL=postgres://revealline:secret@database/revealline
export COMMUNITY_BLOB_ROOT=/srv/revealline/blobs
npm run recovery -- backup --directory /srv/revealline/backups/2026-09-25
npm run recovery -- verify --directory /srv/revealline/backups/2026-09-25
```

Restore only into the intended database and an absent or empty blob root:

```sh
npm run recovery -- restore --directory /srv/revealline/backups/2026-09-25
```

`pg_restore --clean --if-exists` replaces the community schema represented by the dump, so verify
the target URL before running it. Keep the snapshot outside the blob root and copy it off-host. The
Compose image includes the PostgreSQL 17 client and mounts `/data/recovery` on its own named volume;
an operator can run:

```sh
docker compose stop api worker
docker compose run --rm api npm run recovery -- backup --directory /data/recovery/snapshot-1
docker compose run --rm api npm run recovery -- verify --directory /data/recovery/snapshot-1
docker compose start api worker
```

Copy the verified snapshot to independent storage. A restore uses the same stopped-writer sequence
and replaces `backup` with `restore`. The source tests rehearse exact backup, verification,
successful restore, changed-byte rejection, occupied-target refusal, database-command failure, and
journal-backed retry.

## Limits and operational work still required

The default package ceiling is 256 MiB and catalog pages are capped at 50 entries. A reverse proxy
still needs request timeouts, connection limits, and HTTPS. Public deployment also requires a
live administrator-session rehearsal of the shipped report triage UI, stronger process/container
isolation for media validation, malware policy, metrics, an off-host backup schedule, a real
PostgreSQL/blob restore rehearsal, and an explicit infrastructure decision. The S3 adapter is tested
at its byte boundary but is not wired into the executable deployment. No AWS, mail provider,
domain, or production restore claim is made here. Email verification and password recovery are
integrated at the application boundary, but public launch still requires an operator-selected mail
gateway, sender-domain authentication, templates, deliverability monitoring, abuse handling, and a
live mailbox acceptance rehearsal. Broader account administration remains future operational work.
