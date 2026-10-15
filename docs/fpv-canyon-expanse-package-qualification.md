# Canyon Expanse: exact package qualification

The 8.192 × 8.192 km Canyon Expanse Library candidate from draft PR #1368 passed independent archive, dependency and packaged-runtime functional checks. Native installation, first flight and visual acceptance remain separate gates; this receipt does not promote the draft or claim player admission.

## Frozen candidate

- Source: `87f6193afea0c8186a7b5edf4c523b6c477c1656`.
- Tree: `d18b58d3d24c8d7a7a3e9ed259f5f1e0c0472c06`.
- Cloud run: `38688837815`; artifact: `11951107012`.
- Version: `v0.151.1`; package revision: `e3e07de977524e382b6e7592691e08b1817c073ad8ae93298f07646788da1353`.
- Artifact: 23,079,914 bytes; SHA-256 `4c0654af8bc915725aa5febf01854ddff55243718c034f79e7bdb314e32a5c09`.
- Worlds runtime ZIP: 17,480,329 bytes; SHA-256 `03ce9709295533665239817900f0b8e215ef14345a04a20a06282121df929b76`.

The cloud receipt records two reproducible builds with committed inputs verified. `publicEligible` remains false. Broader CI and publication status are not inferred from the optional package result.

## Integrity and closure

All 15 top-level checksums and every file length, SHA-256 and exact inventory in all six runtime/source archives passed. The existing limits are unchanged.

| Package | Runtime files / bytes | Source files / bytes | Existing limit |
| --- | --- | --- | --- |
| Civilian Flight | 94 / 3,741,611 | 96 / 3,775,165 | 96 files, 8 MiB |
| Academy | 101 / 6,754,958 | 103 / 6,790,022 | 104 files, 8 MiB |
| Worlds | 160 / 17,454,319 | 162 / 17,497,662 | 162 files, 20 MiB |

Finished-archive transitive import validation used exact-head, Git-blob-verified validators without a source fallback: Civilian Flight 68 modules / 96 imports; Academy 81 / 152; Worlds 132 / 334. All 160 staged Worlds runtime files were compared byte-for-byte with the ZIP.

## Packaged functional verification

Exact published scenarios were kept outside the extracted archive. Only their module import URLs were redirected to the unchanged packaged runtime; original and adapted hashes are recorded.

- Five downloader groups passed: at most four concurrent payload requests, stable inventory and exact bytes despite out-of-order completion, manifest validation before payload download, first-failure peer abort/join, explicit cancellation and no late progress. This controlled transport is not an internet throughput measurement.
- Seven sparse-scenery groups passed, including strict legacy validation, explicitly empty cells owning no scenery resources, unknown cells remaining unknown, real populated-cell collision, cancellation retaining the old frame, 2,200 shared-flight ticks across four cell crossings with reference-state parity, fractional positions on 256 m cells, and missing declared payload/downgrade rejection.
- The full immutable Canyon bundle passed the production packaged downloader using local response bodies: 2,051 responses, 2,050 payload files, 47,646,152 payload bytes and 47,975,524 bytes including the descriptor. This verifies complete bytes and runtime compatibility, not remote transport or native IndexedDB installation.
- All six authored starts passed in both Self-level and Acro: preparation remained disarmed at zero ticks and exact spawn position; explicit arm followed by 200 commanded ticks produced a climb with zero contacts. Paused sessions ignored nonzero controls. Disposal removed geometry and scene children. Every prepared window used 456,408 geometry bytes, and no scenery payload was fetched because all 1,024 cells explicitly declare empty scenery.

## Shipped entry and remaining acceptance

The actual packaged Library row pins descriptor commit `e561b41bb06d39775bf1bc5f9e078cabeeb84fef`, 329,372 bytes, SHA-256 `d2c3dce6c39227e85a10256fb3d1082fec2a6c7a47f6347fd664e2840eb57003`. It describes the early terrain-only study and six starting points; existing Library entries are preserved. No row, source override or review fixture was injected into this package.

The unchanged package is staged for its ordinary launcher → Explore → regional Library → Download → Saved → Fly journey at `http://127.0.0.1:9082/revealline/practice/fpv-worlds/app/?lang=en`. Native review was deliberately deferred while a separate uninterrupted endurance run occupied the browser. This receipt does not claim that download, offline storage, rendering, physical controllers, mobile hardware or two-hour flight passed for this candidate.

External evidence is preserved under `/Volumes/alex/CodexMigrationStaging/fpv-package-qualification-20261014/canyon-expanse-87f6193a`: retrieval, all-member, import-closure and staged-integrity receipts; exact/adapted scenario hashes; downloader, sparse and full-expanse functional outputs. The adjacent `canyon-expanse-87f6193a-journey` preserves the separate frozen installation and server control. All previous candidates remain intact.
