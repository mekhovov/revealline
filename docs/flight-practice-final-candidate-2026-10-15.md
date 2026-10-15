# Flight practice final-guide candidate — 2026-10-15

All three packages passed two byte-identical builds, committed-input verification and independent written-artifact admission after the final guide edits. A separate nine-checkpoint installation observation also passed on these exact bytes, including browser restart; see the [observation report](flight-practice-observation-2026-10-15.md). This remains an **unpublished technical candidate**: `publicEligible` is `false`, and every generated release-review gate remains pending.

## Exact binding

- Source: `ff8bfbca35aa5aabf4a89c1961493102bb50126a`.
- Tree: `b61d3de220c1ac5eb46bf143bcd4bf0020744ce5`.
- Version: `v0.151.1`; base path: `/revealline/`.
- Local immutable output: `/Volumes/alex/CodexMigrationStaging/flight-practice-candidate-20261015-final.F1RPQb/candidate`.
- Envelope SHA-256: `4959a8a012a6268b3a724d7524a613e1e24ff1a2cdb95735558458fecd6121f2`.
- Verification SHA-256: `ee3c7ad0a9351c5cea060682deb74560e83f5cf1d688ed833bccca2fd249f52a`.

The [machine receipt](flight-practice-final-candidate-2026-10-15.json) contains all package artifact hashes. The [earlier baseline report](flight-practice-candidate-2026-10-15.md) and its candidate are preserved, not overwritten. Neither local output path is a public release URL.

The existing bundle tool ran from a clean checkout with other source edits held. It built `civilian-flight,civilian-fpv,fpv-worlds` twice, checked original inputs against the committed tree, admitted in-memory and written artifacts, and finalized a new output directory. A separate read-only admission call then passed against the finalized files. No substitute publisher or modified access fixture was used.

| Package             | Admitted files | Admitted bytes | Distribution ZIP bytes |
| ------------------- | -------------: | -------------: | ---------------------: |
| Civilian flight gym |             94 |      3,741,611 |              3,755,295 |
| FPV Flight Studio   |            101 |      6,753,930 |              6,768,948 |
| FPV World Studio    |            160 |     17,438,478 |             17,464,488 |

These admitted totals include each generated manifest; ZIP sizes also include archive framing. All remain within the existing package policies.

## Comparison with the earlier candidate

All three distribution archives were independently unpacked in memory and compared with source `da0b0108206a0270b4b870e747f2d1bc0e6695cb`, envelope `4f4f0c78af851dfe5297097d87169b322f55704d85f6754b9ae12acb85b68926`.

Each package has exactly three changed members and no added or removed members:

- `optional-practice/{packageId}/guide.html`: updated shared player guide, from 21,725 to 23,443 bytes.
- `optional-practice/{packageId}/worker.js`: generated guide dependency size/hash and package revision argument change. Parsing the generated arguments confirmed that the worker executable body is byte-identical and `guide.html` is its only changed dependency descriptor.
- `optional-package.json`: regenerated package manifest, including source binding and hashes.

Every other distribution member is byte-identical. In particular, this guide update does not change simulator mechanics, controls, access-gate code or entry HTML. That comparison explains the scope of the update; it does not substitute for testing the new exact package revision.

## Evidence still required

The [final authorized browser observation](flight-practice-qualification-20261015/practice-real-restart-final-ff8bfbca35-20261015.json) refers to this exact envelope and passed all nine checkpoints. The original access gates remain intact. Its update/rollback uses a same-payload path fixture, not a distinct previous release; it does not close the human/device or remaining acceptance cases.

The eight generated review gates remain pending for each package: automated validation, content accuracy, asset/license review, keyboard/controller accessibility, installed isolation, update/rollback, same-device performance, and human learning/pacing. Do not infer physical-device, human-learning, installed-app or public-site qualification from reproducible builds.

No release allocation, version change, upload, release selection, hosting change or full-site capacity qualification was performed. Public catalogue population and the public player journey remain separate release conditions.
