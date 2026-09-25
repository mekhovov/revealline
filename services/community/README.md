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

Compose starts PostgreSQL 17, applies `migrations/001_initial.sql`, runs separate API and validation
worker processes, stores resumable tus uploads and content-addressed packages on named disk
volumes, and installs `ffprobe` for video validation. Its bearer token is explicitly
development-only. Copy
`.env.example` when running `npm start` directly. The server refuses to start the development token
adapter unless `COMMUNITY_ALLOW_DEV_AUTH=true`.

When running outside Compose, apply the checked-in migration to a disposable local database before
starting the API:

```sh
psql "$COMMUNITY_DATABASE_URL" --set=ON_ERROR_STOP=1 --file=migrations/001_initial.sql
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

Published catalog records include a deterministic `collectionId` plus the latest published edition
identity and version for that owner-and-slug collection. Clients use those immutable identifiers for
update discovery; display titles and shared slugs across different owners never merge collections.

`POST /v1/submissions` returns a tus creation endpoint and immutable upload metadata. The mounted
official `@tus/server` and `@tus/file-store` implementation checks the authenticated owner on create,
HEAD, PATCH, and completion. Completion rechecks size, SHA-256, edition, and submission identity
before copying bytes to the content-addressed package store. The test suite interrupts a PATCH,
reads the retained offset, resumes it, and proves another owner cannot inspect the upload.

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
  mounts `/api/auth/*`, and resolves ownership from `auth.api.getSession`. Run
  `npm run auth:migrate` before starting production mode. The test suite creates a real Better Auth
  account/session using its official memory adapter and proves that session owns the submission.
  The constant-token adapter remains available only behind `COMMUNITY_ALLOW_DEV_AUTH=true`.
- **Blobs:** `DiskBlobStore` is runnable locally. `S3CompatibleBlobStore` accepts an injected S3
  client plus `put`, `head`, and `get` command factories, avoiding a second SDK choice in this
  scaffold. Production S3 wiring must stage and verify bytes before immutable upload, set private
  bucket policy, and rehearse database/blob restore.
- **Uploads:** the executable server mounts the maintained tus Node server with its disk store.
  `completeTusUpload` is the verified completion boundary that can also admit an S3-backed tus
  stream. A multi-API deployment still needs a shared tus locker and an incomplete-upload expiry
  policy; the current in-memory lock is correct for the single API container in Compose.
- **Repository:** both PostgreSQL and in-memory test implementations use the same submission/job
  methods. The memory implementation supports deterministic API and worker tests; it is never used
  by the executable server.

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
still needs request timeouts, connection limits, HTTPS, and distributed rate limits. Public deployment also
requires production Better Auth secrets, mail/account recovery choices, report triage UI, a shared
tus locker for multiple API replicas, incomplete-upload cleanup, stronger process/container
isolation for media validation, malware policy, metrics, an off-host backup schedule, a real
PostgreSQL/blob restore rehearsal, and an explicit infrastructure decision. The S3 adapter is tested
at its byte boundary but is not wired into the executable deployment. No AWS, mail, domain, or
production restore claim is made here.

Email/password registration currently confirms an address syntactically and creates the session;
mail delivery, email verification, password reset, account recovery, abuse throttles, and account
administration need production policy and infrastructure before public launch. The browser account
form intentionally does not promise those capabilities.
