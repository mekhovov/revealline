# RevealLine community service scaffold

This separately packaged Node service is the bounded Phase 4 foundation for community submissions.
It does not change the static game or its release version. The current executable development path
provides submission metadata, verified one-shot package upload, a PostgreSQL validation queue, and a
read-only public catalog. It is not a production deployment and cannot publish content until a real
`.rlpack` compiler/replay validator calls the worker contract.

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

Compose starts PostgreSQL 17, applies `migrations/001_initial.sql`, and stores content-addressed
package bytes on a named disk volume. Its bearer token is explicitly development-only. Copy
`.env.example` when running `npm start` directly. The server refuses to start the development token
adapter unless `COMMUNITY_ALLOW_DEV_AUTH=true`.

When running outside Compose, apply the checked-in migration to a disposable local database before
starting the API:

```sh
psql "$COMMUNITY_DATABASE_URL" --set=ON_ERROR_STOP=1 --file=migrations/001_initial.sql
npm start
```

## HTTP contract

Public routes return JSON metadata or exact immutable package bytes:

- `GET /health`
- `GET /v1/catalog?limit=20&cursor=...`
- `GET /v1/catalog/:editionId`
- `GET /v1/catalog/:editionId/download`

Creator routes require `Authorization: Bearer <token>`:

- `POST /v1/submissions` declares `slug`, `title`, optional `description`, semantic `version`, exact
  `packageSha256`, and `packageSize`.
- `PUT /v1/submissions/:id/package` accepts `application/vnd.revealline.rlpack` or
  `application/octet-stream`. It verifies the declared byte length and SHA-256 before admitting the
  content-addressed blob.
- `GET /v1/submissions/:id` returns only the authenticated owner's submission.
- `POST /v1/submissions/:id/submit` creates or returns the same validation job for the same immutable
  submission, hash, and validator version.

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

The missing production validator must parse `revealline-content-bundle.v1`, re-hash its inventory,
compile every mission, check compatibility and media bounds, and replay applicable route evidence
in an isolated worker. Until that adapter exists, there is deliberately no worker executable and no
automatic publication claim.

## Adapter boundaries

- **Authentication:** `buildCommunityApp` accepts an `authenticator.authenticate(request)` adapter.
  The included constant-token adapter is for Compose only. A production service must replace it
  with a Better Auth session/token adapter and apply account limits.
- **Blobs:** `DiskBlobStore` is runnable locally. `S3CompatibleBlobStore` accepts an injected S3
  client plus `put`, `head`, and `get` command factories, avoiding a second SDK choice in this
  scaffold. Production S3 wiring must stage and verify bytes before immutable upload, set private
  bucket policy, and rehearse database/blob restore.
- **Uploads:** `DirectUploadTransport` advertises the bounded one-shot development route.
  `TusUploadTransportBoundary` describes the stable metadata passed to a future maintained tus
  server. The tus server, completion callback, ownership check, checksum admission, interrupted
  upload cleanup, and disk/S3 store selection remain an explicit integration item; resumable upload
  is not claimed here.
- **Repository:** both PostgreSQL and in-memory test implementations use the same submission/job
  methods. The memory implementation supports deterministic API and worker tests; it is never used
  by the executable server.

## Limits and operational work still required

The default package ceiling is 256 MiB and catalog pages are capped at 50 entries. A reverse proxy
still needs request timeouts, connection limits, HTTPS, and rate limits. Public deployment also
requires Better Auth configuration, mail/account recovery choices, report/unlist/audit endpoints,
tus integration, the real validator sandbox, malware/media processing policy, metrics, backups,
restore rehearsal, and an explicit infrastructure decision. Docker Compose is a development
fixture, not production evidence.
