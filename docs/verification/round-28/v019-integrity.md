# v0.19.0 frozen integrity and candidate equality

**The frozen archive and its independent rebuild passed. Every candidate site file is byte-identical to the frozen site.** The local [v0.19.0 game](../../../releases/v0.19.0/site/game/) and [downloadable ZIP](../../../releases/v0.19.0/site/distribution.zip) preserve source commit `9b97ea4ab0fa43c583c060d79f6806a6ec599b43`, annotated tag object `b12479e46307dbc6178ee4189cba6940a6baba73`. The integrity check completed on 12 September 2026 at 18:25:57 UTC.

The [machine audit](v019-integrity.json) is an exact **38,772-byte** copy of its [original cache result](../../../.cache/round-28/v019-preservation/audit-20260912T182545841392Z/audit.json), SHA-256 **`0cf3c6ddd785e6876a43cb5571463949ff63723f6a87c599947b3aaeb2ba18d9`**. No earlier audit, report or frozen file was rewritten.

## Archive and rebuild

The prepared runner was executed once after the snapshot completed, with the full source, tag and artifact hashes supplied by the release owner. It checked the annotated tag's object, type, peeled commit and raw text, and the [release metadata](../../../releases/v0.19.0/release.json).

| Artifact         |       Bytes | SHA-256                                                            |
| ---------------- | ----------: | ------------------------------------------------------------------ |
| Source TAR       | 149,391,360 | `a5a5cbf6046265e1dcf2fd92211da6adfcb4686c65d5a4a4d77e69a89fa6bd1d` |
| Distribution ZIP |  31,910,492 | `3b9319af5548f628ed9a6c8401e1b709c3e0c57f06927dedf63dc422664bfb9f` |
| Manifest         |      23,150 | `7e397fce46b4c72c4eb6b188c31c03265c0773eb4b822a75efd83ce76e56ed10` |

A fresh `git archive` of the tagged commit exactly matches the source TAR. Safe extraction admitted **1,081 regular files / 148,480,846 bytes** and rejected traversal, duplicate paths, links and special entries. The [extracted source inventory](../../../.cache/round-28/v019-preservation/audit-20260912T182545841392Z/source-inventory.json) and [archived build CLI](../../../.cache/round-28/v019-preservation/audit-20260912T182545841392Z/source/scripts/game-cli.mjs) are retained.

That archived CLI rebuilt the same version and revision under **Node 22.22.2**, using only its own extracted source/assets. All **146 loose output files** match the frozen site byte for byte, including its ZIP, manifest and internal build marker. All **143 ZIP entries** pass CRC and equal their loose payloads. All **142 manifest assets** match their recorded sizes and hashes; ZIP and loose inventories match exactly. The [build output](../../../.cache/round-28/v019-preservation/audit-20260912T182545841392Z/build.stdout.json) and empty [stderr log](../../../.cache/round-28/v019-preservation/audit-20260912T182545841392Z/build.stderr.log) are retained.

The independent [offline artifact check](../../../.cache/round-28/v019-preservation/audit-20260912T182545841392Z/offline.stdout.json) verifies **139 files / 31,820,110 bytes**. The generated worker exactly equals the archived template with its embedded configuration; every game entry's marker resolves to the local root worker/scope. The recomputed build ID is **`947a44b5e7fe97296e59626be0916d46a889b775d1f273639d9dc38185e9ef5c`**.

## Exact relationship to the browser-tested candidate

The separate [candidate/frozen comparison](../../../.cache/round-28/v019-preservation/candidate-frozen-comparison.json) passed, SHA-256 **`a7412ad4ee12fe70913e6de9467e8b414c035f2c4eff60ac9f384c23504c9229`**. It compares every actual file byte, not only the ZIP hash or selected assets: the candidate and frozen site have the same **146 paths / 63,802,764 aggregate loose-file bytes**. This includes the ZIP, manifest, build information, HTML, generated worker, offline configuration and all assets. Both carry exact label `v0.19.0` and source revision `9b97ea4`.

The same comparison independently matched all **352 archived source inputs** to the [published tested-source inventory](v019-source-inputs.json), SHA-256 `c488ef7dd0738586fef48575e17a5151922d554a42f47b4ea51310b57b9c3456`. Those are the inputs from the separately reported [1,667-test/six-gate run](v019-source-gates.md), not another test execution.

All **26 candidate browser artifacts / 589,344 bytes** retain their exact recorded names, sizes and hashes before and after comparison. Their [inventory](../../../.cache/round-28/v019-browser-inventory.json) remains SHA-256 **`c3bd403d35abaa0a7ca1f4effcf4294b73ab986ea1acf63086cfe8fafb58b076`**. The [browser report](v019-browser.md) documents the actual offline pack-install, Ready/current/recovery export, load, win, retained-library and gallery journeys on that candidate.

This equality establishes that the browser-tested site bytes are the frozen distribution bytes. It does not relabel the original candidate-origin browser session as a second run on the `/releases/v0.19.0/` origin or claim a new storage/install test. No redundant browser journey was performed in this audit.

## Preservation and limits

All **23 earlier release trees / 2,632 files / 3,392,110,790 bytes** and **24 prior exact tags** match the [pre-v0.19 baseline](../../../.cache/round-28/v019-preservation/before.json), SHA-256 **`29e254d0761bd5cf36d313b8d23f48e93df8f28bce43b74af1c4f076569f7b83`**, before and after the audit. The baseline's **53 protected evidence files** also remain exact, including the earlier 41-file source-browser set, both legal QA fixtures and v0.18 preservation records. Exactly one new version tree and one new annotated tag are present, and the version index contains the preserved 23 metadata records plus v0.19.0.

The [audit runner](../../../.cache/round-28/v019-preservation/audit.py), [invocation](../../../.cache/round-28/v019-preservation/audit-20260912T182545841392Z/invocation.json) and [comparison runner](../../../.cache/round-28/v019-preservation/compare-candidate.py) record the reproducible commands and boundaries. Mutable working app/docs were not used as build authority. No gameplay tests, fixture generation, dependency installation, deployment, commits, native packaging, physical-device checks or server operations were performed by this audit. The original test, candidate and browser evidence retain their separate scopes.
