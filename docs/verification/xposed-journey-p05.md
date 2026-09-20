# P05 — Rover Yard foundation preparation

Independent source branch `codex/xposed-journey-p05`, based on P04fe45d384,
not an accepted release baseline. Provisional version0.73.0. Root retains
main/tag/release/Pages ownership; prior phase gates are not bypassed.

## Explicit versioned actor catalogue

`journey-actors-v2` adds the existing engine's claimed-rover behavior as the
authored `reclaimed-roamer` role. The v1 catalogue remains immutable and the
starter/default projects remain pinned to v1. Shared compiler, Studio actor
controls, direct previews and mode adapters resolve the project's exact catalogue.
Unknown catalogue IDs and v1 roamer recipes fail closed; no implicit upgrade.

The new role moves only on reclaimed ground after a120actor-tick warning when its
full body is supported there. Dormant/warning actors do not damage the player,
do not move, and never retain an unclaimed region. Active roamers can hit body
and exposed trail, reflect inside reclaimed ground, and do not erode it. The
catalogue documents that reclaimed ground is a return surface, not universal
protection. These are the existing engine semantics, not inferred reference behavior.
Measured/standard/brisk speeds are1.6/2.2/2.8cells per second, adjusted only by the
shared deterministic preset. Player physics and historical runtime schemas are
unchanged. No new engine mechanic was added.

Studio offers the new role only under the explicit v2 catalogue in Solo/Versus.
It exposes heading rather than clockwise/contour fields, explains activation,
refreshes tier speeds with the preset, and rejects stale fields after catalogue
replacement. Team remains field-keeper-only: an unsupported role is rejected,
never silently replaced or called cooperative qualification.

## Verification and limitations

The first added editor test failed because it submitted empty coordinates before
reaching the stale-context check. The corrected fixture selects an existing actor
first, then changes the catalogue without synchronizing; the production stale
guard and validation order are unchanged. It also explicitly selects New actor
before testing a roamer addition.

Three complete authoring files pass22/22 in1.389seconds. The wider five-file
cohort (classic core/progression plus project/actor/roamer authoring) passes68/68,
zero failures/cancellations/skips,2.745seconds on Node20.19.5. Tests cover both
steering policies and all presets, exact120actor-tick activation, non-retention,
reclaimed-domain reflection, unchanged denominator/territory and public replay
verification. Existing v1 roles and representative compiled outputs stay exact.
Changed-source lint passes. These are technical checks, not human play evidence.

Remaining: authored Rover learning arcs/Remix, reference adaptations, full legal
routes and alternatives, broader historical route pins, native Studio/game
inspection, spawn/timing/escape-corridor tuning, original pixel artwork, purposeful
Team mission, human balance/comprehension, final-source hosted gates and reviewed
release/Pages. This foundation alone does not complete P05.
