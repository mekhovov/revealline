# Actual 2c Appearance producer: failed before package build

The [Appearance producer 39076889020](https://github.com/mekhovov/revealline/actions/runs/39076889020) for source `2c519bfe94b6364a57c71ba40b7212c71f0994ab`, tree `76f5c88845d0340ae27e13f5ab61b0c82a9ac1bf`, failed its required 118-file gate on 17 October 2026 at 23:42:47 UTC. The gate ran 41m24s within the unchanged 45-minute deadline: **1,733/1,735 passed, 2 failed, 0 cancelled, 0 skipped**. The full build and package upload were skipped. **No 2c package exists; the held 2c Next declaration cannot execute.**

The two exact failures are already covered by separate, reviewed test-only corrections in current tracked source:

- `immutable-presentation-fixture.test.mjs:239` treats the public bounded pending-read count as an array. The correction checks its integer/count bounds and compares it with the private fixture snapshot, preserving elapsed provenance and the 15-second deadline. Its complete two-file group passed 17/17.
- `title-visual-quality-host.test.mjs:148` exports diagnostics while Demo is active. The correction retains the active export rejection, observes actual submitted full-quality Demo paint, then uses the public interrupt before paused export. Its complete two-file group passed 5/5.

These source controls do not rewrite the failed remote result. No runtime fix or unchanged rerun was inferred from this failure.

All four independently bound prerequisite proofs passed: ordinary admission 159/159 (17 files), Team 354/354 (5 files), Demo 84/84 (6 files), installed 27/27 (1 file), all with zero skipped/cancelled/failed. Their exact source/tree, required policy, Node v22.13.1, command, complete file lists, TAP hashes and live artifact API bindings were verified. 149 exact executed Git input records were independently read. These prerequisite successes do not qualify the failed 118-file gate.

Retained evidence (ZIP-only for artifact members):

- Failed gate artifact12117998085:80258B, SHA256 `0b54921b2a6165133884d08b3f643e5f00ba3ce9940653bb15aedfeea2984986`; full CRC/hash-verified TAP402726B, SHA256 `22f4fb5541f9d10ab4157d1816261930ef8cbca440cbb9a9883ddac7b0b3bdb2`.
- Exact preview job117527014727 log758140B, SHA256 `aad76c628e0f02d47eef9e125828503fe5e14374e1fb266d81736d961fed216a`.
- Four proof artifacts: admission12117685734; Team12117870727; Demo12116474339; installed12116983250. All original archive/API metadata and complete member inventories are retained under `.cache/solo-followup/2c519bfe-package/`.
- Full analysis: `.cache/solo-followup/2c519bfe-package/failure-analysis.json`,16298B, SHA256 `9fe4a6d78398f39cd1abf5378ac0d69976ef33d0d775f3abd29efbb2eba6c0e7`.
- Source readback: `.cache/solo-followup/2c519bfe-package/failed-source-readback.json`,34996B, SHA256 `a4f8078af5d695185371bfac1dc4ff5ee6f702a72d47676be612de37c26bb716`.
- Current correction readback: `.cache/solo-followup/2c519bfe-package/existing-correction-readback.json`,1974B, SHA256 `e213129d1e4726704b4a0dcbd028624ae459b242242cf9a2a397984c8484135f`.

No production payload, local native browser/server, new workflow or native diagnostic was run. Later Library/runtime changes require their own source package and native observations.
