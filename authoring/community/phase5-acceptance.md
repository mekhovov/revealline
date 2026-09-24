# Phase 5 acceptance — stacked service/client candidate, not released

Status: the community catalog client is stacked on the completed Phase 4 service candidate. The
network boundary is exercised through the real Fastify application with its in-memory repository
and blob store. No community deployment, public catalog or production account provider is claimed
by this candidate.

## Completed automated evidence

- Public catalog reads are account-free. Search text, opaque cursor and bounded page size cross an
  explicit client boundary, and the page exposes a real **Load more campaigns** continuation.
- Catalog preview is opt-in and accepts only decoded transport bytes declared as PNG or JPEG under
  4 MiB. Remote listing text is inserted with DOM `textContent`.
- Report and authenticated owner-unlist calls have separate adapters. Publication status validates
  every state and exposes published, rejected and unlisted as terminal outcomes.
- Every downloaded package is checked against the published byte count and SHA-256, then passes the
  existing `.rlpack`, compiler, replay and managed-storage review. Corrupt bytes cannot create an
  installed index.
- A newer edition installs beside the previous exact creator edition. Update availability is taken
  from server-supplied immutable edition identity rather than matching title or slug. Both editions
  retain distinct offline play links and creator profile keys.
- A retained package reinstalls into an empty runtime store without a network request. Catalog
  outage does not affect already installed Custom play.
- Removing a recovery download requires a fresh review proving that installed runtime can recreate
  the exact published hash. Stale byte or runtime changes reject removal. Successful removal leaves
  the manifest, runtime media, saved-attempt authority, progress profile and earned receipts alone.
- Injected Alice and Bob account adapters publish independently. Cross-owner submission reads and
  unlisting fail, while the owner can observe validation becoming published and explicitly unlist
  that edition.
- The service derives a stable `collectionId` from owner plus slug and returns its authoritative
  `latestEditionId` and `latestVersion`. Update discovery therefore does not group unrelated
  creators or depend on matching remote display text.
- One cross-layer test drives the real Fastify routes through the production client: Alice uploads
  and publishes two valid `.rlpack` editions, cursor pagination and search return the expected
  immutable records, Player B's store downloads and installs exact validated bytes, a report is
  accepted, Bob cannot unlist Alice's edition, Alice can, and the installed edition remains
  offline-playable after public removal.
- Built-in-browser startup at the isolated integration source rendered discovery filters, local
  navigation and the publishing form. With the API intentionally absent, it reported the catalog as
  unavailable, kept the installed-play recovery message visible and left upload disabled because no
  account adapter was configured.

The focused Phase 5 suite passes 10/10 scenarios on Node 20.19.5. The Phase 4 service suite plus the
new cross-layer scenario passes 22/22. Scoped ESLint, Prettier and diff checks are recorded on the
final commit.

## Integrated service contract

The service provides cursor/search catalog results, stable collection/latest-edition metadata,
bounded preview bytes, reports, owner-only unlisting and owner-only submission status. Direct and
tus uploads remain transport adapters; the browser does not invent a successful upload or
publication.

## Remaining acceptance gates

- Exercise Creator A publish → automatic validation → listing → Player B preview/install → legal win
  → reload/offline play in a clean built-in-browser origin.
- Exercise a real interrupted resumable upload, service restart, catalog outage, report, unlist and
  immutable update with the containerized service.
- Rehearse database/blob recovery and verify that an unlisted edition stays playable for players who
  already installed its exact bytes.
- Run hosted preflight/build/release-ready checks and publish only through the release coordinator.

Physical removal of installed managed-media bytes is outside this candidate. The current media store
preserves historical references monotonically; the UI calls the implemented operation **Remove
recovery download** and does not describe it as uninstall or runtime offloading.

The cross-layer test uses the in-memory repository and blob store. It does not qualify the Docker
Compose topology, PostgreSQL migration on an existing volume, Better Auth account recovery, a real
interrupted tus upload, disk/S3 failover, or production backup/restore. Those operations remain
deployment acceptance work and no AWS, domain, mail, or public-service availability is claimed.
