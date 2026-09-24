# Community catalog client slice

This directory is the browser client boundary for the Phase 4 community API. It is intentionally
usable without an account for browsing, downloading, installing, and offline play. Publishing
requires injected creator authentication and, when advertised by the service, an injected tus
upload adapter.

The install path checks the public package size and SHA-256, then passes the exact bytes through the
existing `.rlpack` importer, current compiler/replay validation, storage review, and atomic creator
store commit. A newer catalog version installs beside the old immutable edition. It does not rewrite
saved attempts, progress, or earned-picture receipts.

The explicit **Remove recovery download** action deletes the separately retained `.rlpack` from
Cache Storage. It does not uninstall the campaign or remove its manifest, runtime media, saves, or
earned ownership. The exact package can be reconstructed from a still-installed edition and retained
again without a network request. Physical offloading of installed runtime media needs a future
reference-counted creator-store migration; this slice does not label recovery-package removal as
installed-content offloading.

Catalog cards render service metadata with DOM text nodes. The Phase 4 API has no poster-preview,
ratings, reporting, unlisting, or update-channel endpoint, so this client shows bounded text details
and computes available immutable updates from the current catalog page. Pagination controls and a
server-side search contract remain follow-up work.

The page defaults to same-origin `/v1` routes. Self-hosted deployments can set
`data-community-api` on `index.html`. A host may expose `globalThis.RevealLineCommunityAuth` with:

- `headers(): Promise<Record<string,string>>` for its real Better Auth session/token adapter.
- `uploadResumable({ descriptor, blob, onProgress, authHeaders })` for a maintained tus client.

Without those adapters, local package verification remains available and upload stays disabled.
