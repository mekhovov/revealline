# Round 30 — frozen v0.21 integrity

**The independent audit passed on its first execution**, completed **2026-09-12 20:03:34 UTC**. The frozen `v0.21.0` source is **`1250a8afdcf9594d87ed6a79ba29639d1225fa69`**, with annotated tag object **`6eb25743751f8e55078c0bbc32efaf6c197baf89`**. The tag object, peeled commit and full release metadata match the supplied freeze pins.

The [machine report](v021-integrity.json) is a byte-exact copy of the [original audit JSON](../../../.cache/round-30/release-preparation/audit-20260912T200316953988Z/audit.json): **43,741 bytes**, SHA-256 **`d295ee46dc272be429fb2d079dbb1f97a8cb1a94908d33abf3cdfb066708c3b2`**. This note and copy were staged in cache; no source, frozen file, prior report or tag was edited.

| Frozen artifact                                                     |       Bytes | SHA-256                                                            |
| ------------------------------------------------------------------- | ----------: | ------------------------------------------------------------------ |
| [Source TAR](../../../releases/v0.21.0/source.tar)                  | 150,241,280 | `b1c57c085c877be192676b8407645daf84c34f4e8c20a520036632ebfdb69b59` |
| [Distribution ZIP](../../../releases/v0.21.0/site/distribution.zip) |  32,170,989 | `41c708bd8cb1a759c44ec409bbcbc71fe8abfc63bcae2bb511cbe102f584b005` |
| [Manifest](../../../releases/v0.21.0/site/manifest.json)            |      24,130 | `03b023eb71d048305848149700e8977431f89648f3ff3c1dab36cf4e26b9a883` |

## Archived source and reproducible build

The source TAR's actual bytes equal a fresh `git archive --format=tar` of the frozen commit. Safe extraction found **1,125 regular source files / 149,291,335 bytes**, with the exact commit in the archive metadata. Traversal, duplicate paths, links, special entries and oversized inputs are rejected by the extractor. The [source inventory](../../../.cache/round-30/release-preparation/audit-20260912T200316953988Z/source-inventory.json) records each extracted file.

All **371 consumed inputs** match the completed [source gates](v021-source-gates.md), including exact size/hash comparison to the archived source. The **1,831 passing tests belong to that separate gate run**; this audit did not rerun them or any source gate.

The independent build used **Node 22.22.2** and the safely extracted source's own [CLI](../../../.cache/round-30/release-preparation/audit-20260912T200316953988Z/source/scripts/game-cli.mjs), with its extracted source as cwd, a fresh `rebuilt-site` output, label `v0.21.0` and the full frozen revision. It completed with exit 0 in 2,867 ms, without dependency installation or network input. The actual command, paths and retained [stdout](../../../.cache/round-30/release-preparation/audit-20260912T200316953988Z/build.stdout.json) / [stderr](../../../.cache/round-30/release-preparation/audit-20260912T200316953988Z/build.stderr.log) are in the machine record.

Every **152 loose output files** matched the frozen distribution by relative path, size, SHA-256 **and actual bytes**. The manifest contains **148 assets / 32,127,711 bytes**. The ZIP contains those assets plus the manifest: **149 entries / 32,151,841 uncompressed bytes**. ZIP CRC, exact inventory, absence of duplicate/encrypted/special entries and every payload's equality to its loose file passed. ZIP, manifest, sidecar and build-ownership marker are included in the loose comparison.

## Candidate equality and offline artifacts

Every file in the accepted exact-label [candidate site](../../../.cache/round-30/v021-candidate-1250a8a/site/) equals the frozen site: **152 files / 64,322,966 bytes**, including the ZIP. The [separate comparison](../../../.cache/round-30/release-preparation/audit-20260912T200316953988Z/candidate-frozen-comparison.json) checks actual bytes and complete inventories before and after, and pins the candidate's [build report](../../../.cache/round-30/v021-candidate-1250a8a/build.json) and [log](../../../.cache/round-30/v021-candidate-1250a8a/build.log). QA wrapper pages outside `site` are not distribution files. Both candidate and frozen metadata use exactly `v0.21.0` and the frozen source revision.

The [offline artifact check](../../../.cache/round-30/release-preparation/audit-20260912T200316953988Z/offline.stdout.json) passed for **145 precache files / 32,077,079 bytes**, build ID **`fe0ae73697503f3627ac036a82210045a99b601f8155236f5f2136a1317f8340`**. It verifies the inventory and every file hash, the generated worker against the archived template plus configuration, the independently recomputed build ID, and all five game-entry HTML build markers and relative root scopes. The web manifest retains `./game/` start URL, `./` scope and existing icons. This validates artifact identity; actual service-worker installation, offline browsing and origin-specific storage remain separate browser evidence.

## Preservation and limits

The [pinned baseline](../../../.cache/round-30/v021-preservation/before.json), SHA-256 **`8dfbbf2feb8f9e5fb7896362554f2bd51ae298b3931a7c0667095abbbed392f2`**, remains exact. Before and after the audit:

- All **25 prior release trees / 2,928 regular files / 3,818,769,268 bytes** matched their inventories.
- All **26 prior tags** retained their object IDs, object kinds, peeled targets and tag-text hashes.
- All **603 protected evidence records / 42,220,195 bytes** remained unchanged.

Exactly one new release tree and annotated tag were added. The version index contains the prior release metadata unchanged plus `v0.21.0`; its new Play and ZIP links exist. The new frozen tree, final source-gate evidence and candidate build records also remained unchanged through the audit.

The prepared [Python auditor](../../../.cache/round-30/release-preparation/audit.py) has SHA-256 `d79d21691536a8a882092f002d7a3443992c6c37ea0008362f88afa804f8bc8e`; the copied [offline verifier](../../../.cache/round-30/release-preparation/verify-offline.mjs) has SHA-256 `a47ac7c0d2fadd114e9fce0315a28ba672a036d299e90c106b49ab773f73690a`. The run created fresh cache outputs only. It did not perform browser or physical-device tests, public deployment, source/gate reruns, server changes or release/tag mutation. Candidate/frozen byte equality identifies the application bytes covered by candidate observations; it does not independently repeat those observations.
