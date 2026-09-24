# Phase 5 acceptance — integrated client candidate, not released

Status: the community catalog client is implemented on a corrected Phase 3 base. It is ready to
stack onto the Phase 4 service after that service's final commit is known. No community deployment,
public catalog or production account provider is claimed by this candidate.

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
- Built-in-browser startup on the isolated Phase 5 branch rendered discovery filters, local
  navigation and the publishing form. With no Phase 4 service on that branch, it reported the
  catalog as unavailable, kept the installed-play recovery message visible and left upload disabled
  because no account adapter was configured.

The focused Phase 5 suite passes 10/10 scenarios on Node 20.19.5 before final integration. Scoped
ESLint, Prettier and diff checks are recorded on the final commit.

## Required Phase 4 service contract

The integrated service must provide cursor/search catalog results, stable collection/latest-edition
metadata, bounded preview bytes, reports, owner-only unlisting and owner-only submission status.
Direct and tus uploads remain transport adapters; the browser does not invent a successful upload or
publication.

## Remaining acceptance gates

- Rebase onto the accepted Phase 4 service commit and run the combined service/client tests.
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
