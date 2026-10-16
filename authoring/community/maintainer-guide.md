# Deliver creator content and the combined framework release

## Content handoff available in this source

The [picture campaign creator](../../game/creator/) turns one or many images/videos into reviewed,
portable `.rlpack` editions. The [creator bundle reference](creator-bundle-reference.md) defines the
strict manifest, dependency closure and installer. Arbitrary Content Studio JSON is still editable
source rather than a general installed-Custom format; only the creator's verified template scope
uses this `.rlpack` path.

1. Collect the exact editable source and required media with truthful rights and credits. Keep
   private originals, unrelated media and player backups outside the shareable pack.
2. Prepare and approve the exact creator result. Confirm every generated map shows the intended
   enemies and collision obstacles, every video uses the intended poster/range, and every included
   item has route evidence for the actual compiled identity and seed.
3. Test the downloaded artifact rather than an in-memory object. Import, review and install it in a
   separate browser origin; exercise ordinary Solo play, legal completion, earned media, Retry,
   Next, reload and unfinished-attempt recovery. Record which browser/device was actually tested.
4. Preserve immutable old editions. A changed byte produces a new edition; it must not reinterpret
   an old attempt, completion record or earned picture. Matching an official name or setting an
   uploaded flag never grants Journey or official status.
5. For unsupported arbitrary geometry, use the shared compiler and exact Content Studio preview,
   then integrate through its owning catalog/runtime with separately recorded completion evidence.
   Do not coerce Studio JSON into a strict legacy expansion or `.rlpack` manifest.

Creators can exchange `.rlpack` files without a software release. A deployed community service can
publish the same approved bytes independently after server validation. The repository includes the
client, account flow, tus transport, validation worker, catalog, reports, unlisting and recovery
tooling; it does not establish that a public service is currently deployed.

## Community-service deployment boundary

Serve the static game, Studio and API on the intended same origin. Before enabling public uploads,
configure PostgreSQL migrations, Better Auth secret/base URL/trusted origins, email verification and
password reset delivery, tus storage and shared locks, immutable disk or S3 storage, isolated media
inspection, trusted-proxy and connection limits, TLS/domain, monitoring and off-host backups.

Production acceptance requires evidence from the deployed topology:

- two independent creator accounts with ownership isolation;
- interrupted and resumed upload through the real proxy;
- corrupt-package rejection and automatic listing only after validation;
- API and worker restart while a job lease is active;
- shared upload locking and incomplete-upload cleanup across replicas, when replicated;
- database/blob backup, verification and journal-backed restore into an empty target;
- Creator A publish → Player B discover/install/complete/reload/offline play;
- report, owner unlist, immutable update and retained installed ownership after public removal.

The in-process and fake-client suites verify application contracts, but they do not replace these
PostgreSQL, proxy, object-storage, mail and restore rehearsals. GitHub Pages can ship the static
client; it cannot run Fastify, PostgreSQL or the validation worker.

The disk deployment remains the checked-in Compose default. Selecting
`COMMUNITY_BLOB_STORAGE=s3` switches both immutable packages and maintained tus resumable storage
to the configured private bucket and requires the executable S3 readiness probe to pass. Keep the
local package-verification staging directory private and bounded. Do not claim S3 or AWS acceptance
until the S3-aware restore rehearsal, MinIO journey and credentialed private-bucket smoke gate pass.

## One combined framework release

The image, batch, mixed-media, community, Versus, Team and bounded media-editor work is being
qualified as one combined creator feature. Individual phase records are evidence, not independent
publication instructions. Begin from current reviewed `main` in an isolated checkout and preserve
other working trees.

1. Reconcile the [delivery register](delivery-plan.md) and
   [combined acceptance record](combined-release-acceptance.md) with the exact candidate. Keep local,
   modeled, deployed, physical-device and public evidence separately labeled.
2. Update guides, examples and compatibility declarations. Run the owned creator/runtime and
   community-service suites, repository validation, localization, lint, formatting and the exact
   current release gates. A policy-authorized skipped suite remains deferred rather than passed.
3. Reproduce actual file selection, download, import, installation, play and recovery in the
   supported browser environment. Keep Firefox, Safari and physical mobile open unless each is
   exercised. Installed Creator Versus now uses the real two-board host with exact edition-scoped
   progress and pictures; complete its separate physical fresh-browser import/reload run before
   accepting that transfer path. Generated equal-board replay evidence alone is not an
   installed-player acceptance result.
4. Open and review the combined PR. Coordinate its assigned version with the publication owner;
   never infer a free version from a stale document or move an existing tag.
5. Freeze the reviewed commit through the repository's release coordinator. Use the exact qualified
   source and original artifact; do not rebuild a historical edition with newer code.
6. Verify release artifact hashes, source identity, public paths, online behavior and applicable
   offline play. Review the Pages selector separately where required.
7. Record PR, source SHA, tag, release artifact hashes, qualification/publisher runs, public URL and
   all deferred production gates. A merge, container image or successful static deployment alone is
   not complete creator/community acceptance.

The [delivery workflow](../../docs/feature-delivery-workflow.md) owns the current repository release
procedure. Software publication and a community campaign publication are different operations: the
framework ships through the release coordinator, while each creator edition publishes through the
deployed validation service without requiring another game release.

## Acceptance record template

```text
Scope:
Source SHA / PR:
Tests and exact results:
Browser version, origin and viewport:
Actual downloaded/imported file SHA-256:
Win / Retry / Next / reload / unfinished restore observations:
Versus / Team observations, when advertised:
Failure and recovery observations:
Service topology and restore observations, when applicable:
Release tag / original artifact hashes:
Qualification and publication run:
Public identity / byte verification / public play:
Deferred or unavailable checks:
Acceptance: pending | scoped | complete (with evidence)
```

Creator approval binds an exact local snapshot; it never grants server trust. Publication must
revalidate bounded bytes, hashes, schemas, media, compiler output, compatibility and applicable
route evidence. A changed package is a new immutable edition. Quotas, reporting, unlisting and an
auditable administrative removal path are production requirements for public uploads.
