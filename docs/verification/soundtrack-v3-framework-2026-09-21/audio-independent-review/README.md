# Independent audio functional review supplement

**No unresolved concrete audio blocker was found in this bounded pass after the
two corrections below.** This is a source review and focused-test result, not a
full qualification or release sign-off. It compares the evolving working tree at
`283685e050219af03ed221d8cce3c8e2c46a8077` against main baseline
`14298758fee0f7af08dd87376187568ada531d0a`, including the uncommitted Recording mode
and practice-test corrections. [review.json](review.json) pins the exact bytes of
26 reviewed source/test files.

The reviewer is independent of the primary player/Couch author, but previously
authored UA publication, archive/backup integration and portions of reference-only
recovery. Those portions are not claimed as a fresh authorship-blind review.

The pass inspected deck and object-URL ownership, cancellation of late reads and
play requests, scene changes, seek/fade/suspend/dispose, natural queue boundaries,
master volume, trusted menu gestures, explicit pause intent, and the separation
of music from gameplay reset/practice state. It also checked trusted-catalogue
permission enforcement across equal hashes, offline/export restrictions,
reference-only recovery, and refusal by older DB5 readers.

| Finding                                                                                 | Resolution and evidence                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2: practice preservation tests still required DB4 although the current host opens DB5. | Independently reproduced `5 !== 4`; the primary audio agent corrected only the expected version/message and migration test titles. The complete five-case file then passed independently, retaining simulation/profile/original-byte preservation assertions. |
| P1: legacy published fallback could bypass Recording mode.                              | The primary audio reviewer found and fixed it; this pass independently inspected the actual fix and panel apply path. The player excludes that fallback while Recording mode is enabled; regressions cover fresh, playing and paused transitions.             |

The two independent successful commands were:

```sh
node --test --test-concurrency=2 game/test/soundtrack-player.test.mjs game/test/soundtrack-v3-playback-recovery.test.mjs game/test/couch-menu-music.test.mjs game/test/soundtrack-rights.test.mjs game/test/soundtrack-reference-recovery.test.mjs game/test/soundtrack-source.test.mjs game/test/soundtrack-v3-compatibility.test.mjs game/test/soundtrack-master.test.mjs game/test/soundtrack-gain-leases.test.mjs
node --test game/test/practice-media-v3-host.test.mjs
```

The first passed **93/93**, the second **5/5**, both exit 0 with no skips. Recorded
source/test hashes did not change during either run. The practice test changed
between runs through the separately authorized correction. Exact argv, log hashes,
before/after source hashes and outcomes are in [the focused receipt](focused-test-receipt.json)
and [practice receipt](practice-after-command.json). The original failing practice
log is retained separately as [practice-before.log](practice-before.log): one
failed case and four deliberately name-filtered skips. No broad suite, heavy build
or render was run for this review.

The primary reviewer's messages also reported a broader host cohort with 118
passes and nine Team failures, “No exact Team picture binding,” while presentation
outputs were changing. Root identified admitted revision 38 versus ledger 40 and
assigned successor 41 plus a separate host rerun. This supplement neither relaxes
that guard nor closes Team qualification; it does not claim to have independently
run that cohort. The primary review artifact may add later results independently.

**Zero recording, listening, cultural, physical-device or publication approval is
given here.** The original, creator and UA-FPV public admission lists remain empty.
Modeled media/IndexedDB tests do not prove physical audio output, musical quality,
native persistence, a frozen artifact, offline behavior or CI/full-suite success.
The SHA-256 list identifies reviewed working files, not a frozen entire repository.
No runtime, generator or ledger file was changed by this review, and no commit or
version was allocated.

The completed [primary review](../audio-review/README.md) and its pinned JSON were
read after this pass. The audio recipe fingerprint was independently recomputed
from its four ordered source files as
`42509346fbac2c57c8f365dbb2fc8d9c30c9fb0b0110d7a63356c6273ee19f98`;
[related-review-supplement.json](related-review-supplement.json) records each constituent file hash and the later primary-review severity alignment. This fingerprint
identifies functional source and grants no recording or listening approval.
