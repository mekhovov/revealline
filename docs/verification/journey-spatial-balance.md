# Spatial revision 2 — pacing study

Copy-on-write successors for Dnipro crossings, Four motor landings and Motor
feint. These are three revised encounters on two base layouts, not three new
maps. Earlier C1/D1 factories and their fixtures remain unchanged. No enrollment,
public release, Team qualification, final artwork or human balance claim.

## Design changes

- Motor: smaller offset landing pads, open frame-arm walls and asymmetric
  approaches replace the large aligned pads. The west keeper/interceptor moves
  out of the new wall. Counts, speed tiers, quota and warning/attack timings stay
  unchanged. Connect a landing through an inner aisle or circle a frame arm;
  the interception variant asks for a heading feint before that choice.
- Dnipro: stagger shore platforms and open breakwaters. A geometry-only iteration
  still cleared in21.35seconds, so it was rejected as insufficient pacing evidence.
  The revised study redistributes the southern keeper and adds one standard
  retaining keeper to the eastern approach; its threat-density annotation changes
  accordingly. It still combines only field retention and outer-perimeter patrol.
- Craft handling, preset catalogue and required coverage do not change. Walls
  remain obstacles, not return surfaces. Foundations remain permanent/non-scoring.
  No arbitrary waiting objective, timer, mandatory bonus or inflated quota is added.

Studio offers an explicit Original / Spatial revision2 selector for the existing
ornament/workshop and pursuit/interception Inspect actions. Original is the default.
Inspection still requires Apply; selecting an edition does not change a draft.

## Deterministic evidence

Focused spatial/C1/D1 regression cohort:58/58 tests on Node20.19.5 and22.22.2.
Changed JavaScript passes ESLint, Prettier and whitespace checks.

The route fixture covers all18 revised mission × preset × steering combinations,
seed1. Each freshly played Solo run clears without losing a life, verifies through
the public replay interface and finishes an equal, independently simulated Versus
race. Motor feint exposes warnings and committed interceptions in every combination.
Another three Standard/immediate routes use seed2 and an initial180tick/1.5second
delay. That is a small timing perturbation sample, not broad multi-seed qualification.

Each layout starts with one field component. Every reclaimed component has at
least four departures; intentional disconnected foundations are the only topology
warning. All nine revised map/preset stationary10second starts remain lossless.
Regression tests preserve older source objects, unmodified missions/maps, rules,
coverage targets, warning duration and Solo/Versus equivalence.

Searched seed1 clear seconds (immediate / Grid + Buffer):

| Encounter | Gentle | Standard | Expert |
|---|---:|---:|---:|
| Dnipro crossings |39.85 /55.45|36.05 /34.25|56.35 /68.75|
| Four motor landings |48.15 /61.45|55.15 /60.95|47.95 /48.35|
| Motor feint |35.85 /65.25|55.05 /47.95|45.95 /62.25|

Previous Standard immediate routes were25.45/22.35/18.75seconds respectively.
The delayed-start sample clears in45.85/55.15/54.95seconds, including the delay.
These bounded omniscient routes are **feasibility evidence, not minimum times or
measured human difficulty**. Geometry alters the search's choices; improved times
do not prove all shortcuts are removed. Faster enemies can still be easier to
isolate, so duration must not be treated as a monotonically increasing preset score.

## Remaining acceptance

- Dnipro Standard remains below the ordinary45second pacing aspiration in both
  steering modes. Motor's preset inversion remains an explicit review concern.
- Check whether outer-perimeter travel or late captures become tedious cleanup.
  Longer routes are not intrinsically better.
- Native exact-edition inspection/start checks, followed by broader seed/delay,
  physical-device, accessibility and genuine human route-choice/retry evidence.
- Human comparison against the original editions before selecting final layouts.
  Keep both available; do not automatically replace published maps.
- Original final art after greybox acceptance; AI soundtrack work stays paused.
- Reviewed integration, immutable versioned release and exact GitHub Pages proof
  remain with the release owner. This study does not alter the frozen release.
