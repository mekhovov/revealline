# Railway Expanse ground: exact package qualification

The optional package from PR #1367 at `83eda367d9db2f37935208627ce12a1a1841f1b4` contains the new ground material and passes packaged geometry, collision and material-tier checks. This is a bounded runtime-package receipt, not native shader/art acceptance or a claim that every PR check passed.

## Exact artifact

- Cloud run `38688619905`, artifact `11951067517`, version `v0.151.1`.
- Source tree `bde2fc59ff76fe222b4caeccef5e8a89f7fe7bbd`.
- Package revision `5c878124a5582dbf694968f39984b5be656d1ae3948f5b862e01546f73e2fd05`.
- Artifact: 23,083,366 bytes; SHA-256 `9a1e02b5a627d4b5026d0dac258eb18c1052f6fb8323624637c56c343fadb619`.
- Worlds ZIP: 17,484,026 bytes; SHA-256 `344403fa1bb50b866b069ddb698aad5ad440d0da9d620b1a1d515a848bc8733c`.

All 15 top-level checksums and exact inventories, lengths and SHA-256 values of every member in all six archives passed. The cloud records two reproducible builds with committed inputs verified; `publicEligible` remains false.

| Package | Runtime files / bytes | Source files / bytes | Declared limit |
| --- | --- | --- | --- |
| Civilian Flight | 94 / 3,741,611 | 96 / 3,775,165 | 96 files, 8 MiB |
| Academy | 101 / 6,754,958 | 103 / 6,790,022 | 104 files, 8 MiB |
| Worlds | 161 / 17,457,808 | 163 / 17,501,284 | 163 files, 20 MiB |

The one-file envelope change is declared by the source PR for `regional/railway-expanse-ground.mjs`; this verification did not change policy or budgets. All extracted runtime files remain byte-identical to the archive.

Finished-archive import validation, using exact-head validators without source fallback, passed Civilian Flight 68 modules / 96 imports, Academy 81 / 152 and Worlds 133 / 336. The Railway ground module is present and reachable through the actual packaged terrain-surface import.

## Functional evidence

Exact-head authoring scenarios were copied outside the package; their imports and translation-bootstrap path were redirected to the unchanged packaged modules. Original and adapted hashes are retained.

`verify-expanse-ground.mjs` passed all 24 comparisons: six authored Railway starts under plain, performance, balanced and quality presentation. Terrain/scenery manifest hashes are pinned to the reviewed `districts-r1` source. Every comparison checks exact rendered position/normal/UV/index bytes, geometry and texture accounting, real support, downward ground strike and clear approach sweep. All three styled tiers matched the plain reference; expected material names were present, invalid quality rejected, and disposal removed geometry, textures, reservations and the scene group.

`verify-live-surface-quality.mjs` passed 20 tier transitions across Canyon, Urban, Railway and Railway Expanse profiles. The shared renderer changed each reused material once, preserved geometry and uniform owners, matched a freshly constructed tier's shader strings/cache identity, avoided invalidation for an unchanged tier, rejected invalid values, and disposed each owner once. This exercises shader generation and shared renderer behavior in Node; it does not compile shaders on a GPU.

## Separate failing gate and remaining work

The appearance-preview job `116269124110` in run `38688619906` failed one of 524 tests; 523 passed. The concrete failure was `scripts/test-world-texture-acceptance.mjs:14`, which still expected 162 source-package files while this explicitly extended package has 163. The source owner was notified to reconcile the assertion. This receipt neither suppresses that failure nor treats a later corrected head as identical to this frozen candidate.

Native shader compilation, appearance, normal Library delivery for the 4 km world and any newly combined package remain separate acceptance steps. No browser tab was opened or altered during the concurrent elapsed-time endurance run.

External evidence: `/Volumes/alex/CodexMigrationStaging/fpv-package-qualification-20261014/railway-expanse-ground-83eda367`, including retrieval/all-members/import-closure receipts and `functional-check/{fixture-receipt,ground-parity,live-tier-receipt,runtime-integrity}.json`. Exact source validators and the failed preview log remain under the external `fpv-temp` directory. Previous candidates are preserved.
