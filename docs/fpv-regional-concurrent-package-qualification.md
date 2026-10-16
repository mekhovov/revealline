# Concurrent regional download: exact package qualification

The cloud optional packages from PR #1352 were independently retrieved and verified. The packaged downloader passed the concurrency and sparse-world scenarios; this receipt does not qualify the forthcoming 8 km world’s normal Library journey.

## Exact candidate

- Source: `a07c0a9c36e2e0af4cda3a5a53a45573ba2712e8`.
- Tree: `2eaa905aaec9476f0a6b1ab3906472910276ebb5`.
- Cloud run: `38683440884`; artifact: `11949258521`.
- Version: `v0.151.1`; package revision: `52f8d94b8451af66d673853b272a839f09800ce5f727a5388c054d96e0ef0079`.
- Retrieved artifact: 23,069,551 bytes, SHA-256 `447255715897c452af7171a2b38d593e049c6ebe05861583e7f91f44ba268571`.
- Worlds runtime ZIP: 17,466,378 bytes, SHA-256 `87de7ccaea1ada670e3cb7a549e449782ff2a28c1d2efd8d9d9fb55c0ca8f6ad`.

The cloud receipt records two reproducible builds and verified committed inputs. `publicEligible` remains false; no release promotion is inferred.

## Archive and dependency verification

All 15 top-level checksums and every member’s length, SHA-256 and exact inventory in all six runtime/source archives passed.

| Package | Runtime files / bytes | Source files / bytes | Existing limit |
| --- | --- | --- | --- |
| Civilian Flight | 94 / 3,739,893 | 96 / 3,773,447 | 96 files, 8 MiB |
| Academy | 101 / 6,752,212 | 103 / 6,787,276 | 104 files, 8 MiB |
| Worlds | 160 / 17,440,368 | 162 / 17,483,710 | 162 files, 20 MiB |

Finished-archive dependency validation used four exact-head, Git-blob-verified validator files with no source fallback. The graphs passed: Civilian Flight 68 modules / 96 imports; Academy 81 / 152; Worlds 132 / 334.

## Functional checks against the packaged runtime

The two exact published scenarios were copied outside the extracted archive and only their imports were redirected to packaged modules. The authoring-only delivery builder likewise stayed outside the archive and used the packaged manifest validator. Original/adapted fixture hashes are retained. All 160 extracted runtime members were rechecked byte-for-byte against the verified ZIP after the scenarios.

Five concurrency groups passed: four concurrent payload requests, exact bytes with stable inventory order, paired manifest validation before payload acquisition, corruption aborting and joining peers, and explicit/pre-aborted cancellation. No late progress occurred after rejection. The scheduled 16-payload transport deliberately completed files out of order; it is a controlled functional fixture, not an internet throughput benchmark.

All seven sparse groups passed: strict legacy schema and explicit coverage; zero payload/mesh/collider ownership for known empty cells; unknown cells remaining unknown; mixed empty/populated collision behavior; cancelled staging retaining the old pair; 2,200 shared-flight ticks across four cell crossings with zero scenery requests and exact reference state parity; 256 m coverage with fractional restore; and v2 dependency binding with downgrade/missing-payload rejection.

## Preserved evidence and limits

External candidate directory: `/Volumes/alex/CodexMigrationStaging/fpv-package-qualification-20261014/concurrent-download-a07c0a9c`.

It contains `retrieval-receipt.json`, `all-package-members-receipt.json`, `archive-import-closure-receipt.json`, and `functional-check/fixture-receipt.json`, plus the concurrency result and sparse scenario log. Exact source validators are retained separately under `fpv-temp/concurrent-download-a07c0a9c-validator`.

An initial import-graph invocation ran before the two non-Worlds ZIPs had been extracted and failed with a missing local file. They were then extracted unchanged from the already-verified artifact, and the complete check passed; no production changes or fallback inputs were used.

This is exact packaged integrity and functional qualification, not a new native UI/offline/controller/endurance result. The separately reviewed real IndexedDB corruption/cancellation checks remain source evidence. The new 8 km descriptor, trusted Library row and complete native download/Fly journey require their own exact combined candidate. File and byte limits were not raised.
