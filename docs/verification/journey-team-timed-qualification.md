# Team timed routes: mastery and alternate-start qualification

2026-09-21, successor evidence for the three unchanged
[Shared windows studies](journey-team-timed-studies.md). **Technical feasibility,
not human balance, new released content, or completed P02/P14.** No level,
geometry, physics, timing, quota, asset, host enrollment or historical edition is
changed to make these routes pass.

## What this closes

The committed original 18-family baseline and its 16 failed timing/seed probes
remain unchanged. New `TeamTimedRouteQualificationV1` evidence adds 15 families:

- Six base-start mastery families: Coolant crossing and Depot dash at each
  preset. This includes five newly authored full logs and the already-successful
  Depot Standard taking log, now explicitly checked against mastery.
- Nine alternate-taking families: each of the three missions at each preset,
  with seed 2 and a 30-tick delayed start. They collect the opposite first-window
  anchor, using a different approach, while the partner is cutting.
- Four seat/joint-cut configurations for every family: **60 no-loss shared
  clears**. Every pilot makes at least two genuine return closures. Openings have
  no joint idle time except the explicit 0.25s delayed-start probe.

Coolant's base mastery routes first wrap the lethal sump from the central
platform, then reclaim both slow beds. The sump is never entered while lethal;
all 168 authored terrain cells are reclaimed at the clear. The alternate lower
pickup route approaches the central island from beside the sump, rather than
blindly mirroring the upper approach through lethal ground.

Depot's base mastery routes activate both roamers and then continue playing.
All presets require at least one second of simulation with both active, plus
a new cut start and a real return from that cut after both activate, without
damage. This is stronger than observing two activated IDs at victory.

## Review correction retained as a negative example

The first new Depot Expert proposal activated its second rover during the
winning tick. Independent review identified that as activation-only, not evidence
of play against both threats. The final route uses two early, smaller enclosures
to wake the roamers before the main captures.

The rejected proposal remains in `terminalActivationProbe`, with four seat/joint
checks proving that its ordinary clear still succeeds but has **no cut started
after both roamers activate**. It is never counted as the stronger mastery pass.
Five earlier ordinary taking logs also remain explicitly non-mastery: all three
Coolant presets and Depot Gentle/Expert. No old successful clear was relabelled
to conceal its missing challenge interaction.

## Scope of evidence

| Family                     | Gentle seconds | Standard seconds | Expert seconds |
| -------------------------- | -------------- | ---------------- | -------------- |
| Coolant · base mastery     | 43.425         | 32.525           | 26.45          |
| Depot · base mastery       | 19.983         | 29.225           | 36.533         |
| Window · alternate taking  | 21.95          | 26.05            | 19.05          |
| Coolant · alternate taking | 47.675         | 33.3             | 32.65          |
| Depot · alternate taking   | 29.575         | 28.983           | 19.375         |

These remain optimized scripted durations. They do not establish human difficulty,
an increasing campaign curve, sustained close pursuit by each rover, or enjoyable
cooperation. Later continuation often alternates the active pilot. The Expert
alternate Coolant route does not neutralize every bed, and the Expert alternate
Depot route activates only one rover: those are ordinary taking clears, **not
alternate-start mastery**. Two sampled start conditions are not universal seed
or timing coverage.

The 70-test qualification suite checks the exact 15-family/four-configuration
matrix, state/event hashes, real pickup coordinates, partner cutting at contact,
effect-active return milestones, material cells, activation timing and subsequent
cut/return events. The helper observes state/events only; it never injects
positions, effects, pickups or repairs. Neutral braking is refused before any
step. The full combined 974-test regression cohort includes the existing 144 Team
ordinary cases, historical runtime/transport, timed Solo and actual host checks.
This is a local deterministic input log, **not an official Team replay format**.

All 974 combined tests pass on Node 20.19.5 and 22.22.2; lint, formatting and diff
checks pass. Independent review repeated the 213 focused tests on both runtimes
and directly verified all four revised Expert seat/joint cases. Both roamers are
active from completed tick 1604 through clear at 4384; four later cut/return pairs
occur in that interval. The helper's new activation and cut-start records are
read-only observations and do not alter engine state, events or existing hashes.

## Still required

1. Miss-then-relocate taking routes. The [reserve successor](journey-team-reserve-routes.md)
   now proves optional shared reserve contact across all presets/seats/joint
   settings, including a later first eligible window. It does not establish
   visible expiry followed by relocated collection. A further
   [Expert relocation route](journey-team-relocation-routes.md) proves that
   sequence for speed in four seat/joint cases; other presets/maps remain open.
2. Broader delayed-start sampling; alternate Expert mastery and robustness.
   The 16 original failures remain useful evidence that replaying a fixed plan
   against a changed opportunity is not an adaptive strategy.
3. Short-route/pressure inversion review, human pacing and actual complementary
   two-person play. No quotas, idle waits or extra lives were added as padding.
4. Actual new-map host/device/controller/recovery/accessibility checks and three
   original pictures after spatial interactions are accepted.
5. Coordinated integration, reviewed PR/version/immutable release/Pages audit.
   No publication or Journey enrollment is asserted by this evidence unit.
