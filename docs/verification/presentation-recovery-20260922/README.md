# Retained presentation integration — 22 September 2026

This is candidate evidence, not an accepted release.

The proposal combines PR252 `70d52504c92e94e5905716d195ebc48eb25d87a5` with the closed, unmerged PR233 `80a47a3b25167d9dcd0bdf98b1bde6a95d112269`. Recovery is applied once; existing PR233 descendants must move to its eventual accepted successor. No historical asset or release is replaced.

The reviewed runtime tree is `481f29d51df661503116f775c06de71d3e429ee3`. The corrected test and directly related maintainer guidance produce proposal tree `003818d5ca93a0eb225dbed2dc471bad2089d947`. This PR adds status documents and these evidence files after testing; those additions do not change runtime bytes.

## Qualification and retained failures

[The receipt](qualification.json) pins the complete original logs and identifies 130 passing checks per Node20.19.5 and22.22.2 across 15 complete affected files. The total combines 102 checks from13 unchanged files in r3,27 checks from the complete operation-focus file in r4, and the corrected session-only Next file's one check in the final run. Overlapping attempts are not added together. No tests in those full-file runs were skipped.

The r3/r4 failures remain in their original logs. Missing exact fixture inputs were supplied from the selected source. The remaining Next failure came from an obsolete two-picture manifest fixture rejecting newly required retained-theme preparation. Its correction uses a complete shipped manifest, replaces only the two diagnostic pictures, validates the resulting dependency closure, and pins the exact serialized bytes. Previous result retention, storage ownership, exact export and beforeunload assertions remain. New assertions check actual v5 visual adoption.

Independent review found no actionable runtime regression or weakened test guarantee. The corrected Next case exercises current-manifest preparation; archived-manifest fetching and fresh-origin restoration are separate coverage. Source hashes describe prepared files, not an instrumented list of executed reads.

## Remaining release gates

Choose the next unused version only after the coordinated parent release is accepted and the candidate is integrated against the selected main cutoff. Run all six exact-source gates, production reproduction, ordinary build, and the combined native v5 backup/export/restore journey. Then freeze original artifacts, deploy through the reviewed Pages selector and verify public bytes/play.

This packet does not establish physical-device, production-artwork, full-suite or public acceptance. Earlier PR233 native evidence remains attributed to its original source. Synthetic diagnostic PNGs are not visual-art approval.

## Historical native same-origin restoration follow-up (source `3563ef77344de3b7fa27263cefd90a38a4326be1`)

Exact source `3563ef77344de3b7fa27263cefd90a38a4326be1` passed an ordinary First Signal win → direct Next → Relay Orchard pause → v5 game-data export → Keep → deliberate Replace → Load paused → Undo → reload → explicit Continue journey at1280×720. The visible post-load export retained the identical run, complete simulation checkpoint, picture pins, visual-theme pin and library. Undo focused enabled Export; title Continue explicitly resumed the retained flight.

[Native qualification](pr256-native-qualification.json) binds1,134 responses across405 paths, checked against exact source (with the installed Phaser4.2.1 bundle separately identified), zero mismatches and no observed console warnings/errors. The server is retained for reproduction. No simulation or storage state was injected.

This closes the scoped combined same-origin native path above. It does not establish fresh-origin original-media transfer, operating-system download completion, physical devices, offline operation or public release. The initial expected paused-Continue inspection observed running play because title Continue itself is the deliberate resume action; Library Load remained paused as required. The inline pause screenshot conceals the board intentionally and is not artwork approval.
