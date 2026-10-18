# Verified aircraft reference — 18 October 2026

## Frozen implementation

Runtime `7d4e043d7a7a4ffa764189bee17c9b3259418e88`, tree
`da724cc1534c79c2eca3d037bda8173343f92c88`, extends the locally accepted
[split reference](fpv-practice-reference-20261018.md). This is an optional,
unscored visual aid for supported Academy/World static course practice. It does
not enable scored Advanced records or Regional course verification.

Course verification may collect initial and accepted aircraft poses through the
first completed mission tick. A presentation is returned only after the entire
remaining archive tail verifies. Capture failure does not invalidate independent
split verification. The owned, validated presentation holds at most 8,192 poses;
deterministic stride decimation preserves the first and exact last pose. CLI and
physical-only verification do not collect this optional data by default.

**Show reference aircraft** and **Hide reference aircraft** are separate from
split-reference selection. Both require the prepared configuration class and
terrain identity to match the complete course proof. A dedicated renderer group
uses recorded aircraft geometry, metre-valued centre-of-mass poses, orientation
and rotor directions. It has no collisions or shadows and holds the final pose.
The REF marker and localized explanation distinguish it from the player.
Reduced motion freezes decorative rotor spin; FPV overlap hides the visual.
Course/owner/recovery/selection changes clear it. Failed recovery preserves the
unchanged attempt. Optional allocation, drawing and cleanup failures cannot
escape into flight rendering; the UI reports a reference lost by the renderer.

Physics, rates, PID values, mission predicates, recording formats, flight hashes,
legacy personal-best ghosts and scoring remain unchanged.

## Independent review and automated evidence

- 42/42 source-pinned course-verification checks, including all fifteen aircraft
  in both modes. Captured raw COM/quaternion poses match the accepted original
  controlled flight. Existing historical, tail-tamper, cancellation and course
  rejection cases remain. The tool pins eleven selected source modules, not a
  claimed transitive dependency closure.
- 30/30 worker/collector checks, including transport, bounded collection,
  optional failure and complete-tail verification.
- 64/64 renderer/archive-control checks: all fifteen geometries, owned copies,
  long clocks, orientation, resource cleanup, legacy separation, EN/UK actions,
  independent split selection, lifecycle invalidation and injected failures.
- 7/7 catalog/projection checks and a separate AST/idempotence preservation audit.
- 19/19 exact package checks (10 optional, 7 native-fixture, 2 World), zero skips.
- Scoped ESLint, formatting and diff checks pass. The existing large host files
  retain their unrelated pre-existing formatting; only their explicit callbacks
  changed. Independent kernel, renderer/UI and package reviews found no blockers.

Logs retained outside the repository: `fpv-r11e-cli-42-committed.log`,
`fpv-r11e-kernel-transport-final.log`, `fpv-r11e-ui-renderer-final.log`, and the
source-bound package logs named by the qualification receipt.

## Packaging

The [exact receipt](fpv-practice-ghost-package-qualification-20261018.json)
verifies committed source inputs and actual emitted Academy bytes. Reusing the
already admitted immutable actor catalog removes 15,687 duplicated shell bytes.
The [preservation audit](fpv-shell-catalog-dedup-preservation-20261018.json)
records unchanged surrounding AST and shared definitions. No package limit or
policy admission changed. An earlier uncommitted storage-module alternative was
rejected because civilian-flight selected-source closure exceeded its existing
file cap; it is not in the delivered change.

| Package                         | Result                                         |
| ------------------------------- | ---------------------------------------------- |
| Academy original input          | 13,292,481 / 13,303,808 bytes; 11,327 spare    |
| Actual bundled Academy          | 13,067,554 / 13,107,200 bytes; 39,646 spare    |
| Academy selected source         | 151 / 151 files                                |
| World selected source           | 211 / 211 files; 18,672,462 bytes              |
| Civilian-flight selected source | 98 / 98 files; 3,795,720 bytes                 |
| Simulator-only native fixture   | 214 / 256 files; 19,012,237 / 33,554,432 bytes |

Packaging does not establish installed offline or native-device operation.

## Rendered checks and discovered limitation

The isolated World preview used the frozen runtime and the previously recorded
Meteor75 Self-level **Meet your drone** archive from 20:44:29.447 UTC. Course
completion verified at 14.48 seconds. Explicit Show/Hide worked independently of
split selection. The REF marker appeared in the Chase view at the recorded final
position; the current player could move separately. Ordinary pause retained the
selection. Retry cleared proof and both reference choices. EN → UK → EN retained
the paused flight, translated actions/help and preserved the selected splits.
This is final-pose/reference-controls evidence, not a recorded manual check of
every intermediate trajectory pose. No public-site data was touched.

During a later local attempt, autosave showed **Storage unavailable** at 15.98 s.
Restore exposed **The database connection is closing**. Failed recovery kept the
flight and selected reference unchanged. A subsequent retry and course check
reported **Aircraft archive was not found**, although its old entry remained in
the cached picker. No archive deletion, import or page reload occurred in this
sequence. The separately opened actual Academy package at port 8874 also showed
an empty archive picker where the preceding acceptance had a 3.88-second record.
No conclusion about eviction, disk pressure or root cause follows from these
observations. Captured browser warning/error logs were empty.

The actual emitted Academy package loaded all fifteen presets, prepared a
Meteor75 draft with motors off at 0.00 s and exposed the course/archive controls.
Its earlier incomplete-archive worker check could not be repeated because the
archive was absent. That is a limitation, not a passing persistence result.

The newly reproduced closing-handle defect is being addressed separately.
[Archive retention R13](fpv-archive-retention-followup-20261018.md) remains open;
reopening a stale connection does not prove preservation or recover missing
records. No further destructive cleanup is authorized by these tests.

## Fresh-context packaged positive check

A fresh local origin at port 8875 loaded the actual emitted Academy package.
A 93,018-byte archive labeled **SCRIPTED TEST — Meteor75 — Lift and land** was
imported through the visible file picker. This is an ordinary-input scripted
simulation fixture, not a claimed manual or real-aircraft flight. It retains the
original `flight-01/r1` objectives, default Meteor75 Self-level configuration and
a small 15 cm lateral target. Its [receipt](fpv-practice-ghost-fixture-20261018.json)
records independent complete physics/course verification and source hashes.

The actual browser worker verified completion at **5.66 s** and exposed splits
**2.16 / 3.50 s**. The matching draft stayed unarmed at 0.00 before explicit
Resume. With player throttle held at zero, the cyan REF aircraft visibly flew
above the pad while the player stayed grounded; the comparison was paused at
3.26 s. Hiding the reference removed it while keeping the independent split
choice. At 7.38 s the player had a durable 5.00 s checkpoint. Showing the reference
again and restoring that checkpoint succeeded, returned to paused 5.00 s and
cleared proof, both choices and unknown pre-recovery timings. No user archive or
setup was deleted or overwritten; this origin contains only new test data.

The separate centered scripted landing failed with absent contact telemetry.
Its evidence is preserved as P1 R20; offset fixture completion is not a workaround
shipped to players or proof that every landing works.

## Remaining release gates

Normal repository integration, hosted checks and deployed acceptance remain.
Rendered timeline/positive packaged reference checks above are complete using an
explicitly synthetic, unscored fixture. New R19 recovery-handle and R20 centered
contact defects remain separate P1 work; the retention negatives remain open.
Wider hardware, physical radio, pilot and measured-aircraft qualification remain
separate, deferred evidence gates. Neither this renderer nor replay agreement
establishes real-aircraft flight fidelity.
