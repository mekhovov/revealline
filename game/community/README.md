# Community store browser boundary

This directory implements the Phase 5 browser client on top of the creator-layouts.v3 content
history. Browsing, installing, and local creation remain account-free. Publishing and owner
unlisting use the same-origin Better Auth session exposed by the Phase 4 service.

The install path checks the published size and SHA-256 before running the exact `.rlpack` importer,
compiler/replay validation, storage review and creator-store commit. An update installs beside the
old immutable creator edition. Its saved attempt key, progress profile and earned-picture receipts
continue to refer to the old creator edition. The catalog only claims an update when the service
supplies `latestEditionId`; it never groups unrelated creators by a matching slug.

Offline state has two independent facts:

- **Installed / Play offline** means the exact manifest and required runtime media exist in the
  managed creator store.
- **Offline copy** means the exact published `.rlpack` also exists in Cache Storage for reinstall.

Before **Remove recovery download** becomes valid, the library verifies both the retained package
and a byte-identical package reconstructed from the installed edition. Removal is rejected if that
review is stale or installed runtime changed. The operation deletes only the Cache Storage copy;
it does not mutate the creator manifest/media authority, the saved-attempt key or the progress
profile. Physical installed-media offloading is not implemented because the current managed-media
format intentionally forbids removing historical references.

The client exposes explicit adapters for:

- cursor pagination and bounded `q` search;
- bounded PNG/JPEG catalog previews loaded only after the player asks;
- report submission;
- immutable download/install and server-declared update metadata;
- owner-only publication status and unlisting; and
- direct upload for development services and bounded tus 1.0 resumable upload for production.

The stacked Phase 4 service provides these routes and derives a stable collection identity from the
creator account plus slug. Each catalog response names the service-selected latest immutable
edition for that collection. The page still handles catalog outage without affecting installed
play.

The page uses `/api/auth/get-session`, email sign-up/sign-in/sign-out, and HttpOnly session cookies.
It does not place credentials or session tokens in browser storage. The tus client retains only the
opaque upload resource URL, keyed by the immutable submission hash and size, until completion. On
retry it reads the server's authoritative offset with HEAD and continues in bounded chunks.

An embedding host can still override this same-origin behavior by exposing
`globalThis.RevealLineCommunityAuth` with:

- `headers(): Promise<Record<string,string>>` for its account session/token adapter;
- `uploadResumable({ descriptor, blob, onProgress, authHeaders })` for its tus client.

Remote titles and descriptions are rendered through `textContent`. Preview responses must be PNG
or JPEG under 4 MiB. Reports accept a bounded reason and optional text. Public catalog reads and
reports do not need the publishing account adapter.
