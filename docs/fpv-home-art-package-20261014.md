# Package-local home artwork — 14 October 2026

The exact cloud-built package containing [PR #1249](https://github.com/mekhovov/revealline/pull/1249) renders its home artwork after offline preparation and again after its origin becomes unavailable. This closes the artwork acceptance gap found during the [corrected update journey](fpv-corrected-package-20261014.md).

## Exact candidate

[Cloud run 38615162179](https://github.com/mekhovov/revealline/actions/runs/38615162179) produced [artifact 11919610810](https://github.com/mekhovov/revealline/actions/runs/38615162179/artifacts/11919610810), binding source `25d086cbd580de5dc5b745ce088af283434df5ae`, tree `71bf69c8df5ad02bc75cd46cc01c6893e40e9192`, and Worlds revision `fff1c41f5e63e04848c3e20070383bece6834939e6b117446aa2931b3bcb518d`.

The GitHub artifact digest, all 15 envelope checksums, all 133 manifest dependencies and the embedded manifest were checked against the original ZIP. Committed inputs and two reproducible builds were verified. Full identities and file hashes are in the [machine-readable receipt](fpv-home-art-package-20261014.json). The optional-practice job passed; the separate company candidate job was still running when this receipt was written. **publicEligible remains false**; no admission flag was changed.

## Native journey

A fresh isolated origin at http://127.0.0.1:9019 served unchanged cloud-built launcher and immutable player bytes. This was not the earlier mixed-source review harness.

1. Canonical Download completed and reported Ready offline.
2. Open prepared practice launched the actual immutable v0.151.1 player. The home showed its full hangar/orchard sunset background and home controls.
3. Only the dedicated origin server was stopped. A transport probe confirmed connection refusal. Browser storage and worker registrations were untouched.
4. Reloading the same exact player URL restored the complete home artwork and controls while the origin remained unavailable.
5. The server was restored and HTTP 200 confirmed.

The background now resolves within `releases/v0.151.1/site/game/ui/art/menu-scenes/fpv.webp`, a dependency already pinned in the package. No extra artwork download or package-budget increase was needed by the URL correction.

The local native screenshot is retained at `/Volumes/alex/CodexMigrationStaging/fpv-temp/package-home-artwork-offline.png`. This verifies one browser's prepared home with its origin unavailable. It does not assert network-wide offline, a browser process restart, eviction or real quota recovery, hardware performance, or all-world rendered qualification. The earlier update, rollback and retained Reservoir evidence remains scoped to its own exact candidate.
