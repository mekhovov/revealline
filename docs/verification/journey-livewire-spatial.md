# Afterglow: geometry that keeps both sides contested

2026-09-21. Explicit content successor based on the retained content lane
`7d1f99dda110090de447d37e7bd5560137ad7c58`. No runtime/host/release changes.
This is one revised mission, not seven new maps or completed P08 acceptance.

## Verified problem

The existing stronger-pressure Standard/immediate route cleared Cross the
afterglow in 17.05 seconds. Its four cuts reached 85.12%; the second, at x25,
captured 822 cells because the horizontally moving keeper had travelled east
beside the stationary emitter's region. All landings linked as a consequence,
so the optional goal did not ensure the intended west/north route lesson.

Related unchanged maps still need separate work: Switchyard's second cut captured
1,385 cells at 13.15 seconds; Split junction's seven-cell east connector captured
561 cells at 4.45 seconds. These are exact observed routes, not proven minimum
times or measured human difficulty. The original fixtures remain unchanged.

## Revision and causal evidence

Add two wall rectangles: `(24,3,2,12)` and `(24,22,2,11)`. The lower wall redirects
the original horizontal keeper, keeping it west instead of allowing it to join
the emitter in the east. The upper/lower passages and central y15–21 aisle stay
open. West and north landings offer distinct first returns.

No enemies, speed tiers, attack clocks, warning duration, quota, terrain,
foundations, spawn, mastery, bonus or mandatory objective changes. The other six
Livewire missions are unchanged. Enemy roles remain emitter, keeper and frontier
patrol. Claimed-cell capacity decreases from 2,272 to 2,226 because of the walls;
the 79% quota was not inflated. Walls never become return surfaces.

A causal regression deliberately cuts **beside** the wall rather than colliding
with it: Standard/immediate/seed1, `down ×216`, `left ×108`, `up ×420` ticks.
The first closure earns 14 cells; the next earns only 34. Two regions remain:
776 cells retained by the keeper and 1,402 by the emitter. Public replay matches.
This checks retention geography, not merely failure of the previous input script.

Both west and north first returns are lossless across all six preset/steering
combinations. Ten-second stationary starts are lossless. Initially there is one
anchored field component, no automatic fill, and four usable reclaimed components
(three authored landings plus the perimeter). Disconnection is intentional.

## New route evidence

| Preset   | Immediate | Grid + Buffer |
| -------- | --------: | ------------: |
| Gentle   |   46.25 s |       44.85 s |
| Standard |   52.95 s |       45.25 s |
| Expert   |   53.35 s |       44.75 s |

Six seed1 routes and one Standard/immediate seed2 route with a 1.5-second initial
delay clear without loss. The latter takes 55.85 seconds including delay. All
seven satisfy the unchanged optional goal, reconstruct through public replay and
finish equal independently simulated paired-board races. Ordinary completion has
no pickup dependency: this mission contains no bonuses.

The bounded route search is omniscient and time-budgeted, not an exhaustive
shortest-path search. Different presets may produce faster routes. These numbers
do not establish a minimum duration, monotonically ranked difficulty, absence of
all shortcuts, or human enjoyment. Further seed/delay coverage remains open.
Recorded times include voluntary null-input waits: Gentle 5.5/9 seconds,
Standard 8/0 seconds and Expert 10/3 seconds (Immediate/Grid + Buffer).
The Standard/Grid + Buffer clear contains no wait commands; the geometry has not
introduced a mandatory waiting objective. Extra elapsed seconds are not all travel.

Fixtures: `livewire-spatial-routes.json`, `livewire-spatial-delay-route.json`.
Regressions preserve original authoring and original stronger-pressure routes.
The final five-file cohort passes **80/80 tests on Node 20.19.5 and Node 22.22.2**,
with no skipped or cancelled tests. Changed JavaScript passes ESLint and Prettier;
the patch passes whitespace checks. Local final logs are
`.cache/afterglow-final80-node20.tap` and `.cache/afterglow-final80-node22.tap`.
Run:

```sh
node --test game/test/livewire-spatial-candidates.test.mjs \
  game/test/livewire-spatial-routes.test.mjs game/test/livewire-candidates.test.mjs \
  game/test/content-pressure-difficulty.test.mjs game/test/livewire-pressure-routes.test.mjs
```

## Native workflow evidence

Imported the exact compiled successor through normal Studio file import on the
reviewed C2 host `f2bef7fd`, port8832. Inspect left the existing draft unchanged;
Apply saved a new `livewire-spatial-review` project. Selected Afterglow, checked
the 2,226-cell denominator, actor timings and frozen capture overlay, then used
Play exact Solo preview → Start → Left.

The real preview showed the two wall sections, clear central aisle, west landing,
moving keeper, frontier and vertical warning lane. The first closure stopped the
craft at 0.6%, score140, with all three lives. Pause and Close preview returned to
the draft. Inspection idle time is not pacing evidence. This is desktop-browser
first-return evidence, not a native full clear, physical-control or human test.

## Authoring, integration and remaining work

`createLivewireSpatialCandidates()` compiles through the shared project/map/actor
registries. Its default is an explicit greybox; `{artwork:true}` retains the seven
existing original Livewire asset revisions and mission bindings. This does not
claim seven new pictures, picture-backed native qualification or new final art.
Normal Studio import/validation/preview works without another editor or hidden
runtime entry. Original projects, checkpoints and published editions stay intact.

Independent read-only review confirmed the causal retention change and warned
against treating duration alone as acceptance. Human comparison, broader native
and physical-device checks, any art adjustment, final whole-Journey adoption,
reviewed release integration and GitHub Pages verification remain open. This
packet does not modify the concurrent C2 or v0.79 release-owner work.
