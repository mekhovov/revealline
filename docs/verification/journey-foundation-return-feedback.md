# Foundation-return teaching across Solo, Versus and Team

2026-09-21. Presentation successor to `ec54c681`, following the
[boundary-observation correction](journey-foundation-observation-correction.md).
No map, enemy, difficulty, physics, coverage, score, replay identity, release
version or published edition changes in this unit.

## Implemented

An accepted return onto an authored foundation now explains:

> Foundation reached. Close future cuts here; permanent reclaimed ground adds no coverage.

Solo preserves this alongside capture/terrain teaching when `capture.stopped`
adds the fresh-steering instruction. Versus has a separate caption for each
board, retained while stopped and retired on fresh movement, failure, race end
or replacement. Its fallback layout signature includes the caption's text and
visibility, so browsers without ResizeObserver refit before painting.

Team uses its accepted return cell and the same words. Joint/assisted banking
does not masquerade as a physical return. Only returning pilots own the hint;
an unrelated moving partner cannot erase it. A returning pilot's movement
retires the owned hint before processing new events. Later bonus, threat,
rescue or other messages revoke that ownership and are not cleared by it.

This is a non-modal explanation, not a new mandatory island objective or a
promise that reclaimed ground protects against every enemy. Solo/Versus use
directional boundary ownership, not widened rectangles or raw-point guesses.
Legacy moving closures and enemy-release fills do not generate return claims.

## Verification

Final reviewed 11-file cohort: **86/86 pass** on Node 20.19.5 and 22.22.2,
zero failures/skips/cancellations, both exit zero. Durations: 105,518 ms and
98,455 ms respectively. Files: foundation feedback, opening boundary
observations, foundation host, terrain feedback, Team import/recovery hosts,
candidate Versus host, Journey reaction host, flight-information host, and
board footprint unit/host suites. The existing read-only sparse-content shim
supplies missing tracked media from `daaef1facfe573cf13a7da2132ea8fd57aded898`;
working production files are never substituted in these final runs.

Coverage includes all three Solo presets and both steering policies; actual
Solo/Versus input hosts explicitly assert the selected turn policy. Tests pin
accepted-return events, no simulation mutation, per-seat presentation, pause
and movement, concurrent Team partner motion, and real no-ResizeObserver
retirement with unchanged score (fitted widths 600 → 500 → 600 for one board;
the other remains 600, with no steady-frame geometry polling).

The first broad run exposed a pre-existing Team recovery assertion expecting
“On safe ground.” A diagnostic loader pinned only the two changed Team source
modules to exact parent `ec54c681` and reproduced the same failure. The earlier
ground-vocabulary change `746ba0bc` already required “On reclaimed ground.”
Only the two stale expected labels were corrected; recovery behavior was not
changed. That diagnostic source override was not used for the final cohort.

Independent review found and verified fixes for fallback sizing and Team cue
lifetime/partner ownership. The final owner-seat regression also passed the
reviewer's independent targeted run on both supported Node versions. Lint,
formatting and whitespace checks pass.

## Native scope

Real local browser keyboard checks at port 8846, with no engine-state injection:

- Solo `whole-spatial-v4`: Nearby shore Down returned to its island with 0.6%,
  three lives and 140 points. The full return explanation and fresh-direction
  cue were visible; Right changed the message to exposed-line guidance without
  a dialog. Subsequent delayed traversal lost a life, so this is not a native
  no-loss full-clear claim or a pacing measurement.
- Versus same edition: only Sunflower moved. Its caption appeared with 0.6%,
  three lives and 140 points; Skyline retained zero coverage and no caption.
  Fresh Right removed the caption. Both boards remained playable and were
  left paused.
- Team: framework-generated Nearby shore geometry test imported through the
  real file picker, explicitly labelled preview scenery rather than authored
  artwork. Down returned with 0.6% and two reserves. The caption remained while
  Skyline moved down the outer perimeter; Sunflower's Right retired it and
  exposed a new line. No compulsory partner action or menu interrupted play.

Screenshots confirmed the explanation and unobstructed boards at 1280×720.
A requested 390×844 browser override did not change the actual document bounds
(still 1280×720); it was reset. **No compact/mobile validation is claimed.**
Native sessions were left paused. These are scoped keyboard checks, not physical
touch/controller, two-human, enjoyment or whole-campaign acceptance.

## Still open

Coordinated reviewed release/Pages promotion; compact/device and accessibility
qualification; human discovery of useful foundation routes; early optimized
clear pacing; later-campaign geometry, pressure, mastery and cleanup reviews.
This unit closes the missing return explanation, not P01 or the whole plan.
Original AI music generation remains paused.
