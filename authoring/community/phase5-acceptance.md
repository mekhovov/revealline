# Phase 5 acceptance — released local client/service source and deployment follow-ups

Status: the community catalog client and service source shipped in `v0.141.0`. The network boundary
is exercised through the real Fastify application with its in-memory repository and blob store. A
post-release follow-up adds the administrator report-triage page over the existing bounded API. No
community deployment, public catalog or production account provider is claimed by this record.

## Completed automated evidence

- Public catalog reads are account-free. Search text, opaque cursor and bounded page size cross an
  explicit client boundary, and the page exposes a real **Load more campaigns** continuation.
- Catalog preview is opt-in and accepts only decoded transport bytes declared as PNG or JPEG under
  4 MiB. Remote listing text is inserted with DOM `textContent`.
- Report and authenticated owner-unlist calls have separate adapters. Publication status validates
  every state and exposes published, rejected and unlisted as terminal outcomes.
- The administrator client strictly validates paged report rows without accepting reporter
  identity, normalizes bounded resolution/removal reasons, and checks that service response
  identities match each request. The report page renders remote data as text, loads media only on
  demand, and unlists before resolving so a partial failure leaves the safer public state and an
  explicit retry path.
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
- One cross-layer test drives the real Fastify routes through the production client: Creator A
  publishes two valid `.rlpack` editions, cursor pagination and search return the expected immutable
  records, and Player B discovers and installs the latest exact bytes. The modeled player saves an
  unfinished attempt, the creator unlists the edition and the service shuts down, then a fresh
  runtime restores and legally completes that attempt entirely offline. A reloaded profile retains
  the exact clear and picture binding, and another offline run starts without a network request.
  Reporting and cross-owner unlisting refusal remain in the same scenario.
- The production browser boundary restores a same-origin Better Auth session and supports email
  sign-up, sign-in and sign-out without persisting credentials or session tokens. A real Better
  Auth memory-adapter session created through the browser client owns a submission, uploads exact
  bytes, observes automatic publication, unlists that edition, and loses owner access after
  sign-out.
- The browser tus 1.0 transport creates an upload with immutable metadata, sends bounded PATCH
  chunks, retains only the opaque upload URL after a connection failure, reads the authoritative
  server offset with HEAD, and resumes the same draft without creating another submission. Focused
  coverage interrupts after four bytes and completes from that offset.
- Built-in-browser startup at the isolated integration source rendered discovery filters, local
  navigation and the publishing form. With the API intentionally absent, it reported the catalog as
  unavailable, kept the installed-play recovery message visible and left upload disabled because no
  account adapter was configured.
- A follow-up attempt to exercise the new account form against a real local Better Auth/Fastify
  process was blocked because the subtask built-in browser rejected loopback navigation. The exact
  same-origin account/publish path is covered through Fastify and Better Auth in-process; a visible
  browser pass remains open.

The focused Phase 5 store suite and account/tus browser boundary are included in the combined
creator/service acceptance counts recorded for `v0.141.0`. The Phase 4 service suite includes the
real Better Auth browser-client scenario. The moderation follow-up adds client/controller tests and
a cross-layer production-client/Fastify report queue and resolution path.

## Integrated service contract

The service provides cursor/search catalog results, stable collection/latest-edition metadata,
bounded preview bytes, reports, owner-only unlisting and owner-only submission status. Direct and
tus uploads remain transport adapters. The browser implements the service's bounded tus 1.0
creation/offset/chunk contract and treats only server responses as upload progress.

## Remaining acceptance gates

The `v0.141.2` hardening candidate adds the fail-closed production Compose and readiness contract
recorded in [deployment-acceptance.md](deployment-acceptance.md). This removes manual ordering and
configuration ambiguity from the source deployment path, but it does not replace the live gates
below.

- Repeat Creator A publish → automatic validation → listing → Player B preview/install →
  legal win → reload/offline play through the deployed same-origin service in a clean physical
  browser profile. The modeled in-process integration now covers this behavioral chain but is not
  deployed-browser evidence.
- Exercise service restart, catalog outage, report, unlist and immutable update with the
  containerized PostgreSQL service. The browser and mounted server interruption/resume paths are
  independently covered; restart persistence still needs container acceptance.
- Rehearse database/blob recovery and verify that an unlisted edition stays playable for players who
  already installed its exact bytes.
- Exercise the report-triage page with a real administrator session against the deployed service,
  including the retry state where unlisting succeeds but resolution is temporarily unavailable.
- Run hosted preflight/build/release-ready checks and publish only through the release coordinator.

Reference-aware installed-media offload is implemented locally. **Offload installed media** first
requires and revalidates the exact retained `.rlpack`, reconstructs the installed edition, and
records an `offloading` journal before the managed-media commit. The commit keeps the immutable
manifest and ownership keys, hides the edition from playable discovery, detaches only creator asset
references unused by another active edition, and deletes a blob only when no managed domain retains
its hash. **Reinstall exact edition** restores those bytes from the retained package without a
network request. Focused tests cover unshared deletion, shared-asset retention, stale concurrent
generation refusal, interrupted-journal recovery and exact offline reinstall. A physical browser
offload/reinstall run passed in the built-in browser using an exact 810,180-byte local `.rlpack`.
The catalog first showed Installed and Offline copy, then replaced Play with **Reinstall exact
edition** after offload. Reinstall restored the same creator edition
`6033108fe9e7acc279cb888b19cfccb7033aa9ce20999dc5213b58e282873467`, and its ordinary Custom player
opened with **Start mission** enabled. This local browser evidence does not claim a deployed
community service.

The cross-layer journey uses the in-memory repository and blob store with injected account tokens;
it composes production client, runtime, storage and Fastify boundaries without claiming a physical
browser or deployed service. It does not qualify the Docker Compose topology, PostgreSQL migration
on an existing volume, Better Auth account recovery, disk/S3 failover, or production
backup/restore. Those operations remain deployment acceptance work and no AWS, domain, mail, or
public-service availability is claimed.
