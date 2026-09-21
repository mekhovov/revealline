# Courtyard Return: make both sides of the ring matter

2026-09-21. Explicit content-only successor on the retained Journey content lane.
Original factories, historical fixtures and public editions remain unchanged.
This is one revised mission, not ten new levels or completed P01 acceptance.

## Diagnosis

The original ring leaves 228 earnable cells inside and 2,012 outside (2,240 total).
The outside alone is 89.82% of the board, exceeding the 70% clear target.
Consequently an inward enclosure is not geometrically necessary. This is not
proof of an outside-only legal route: the four recorded 9.85–11.35s Standard/
Expert routes **do make inward cuts**. Their final outer cut claims 1,724–1,844
cells after trapping the outside keeper in a small eastern strip.

The goal is to give the two existing capture domains complementary value, not
force an arbitrary visit, add a timer or invalidate efficient play solely for
being fast. Keep the two keeper roles and the opening arc's existing rules.

## Explicit successor

`createHorizonSpatialCandidates()` compiles the pressure-v2 opening project with
only Courtyard's ring/spawn/design copy changed. Revision: `courtyard-spatial-1`.
Ring rectangles: (14,6,44,2), (14,28,44,2), (14,8,2,20), (56,8,2,20).
Spawn moves onto its left side at (14.5,17.5). Enemy coordinates, headings,
speed tiers, preset policy, percentage, controls, optional mastery and assets
stay unchanged. Other nine mission runtime manifests are equal to the predecessor.

The new field has exactly two retained components: 800 inside and 1,324 outside,
with one original keeper in each. No empty chamber or automatic fill is created.
Neither component alone meets 70%; a win must earn at least 163 inner and 687
outer cells. Earnable capacity decreases to 2,124 because the ring is larger:
there is no quota inflation, new objective, mandatory pickup or new terrain rule.

Counterplay remains choosing a departure point on reclaimed ring ground:
short outer bridges versus a long horizontal or shorter vertical inward cut.
The short left return is easier to reach; a straight right cut earns half the
courtyard. These are disclosed tradeoffs, not universally increased difficulty.

## Technical evidence

All six preset/control combinations survive ten-second idle starts and close
each of four independent seed1 departures without loss:
Left 162 ticks/13 cells, Right 498/400, Up 198/5 and Down 210/5.
Each uses public input and public replay; closure stops the craft normally.

| Preset   | Immediate | Grid + Buffer |
| -------- | --------: | ------------: |
| Gentle   |    14.55s |        16.65s |
| Standard |    17.65s |        18.65s |
| Expert   |    17.45s |        17.35s |

A Standard/immediate seed2 route with a 1.5s initial delay clears in17.85s.
All seven preserve lives, reconstruct matching public replays, and finish equal
independently simulated paired-board races. Real trail observations prove both
inward and outward closures, satisfying the unchanged optional goal rather than
inferring it from proximity to the ring. There is no bonus dependency.

Times include stopped waits: Gentle0/0.5s, Standard1.5/0.5s, Expert2/2s;
the delayed sample includes2s total. These bounded omniscient paths are still
short. They do not establish a human duration, minimum time, monotonically ranked
difficulty, enjoyment or full balance. Do not lengthen the mission with forced
waiting, visits or cleanup simply to reach a target stopwatch value.

Six suites pass **140/140 tests on Node20.19.5 and Node22.22.2**, no skips:

```sh
node --test game/test/horizon-spatial-candidates.test.mjs \
  game/test/horizon-spatial-routes.test.mjs game/test/horizon-candidates.test.mjs \
  game/test/opening-pressure-routes.test.mjs game/test/content-pressure-difficulty.test.mjs \
  game/test/pressure-route-probe.test.mjs
```

Original opening routes and factories remain tested. Changed JavaScript passes
ESLint/Prettier and the patch passes whitespace checks. Independent read-only
review confirmed the original route diagnosis, new domain capacities, keeper
placement and first-return counterplay without claiming human acceptance.

## Native authoring and remaining acceptance

Exact compiled JSON imported through C2 Studio Inspect import → Apply as a new
`horizon-spatial-review` project, checkpoint1. Existing Livewire checkpoints
remain separate. The editor shows 256 excluded foundation cells, 2,124 earnable
cells, two retained regions and no auto-fill. Actual Standard Solo preview:
Start → Right closes inward at18.8%, score4,000, with three lives. The screenshot
shows distinct inner/outer keeper fields and the widened ring.
Another fresh Right input closes outward on the perimeter at19.4%, score4,130,
still with three lives. Pause/Close preview returns to the saved draft. The long
idle interval used to inspect the interface is not a play-duration measurement.

This is a desktop first-return check, not a native full clear or physical-device
qualification. `artwork:true` retains all ten original asset bindings; no new
artwork or picture-backed native acceptance is claimed. The default remains an
explicit greybox through the shared compiler/Studio/runtime path.

Still required: human inward/outward comprehension and challenge evaluation,
whole opening-arc pacing (including Outpost and unused Remix landings), broader
seed/timing coverage, picture and device checks, whole-Journey enrollment,
release-owner integration, reviewed PR and Pages verification. Candidate presence
must not be reported as deployment or completed P01.
