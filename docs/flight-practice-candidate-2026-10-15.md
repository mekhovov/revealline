# Flight practice candidate — 2026-10-15

All three real packages pass frozen-source reproducibility and artifact admission. This is a **technical candidate, not a public-release approval or browser qualification**. Its generated review remains pending and `publicEligible` remains `false`.

## Provenance

- Source: `da0b0108206a0270b4b870e747f2d1bc0e6695cb`.
- Source tree: `69fac419ea9c23984d998b6da10ae5c9f1459e42`.
- Version: `v0.151.1`; base path: `/revealline/`.
- Immutable local output: `/Volumes/alex/CodexMigrationStaging/flight-practice-candidate-20261015.MVA2LZ/candidate`.
- Envelope SHA-256: `4f4f0c78af851dfe5297097d87169b322f55704d85f6754b9ae12acb85b68926`.
- Verification SHA-256: `4fffe5f1932607fe6f4cee92ad854de1fd174fff05173ca738512758107d7833`.
- Independent written-artifact readmission completed at `2026-10-15T04:12:44.045Z`.

The [machine-readable receipt](flight-practice-candidate-2026-10-15.json) records each package revision and distribution, manifest, source archive and source inventory hashes. The external path is local evidence, not a downloadable release URL. Retain the candidate until its checks and any eventual release review are complete.

The exact-source CI lookup found only pending Pages and auto-merge runs, not a completed optional-package candidate artifact. Therefore the existing bundle tool was run locally from the clean, frozen checkout. Other agents held tracked edits until the source checks and atomic output completion finished. Subsequent guide or observer edits are not included in these package bytes; a later package-source change requires a new candidate and evidence binding.

## Checks performed

1. Existing package preflight reported all three registered apps ready, with no errors. This development preflight preceded the clean build; its development revisions are not the release revisions below.
2. The existing bundle command built each real package twice and compared every emitted artifact byte-for-byte.
3. Original inputs were verified against the committed Git tree, and the source binding remained unchanged throughout compilation.
4. The existing admission validator checked the in-memory artifacts and the written files before the candidate directory was finalized.
5. A separate read-only call to that validator reread the finalized files and passed, including the ZIP inventories, artifact hashes and source binding.

```sh
node scripts/bundle-optional-practice.mjs \
  --out /Volumes/alex/CodexMigrationStaging/flight-practice-candidate-20261015.MVA2LZ/candidate \
  --base-path /revealline/ \
  --packages civilian-flight,civilian-fpv,fpv-worlds
```

For a repeat, use a **new** output directory and the same clean source revision. Existing candidate outputs must not be overwritten.

| Package                                 | Admitted files / limit |  Admitted bytes / limit | Distribution ZIP bytes |
| --------------------------------------- | ---------------------: | ----------------------: | ---------------------: |
| Civilian flight gym (`civilian-flight`) |                94 / 96 |   3,739,893 / 8,388,608 |              3,753,577 |
| FPV Flight Studio (`civilian-fpv`)      |              101 / 104 |   6,752,212 / 8,388,608 |              6,767,230 |
| FPV World Studio (`fpv-worlds`)         |              160 / 162 | 17,436,760 / 20,971,520 |             17,462,770 |

Admitted totals include the generated manifest; ZIP bytes additionally include archive framing. The small remaining file-count headroom is intentional evidence to recheck when dependencies are added, not permission to raise limits without review.

## Access and browser evidence boundary

Read-only inspection of each built entry found locked-state markup and the access-gate script reference. No package, access metadata, browser session or gate code was changed. The normal gate builds its form at runtime, so static HTML inspection is not a login test.

The user supplied an authorized test credential to the main workstream. Normal-form access and browser observation are being handled separately; a missing credential is therefore **not** asserted as a current blocker here. This build receipt does not record the credential or claim that login, flight, offline preparation or reopening passed. Pair any browser result with this exact envelope hash and its observer revision. Historical controlled fixtures with replacement test access metadata do not qualify this candidate.

## Remaining release gates

The generated `optional-package-review.json` still has all eight gates pending for every package: automated validation, content accuracy, asset/license review, keyboard/controller accessibility, installed isolation, update/rollback, same-device performance, and human learning/pacing. Successful build evidence can support review; it does not automatically approve any gate.

Before claiming the playable-release plan complete, collect the relevant source-bound browser and human/device evidence, including genuine offline relaunch, preserved records during recovery and updates, representative first flights, and the required accessibility/input coverage. Record partial results and limitations rather than upgrading them to full qualification.

No publisher, release selector, deployment or hosting-capacity mutation was invoked. Full hosted-site capacity and the public player journey are separate release conditions. This candidate does not itself populate the GitHub Pages catalogue.
