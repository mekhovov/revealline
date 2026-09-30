# A/B/C implementation continuation — 29 September 2026

Parent PR761 head: `626cafc7d252375a8cc928e094aff74bb0c5456a`.
The user deferred production review. This source batch implements two bounded
remaining workflows; it does not adopt art, approve production slots, allocate
versions, merge or publish. PR757 carries the separate Team overflow improvement.

## B: learn existing encounters in the actual mission

Field Guide adds Optional scout, Optional sentry, Trail pursuit and Heading
interception. Validated effective mission rules decide whether Practice is
available. Copy distinguishes removable non-damaging scouts from ordinary
territory keepers, locked sentry aim from tracking, travelling shots from sentry
recovery, and pursuit/interception from other still-active attacks.

Practice clones the mission's exact effective rules, starting craft, recipes,
seed and steering policy; it restarts at spawn and never continues a paused cut.
No encounters are enabled implicitly. The existing isolated practice boundary
preserves the parent run and does not award progress. Edition-backed practice
reconstructs only the admitted mission, verifies normalized level/class equality
and carries a validated Guide-only seed. Controller Practice retains seed 1.
Stale source, changed mission, cancelled preparation, foreign audience and invalid
return identity fail without replacing the parent or Playground handoff.

Language switching previously replaced the select label's children and removed
the native selector. Localizing a caption span preserves the actual control.

**69/69 focused tests pass**, zero skipped/cancelled (`encounter-tests.tap`).
The six complete files cover the pure Guide/model, mounted panel, historical
parent host, actual admitted edition parent and child, deterministic checkpoints,
combined roles, no-awards/state preservation and invalid/cancelled handoffs.
Independent source review found no blocking defect. Actual edition parent/child
host tests establish modeled app behavior, not a physical browser/controller
or public journey.

Inherited fixture defects were reproduced against unchanged HEAD before repair:
`guide-head-start-failure.tap` and `guide-head-geometry-failure.tap`. The old host
sent movement before asynchronous Start completed and used a non-monotonic/frozen
performance clock through the controller echo guard. The fixture now waits for
actual running state and models neutral release/elapsed echo time. All former
cut/checkpoint/focus/music assertions remain. Corrected Immediate and Grid +
buffer cases pass against unchanged HEAD (`guide-head-fixture-check.tap`, 2/2).
The geometry fixture now declares its occupied span and verifies visible-body,
frame and contact sizes independently instead of assuming frame size equals
occupied size. `initial-guide-cohort.tap` preserves the earlier six failures.

## C/C6: compare a derivative with its exact retained parent

The optional .rlart panel now resolves the declared immediate parent from a
verified packet, displays exact IDs/dimensions/hash and offers Fit whole image
or Native pixels. Native mode uses one image pixel per CSS pixel in a bounded
scrollable region, without resampling bytes. Photo/pixel treatment is retained;
no relation is guessed from filenames. Only the selected file and optional parent
are decoded for display. Selection, import, cancellation, replacement and
departure retire stale work and release image URLs. Exported metadata/original
bytes and gameplay bindings are unchanged.

**28/28 focused tests pass**, zero skipped/cancelled (`artwork-tests.tap`): actual
mounted panel in EN/UK, exact identity text, view changes without extra decode,
failed/stale/cancelled/replaced parent ownership, byte-preserving export/import,
derivative validation and the real Studio static dependency collector. Scoped
lint, syntax and formatting pass. New game modules are included by the existing
whole-game collector; no redundant build configuration was added.

Native browser UI loaded the retained `ukrainian-pixel-scenes-r7.rlart` through
the ordinary picker at local Studio port 8808. The selected
`poltava-revised-r6-wide-r7` is 1152×576, SHA-256
`aaafaaca7ad1ee916ceeb04338690178a10314d6b735fcbe63fd565ec672ac30`;
its declared parent `poltava-revised-r6` is 1774×887, SHA-256
`6428a4d0f7d0e97c30cf565a68ae8bbc515c3de98343c34af2413cb200a5f07a`.
Measured native image CSS sizes match those exact dimensions inside separate
619×360 scroll frames. Fit and live EN/UK selection preserved the same identities
and bytes. The screenshot records the final source Fit view. This tests the
inspection controls, not cultural, pixel-art or production quality.

## Limits and next work

The two cohorts are separate; predecessor test counts overlap and are not a
unique programme total. No long suite, final integrated build, public release,
physical device, listening, full offline/performance, human fairness or
production approval is claimed. Those checks remain deferred, not passed.
The next implementation work remains full cross-mode encounter guidance and
cohort/runtime binding preparation; native artwork adoption and production review
resume separately. C2's formal human study remains last.
