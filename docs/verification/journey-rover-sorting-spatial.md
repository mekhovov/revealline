# Sorting Yard — contested return lanes

2026-09-22. Explicit `sorting-spatial-1` candidate, not P05 acceptance, public
enrollment, Team qualification or human balance. Historical sources remain frozen.

## Design change

Sorting Yard previously permitted optimized Expert clears around 16–17 seconds
with one remote roamer never activated. This successor retains the broad central
foundation, both perpendicular returns, spawn, 76% target, no countdown and shared
pressure-v2 tiers. Four baffles and a second field keeper in each chamber prevent
the old broad-slice windfall. Two existing roamers now warn on the return stubs
from the start (tick 1), becoming active at tick 121. No per-map speed overrides,
forced waiting, mandatory bonus or new capture rule are introduced.

The decision is whether to take an outer slice, approach either side of a stub
around its baffle, or switch chambers before landing near its moving roamer.
Walls never count as a return. The central spine remains available for decisions.
The seven original picture revisions are reused without replacing their bytes.

## Evidence and limits

- Initial topology: two occupied field chambers (890/960 cells), one reclaimed
  network, 1,850 earnable cells, no empty remote auto-fill or geometry diagnostics.
- All three presets / both controls: ten-second idle observation is lossless;
  Up and Down close safely at seeds 1, 7, 19 and delays 0, 60, 240 ticks. These
  are opening samples, not delayed full-run qualification.
- Short side approaches reach both stub returns without loss. Head-on controls
  instead produce `enemy-player` contact with the corresponding roamer. This
  demonstrates avoidable danger, not merely an activation event.
- A valid same-geometry counterfactual removes only the two added field keepers.
  Up/Down opening captures increase from 14/15 to 400/450 cells at unchanged
  denominator. Reduced windfall is attributable to retention, not roamer speed.
- Six ordinary and six optional-mastery public-input logs clear without losing
  a life or adding search wait commands. Every log has a pinned checkpoint,
  matching exported replay and equal independent Versus boards. Greybox and
  pictured simulation identities match. This does not establish ideal pacing,
  human difficulty, controller usability or enjoyment.

| Preset   | Ordinary Immediate / Grid | Mastery Immediate / Grid |
| -------- | ------------------------- | ------------------------ |
| Gentle   | 53.15 / 48.45 s           | 35.25 / 35.75 s          |
| Standard | 37.15 / 40.45 s           | 40.75 / 34.85 s          |
| Expert   | 38.05 / 38.65 s           | 37.85 / 37.95 s          |

These are optimized feasibility paths, not human duration estimates or evidence
that Expert is always slower to finish. Some late captures are small; quota
cleanup and route variety remain human/spatial review items. Do not pad them with
timers or claim a globally balanced curve from twelve paths.

The new optional goal means earning in both starting chambers and closing on both
stub returns after activation, without a loss. Its read-only test observer uses
the engine's accepted boundary ownership, not raw rectangle containment. Merely
awakening two roamers and filling both chambers is insufficient. All six mastery
paths close north at tick 162, south at 534 (Immediate) / 546 (Grid), then make
further cuts before winning. The first cut begins before activation and closes
afterward; the goal does not require every cut to start after activation. Ordinary
routes are not uniformly mastery routes, and no new reward is automatically awarded.

## Real browser check

At localhost 8846, fresh isolated Studio draft, native 1280×720 viewport:

1. Closed candidate library opens; searching `sorting` shows one of 31 entries,
   keeping edition selector with its existing Rover Inspect action.
2. Select contested sorting lanes and Inspect: feedback names seven inspected
   missions while applied Nearby Shore draft and checkpoint 1 stay unchanged.
3. Apply explicitly: seven-mission pressure-v2 source, visible speed multipliers
   1 / 1.4 / 1.75. Sorting selection shows six actors, four baffles, two retained
   regions and 1,850 earnable cells.
4. Exact Solo preview loads the original picture, three lives and 76% target.
   Genuine Start + Up input shows waking warning, secures the line at displayed
   0.8%, score 140 and all three lives. Pause confirms fresh-direction recovery.

No scripted state mutation or simulated native full clear. Physical controllers,
small screens, full human runs and public deployment are still pending.

## Scope distinction and next gate

Follow-up: [whole-spatial-v5 integration](journey-whole-sorting.md) adds the reviewed
map to normal Solo/Versus sequential play. Historical v4 remains unchanged.

The older middle-pressure report used a pre-teaching Split Berths source. Current
whole-variety already contains its earlier first-capture teaching successor;
do not redesign it based solely on that stale activation report. Its geometry is
unchanged here. Sorting is never silently substituted into `whole-spatial-v4` or
historical replays. Publish the explicit successor through the existing release
owner with candidate labeling, after navigation/persistence and technical gates.

Focused tests live in `game/test/rover-spatial-candidates.test.mjs`; public-input
fixtures are `rover-sorting-spatial-routes.json` and `rover-sorting-mastery-routes.json`.
Independent review found no production blocker after speed, fixture-inventory,
accepted-return and replay/race assertions were strengthened.

Verification: 122/122 tests pass on Node 20.19.5 and 22.22.2 across the new
Sorting/library cases, historical Rover teaching/preview/routes/mastery/timing,
picture-entry wiring and the existing whole-variety source. Sparse historical
media uses the read-only exact-commit fallback described by the worktree harness;
present production source always wins. Changed JavaScript passes ESLint;
changed code/new note passes Prettier; `git diff --check` is clean.
