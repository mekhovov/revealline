# Team changing-return spatial study

Local, unvalidated candidates only. This implements two explicit map successors,
not a published replacement, new Team rule or human balance signoff. Design:
[return-network specification](../superpowers/specs/2026-09-21-team-roamer-spatial-study.md).
The historical [twelve-mission pressure audit](journey-team-pressure.md) and all
of its failures/mastery misses remain intact.

## What changed

`createTeamRoamerSpatialCandidates()` produces one two-mission campaign and pack,
revision `return-network-1`, using the shared pressure-v2 compiler and TeamMissionV3.
Player speed10, measured keeper/roamer tiers,120-tick wake warning,74%/76% coverage,
no timers/bonuses/objectives and the original spawn islands remain unchanged.
Old maps, picture pins, default enrollment, runtime and shared hosts are untouched.

- Shared Lookout: one central landing, two staggered baffles, diagonal keepers,
  and a dormant roamer on the short western outside return. The alternative is
  to connect inward before waking that return's patrol.
- Twin Depots: two inner landings and baffles, two retaining keepers per chamber,
  and one dormant roamer per outside return. The actual increase in keeper
  density is reflected in the authored difficulty facets, not a hidden speed.

All six manifests compile without errors, export/import exactly, match Studio
geometry and count only earnable field. Each starting field component is occupied;
roamers do not retain it. All craft remain untouched during five seconds of
stationary spawn inspection. Candidate/unconnected-foundation warnings remain
truthful. Solo/Versus fallback is rejected, not silently substituted.

## Fresh feasible routes and their limits

| Map            | Preset   | Optimized clear seconds | Self returns | Active before finish, ticks |
| -------------- | -------- | ----------------------: | ------------ | --------------------------- |
| Shared Lookout | Gentle   |                   45.66 | 3 +4         | 5232                        |
| Shared Lookout | Standard |                   36.84 | 4 +2         | 4174                        |
| Shared Lookout | Expert   |                   29.65 | 2 +4         | 3311                        |
| Twin Depots    | Gentle   |                   26.35 | 4 +2         | 2879 /2716                  |
| Twin Depots    | Standard |                   35.85 | 5 +4         | 4019 /3856                  |
| Twin Depots    | Expert   |                   29.42 | 5 +4         | 3247 /3084                  |

All six logs clear without knockdowns and meet the existing optional mastery in
all four joint-cut/seat-label configurations:24/24. Labels reverse both spawns
and commands; this is not a different physical strategy. Search took28.448 seconds
under an eight-minute cap. Accepted logs use only fresh public run/step commands;
null-input braking is rejected. No state, speeds, geometry or warnings were
altered to force a successful replay.

Every roamer warns for exactly120 ticks and is followed by an observed departure
from its initial horizontal lane and a later self-return by that craft. Twin's
western departure occurs1.99/1.58/1.23 cells from the active patrol on
Gentle/Standard/Expert. Shared's departure is5.24–5.58 cells away; this is not a
claim of a close or necessary escape. Proximity counts may include stationary
craft. These are descriptive observations, not reaction-time or fun scores.

Additional30-tick departure probes pass20/24. Twin Expert fails all four at
completed tick1425/event1424: `inner-keeper-2`, enemy-trail. The unsuccessful first
Twin Gentle prefix stops at639 ticks with both roamers active but only8.32%
coverage. Both failures remain pinned and tested.

Five optimized clears are under45 seconds. All six successful paths alternate
active seats; none uses Support or a joint cut. Conservative ownership tracing
finds only one reused partner-owned cell in Shared Standard and ten in Twin
Expert, zero in the other four. Joint/assisted batches are deliberately not
assigned to a single craft. This is insufficient evidence of useful shared
network play, much less human enjoyment. Inner-landing reuse and complementary
live cooperation remain open; do not lengthen routes with quotas or idle filler.

## Alternative openings and old-route comparison

All six presets also have an inward-first opening in all four variants:24/24
safe connections from a spawn island to an added inner landing, with a real
self-return and all roamers still dormant. The connection is initially absent
and is checked through four-neighbor SAFE-cell reachability after the return.
It is not a perimeter connection or full clear. Shared completes at306/462/372
ticks, including respective initial waits0/120/30; Twin completes at402 with no
initial wait. Eight rejected inner approaches retain exact first-down evidence.
All examples use the physical western spawn, including relabelled-seat tests;
Twin's eastern inner approach and subsequent landing reuse are not yet qualified.

The selected historical pressure routes are replayed unchanged at new geometry,
also24 configurations. Shared Gentle ends incomplete at3970 ticks and27.68%
with its roamer active. Shared Standard/Expert hit that roamer at1717/648.
Twin Gentle/Standard/Expert hit `roamer-2` at662/553/499, with both roamers active.
All five collisions are enemy-player, not trail impacts. Old-route failure is
neither an acceptance requirement nor proof of general difficulty; fresh
successful alternatives above show these maps are not made impossible by it.

## Native authoring and partial play

The normal Studio file chooser imported the new factory's source, inspected it
without altering the previous Team draft, then explicitly applied into its own
`team-roamer-spatial-review` slot, checkpoint1. The workbench showed one pack,
one campaign, two missions, correct Expert identities and geometry. Shared had
one retained component; Twin had two, with no unintended empty auto-fill. The
actual simulation identities were `e6a365a07e3c9dbf` and `fc9a2baa6c83b001`.

The shared compiler's Expert campaign export was imported in the real Team
player. Start remained explicit, the two arenas selectable and the roamer
footprint/warning/domain explanation visible. Shared's outside first-return
attempt reached0.7%; before the delayed tool-issued upward departure, Sunflower
lost the one reserve and recovered. At paused0:06, the tracked body and `ROAMER`
label were visible on the western return. This is a real native failed partial
attempt, not a no-loss clear. The one-second `WAKING` transient was not directly
observed and must not be claimed as visually qualified. Recovery caption says a
reserve was used but does not name the impacting enemy; cause readability remains
an integration/human review item. Browser-tool latency is not player reaction time.

Host source remained pinned to `3c040da15822ad16504e7c5d4a8dfb7b7c9096b3` on
port8824; new geometry entered only through normal import, not a source override.
Studio HTML/module, compiler, Team adapter, core, roamer engine and Team HTML/host
served bytes matched Git. Console warning/error logs were empty. Muted desktop
only; generic test scenery is not new authored artwork. Native Twin play, full
clear, controllers/touch, two-human play, art, warning/readability and Pages
acceptance remain pending.

## Verification and next gate

Three dedicated suites cover119 tests: schemas/geometry,24 fresh clears,
24 delayed outcomes, partial/invalid-input guards,24 old-route comparisons,
24 inward openings and eight rejected probes. Independent review approves the
candidate with the above design limitations.
The full targeted pressure/roamer/foundation/export regression cohort passes472
tests on each of Node20.19.5 and Node22.22.2. Formatting and scoped ESLint pass.
Exact event/state checksums are
local deterministic traces, not the official exported Team replay format.
No seed-diversity claim: these Team actors do not consume movement RNG.

Next: verify useful landing reuse and human route choice/cooperation; inspect
warning/impact feedback on real devices; qualify art and pacing; then coordinate
accepted-baseline release adoption. This local study does not close P14/P15 or
mark the original17 optional-mastery misses solved across the whole Team library.
