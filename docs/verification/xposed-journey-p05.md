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

Historical route regression follow-up: the four-file Rover/Horizon/Border cohort
passes48/48, zero failures/cancellations/skips,34.986seconds on Node20.19.5.
This includes60 opening Solo routes,60 equal paired-board routes,84 Border Solo
routes and84 equal paired races, with their existing identities/checkpoints and
real-host foundation closures. Initial local runs reported missing tracked
fixtures and presentation/motion modules in the sparse checkout, not gameplay
assertion regressions. Exact HEAD files and their sparse patterns were restored;
no production logic or route expectations changed to make the cohort pass.

Independent review found that a missing project actorCatalogId could accidentally
use the standalone helper's legacy default. The project boundary now requires an
explicit registered ID before lookup. Missing/null/empty/unknown/prototype-like
values fail closed for Solo, Team and v2 roamer drafts; intentional standalone
legacy calls and owned compiled-project reuse remain unchanged. The initial
regression assertion mismatched catalog/catalogue spelling; only that test matcher
was corrected. Three authoring files pass23/23 in1.664seconds. The post-fix
Rover/Horizon/Border route cohort passes49/49 in47.399seconds, with zero failures,
cancellations or skips, Node20.19.5. Lint, formatting and diff checks pass.

## Authored greybox checkpoint

Six core maps and one optional Remix now form two three-mission learning arcs.
The first introduces reclaimed roamers; the second combines already-known
frontier, terrain and return-network choices. The final Neon core and first Rover
core share band5; later Rover maps reach band6 without changing player physics
or measured actor tiers. Each mission has its own route decision, lesson,
counterplay, capture consequence and optional mastery hypothesis. Six numbered
reference adaptations retain original hashes and non-final dispositions in
`../research/rover-reference-crosswalk.md`.

All42 mission/preset/steering combinations have legal no-loss full-clear input
fixtures with public replay verification. All42 paired-board repetitions finish
equally with independent terrain/foundation buffers. All42 first-return checks
and five-second initial idle checks pass. Empty auto-fill regions are absent;
only field keepers retain field, not dormant roamers. Studio's inspect-only
Rover button and CLI use the same manifests, catalogue and advisory pacing
projection; neither applies edits or publishes candidates automatically.

Two unpublished layouts could clear before encountering an active roamer.
Their exact inputs/identities/checkpoints remain reproducible negative evidence.
Stepped return and Broken yard revision2 place a warned roamer on distant broad
foundations. New checks retain safe spawn distance and existing120actor-tick
activation. No quota/speed change or new mandatory objective was introduced.
Sorting yard remains a short omniscient feasibility route with both roamers
activated, not a measured human-duration claim.

The three greybox/preview/route files pass22/22, zero failures/cancellations/skips,
33.513seconds on Node20.19.5. Changed-source ESLint, Prettier and diff checks pass.
This is an independent source candidate, not a hosted gate or released campaign.

Native initialization follow-up: the pinned abe8dc81 Studio remained on its
opening message because actor-role population read the session during editor
construction. This is a real P05 startup defect missed by immediate-source unit
fixtures. Role population now waits for the owner's post-adoption sync; controls
start disabled. A deferred-session fixture reproduces the actual lifecycle.
Actor/catalogue/preview files pass20/20 in11.681seconds, zero failures/skips,
Node20.19.5. Native re-verification remains required after the correction.

Remaining: optional-goal alternatives, broader historical route pins, native Studio/game
inspection, spawn/timing/escape-corridor tuning, original pixel artwork, purposeful
Team mission, human balance/comprehension, final-source hosted gates and reviewed
release/Pages. This foundation alone does not complete P05.
