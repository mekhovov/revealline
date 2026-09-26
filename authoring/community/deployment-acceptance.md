# Community deployment acceptance

Status on 26 September 2026: the `v0.141.2` hardening candidate supplies a fail-closed production
Compose overlay, executable readiness preflight, source-to-target recovery rehearsal, exact tus
interruption proxy, and bounded deployed two-user journey. Automated tests cover each boundary with
injected PostgreSQL, filesystem, process, and HTTP failures. The service suite passes **63/63**. No
live infrastructure acceptance is claimed by the source candidate.

## Automated source evidence

- Production Compose forces `COMMUNITY_ALLOW_DEV_AUTH=false`, clears development tokens, and
  requires database, Better Auth, account-mail, administrator, and exact trusted-proxy settings.
- Every PostgreSQL-backed auth, report, submission, and upload-byte admission setting is forwarded
  to the API. The worker receives no Better Auth or mail secret.
- Numbered application migrations complete before the Better Auth migration. Both complete before
  preflight, and API and worker startup depend on successful preflight.
- Schema readiness requires every application and Better Auth table plus the columns introduced by
  the latest report-audit and tus-coordination migrations.
- Package and tus readiness each create an exclusive mode-0600 probe, synchronize its bytes, read
  and compare them, and remove the probe. Existing storage contents are not enumerated or changed.
- Media readiness runs only bounded `ffprobe -version`; invalid output and process failure stop
  startup.
- The command returns machine-readable success. Failure identifies only the failed boundary and
  never emits configuration values, database URLs, filesystem paths, process output, or nested
  errors.
- `npm run acceptance:tus-resume` commits 17 bytes of the first PATCH, drops the connection, reads
  the authoritative offset with HEAD, resumes the same resource, and verifies exact final bytes plus
  one submission and one upload resource.
- `npm run recovery:rehearse` refuses identical or unconfirmed targets, restores a verified snapshot
  into a separate database/blob root, compares semantic database fingerprints and exact package
  references, and writes an owner-only redacted receipt.
- `npm run acceptance:deployed` uses three independent short-lived accounts to publish, validate,
  discover, download, install, legally complete, reload, report, unlist and replay one disposable
  immutable edition offline. It requires explicit destructive opt-in and reserves its receipt before
  publication.
- `/health` remains a cheap PostgreSQL liveness check. `/ready` reruns schema, storage, and ffprobe
  checks; concurrent requests share a probe and both success and failure are cached for 30 seconds
  to bound work. The production container health check uses `/ready` and fails closed.

## Deployment rehearsal gate

Run these checks in the selected production-like environment before claiming availability:

1. Store the completed production environment file outside the checkout with owner-only access.
2. Render and review the two-file Compose model in a secret-safe operator session. Confirm that no
   development token adapter is present and that proxy hop count matches the deployed path.
3. Start a new empty stack. Record successful numbered migration, Better Auth migration, preflight,
   API readiness, and worker startup without copying secrets into the acceptance record.
4. Restart the full stack over the retained database and volumes. Confirm migrations are
   idempotent, preflight passes, and published packages remain byte-identical.
5. Make each dependency unavailable in turn: PostgreSQL/schema, package volume, tus volume, and
   ffprobe. Confirm preflight or `/ready` fails, API/worker startup stays blocked where applicable,
   and the public response contains no underlying error text.
6. Exercise the HTTPS proxy with the configured exact hop count and confirm admission windows use
   the intended client address. Run `npm run acceptance:tus-resume` through the deployed proxy and
   repeat it across API restart.
7. Run `npm run acceptance:deployed` with Creator A, Creator B and administrator sessions. Preserve
   its redacted receipt, then exercise immutable update in the browser.
8. Stop writers and run `npm run recovery:rehearse` against a confirmed empty target. Retain the
   redacted receipt and repeat exact download plus offline ownership checks against the restored
   service.

Container runtime, public DNS/TLS, mail delivery, shared S3 storage, and the two-user journey remain
environment-dependent. Docker and Podman were unavailable in the source implementation
environment, so the Compose topology requires the rehearsal above before a deployment claim.
