# Island Outpost: make keeper position change the next decision

2026-09-21. An explicit candidate successor, not an enrolled mission or completed
P01. `createOutpostSpatialCandidates()` inherits the existing Courtyard successor
and changes only Outpost's northern keeper from (39.5, 8.5) to (11.5, 8.5), plus
the mission edition and design notes. All geometry, spawn, actor count/headings/
tiers, difficulty factors, controls, quota, scoring denominator and picture
bindings remain unchanged. Other nine runtime manifests are unchanged relative
to that predecessor. Original factories and historical replays remain intact.

## Diagnosis and design decision

The historical Expert 9.65–10.75s clears are not risk-free: their recorded metrics
include 816 ticks of exposure, with a 588-tick longest cut. Independent review
observed a keeper pass within approximately 1.53 cells of a live-trail cell centre.
That sampled centre distance is not collision clearance or a difficulty score.

The actionable issue is capture payoff from keeper clustering. Both keepers
start east of the island. In the recorded Expert routes, the second cut puts
both in a small eastern region, allowing most of the board to fill at once.
With one keeper west, those exact inputs remain legal and lossless, but their
two closures earn 49 then 19 cells (2.89% total), rather than an immediate clear.
This follows the existing seeded-fill rule, not a minimum-time or cut-count gate.

The short western bridge still offers useful choices. Starting with Left222,
Right222 and then Up198 ticks gives a 16-cell bridge followed by a 14-cell
line-only north return. Choosing Down210 instead earns a 317-cell second capture
with Immediate steering, 302 with Grid + Buffer. Both branches survive all three
presets and both controls without waiting. The nearby northern keeper supplies
the visible reason for the different outcomes; the empty southern enclosure
remains rewarding. The first Left, Up and Down departures also remain lossless.

There is a deliberate tradeoff: the initial straight Right departure becomes
lossless on Standard/Expert, whereas the original hits a keeper. Gentle's straight
Right still fails in the diagnostic sample because of its different keeper phase;
the successful Gentle route repositions on the island first. This is not a
universal increase in hazard, nor proof of a monotonically harder preset curve.
Moving the keeper closer at x15.5 was rejected because it newly punishes immediate
Up departures; breaking old paths is not the design objective.

[TowerFall's creator interview](https://blog.playstation.com/?p=126340) describes
spatial positioning and additions that make players change strategy. Our
application is to vary capture decisions using the existing two keepers, not add
another mandatory mechanic to this learning arc. That is a design inference,
not evidence that a longer route is more enjoyable or “addictive.”

## Technical qualification

Eight fresh public-input routes clear without loss, reconstruct public replays,
and finish equal independently simulated paired-board races. All physically
reach both western and eastern perimeter return boundaries, meeting the existing
two-side optional mastery; linkage alone is not counted as a visit. None collects
a bonus. No runtime state, positions, lives or effects are injected. Null inputs
are checked to occur only while stopped and not cutting.

| Preset   | Immediate seconds | Grid + Buffer seconds |
| -------- | ----------------- | --------------------- |
| Gentle   | 36.05             | 21.45                 |
| Standard | 27.65             | 37.15                 |
| Expert   | 29.65             | 30.15                 |

The Standard western-first alternative takes34.45s; a seed2/1.5s delayed sample
takes37.55s. These are bounded omniscient searches, not human duration estimates
or optimality proofs. Explicit stopped waits remain: Gentle Immediate8s,
Standard Grid8s, both Expert routes2s, western-first8s and delayed sample9.5s
including its initial delay. No waiting, cleanup or minimum duration was added
to the actual mission. Wider timing and human pacing acceptance remain open.

The new25-test packet checks immutable neighbours/maps/assets, exact runtime
diffs, all six idle/short-departure and north/south branch configurations,
historical fast-route consequences, and the eight full-clear/replay/race/mastery
cases. The combined165-test opening/spatial/pressure cohort passes on
Node20.19.5 and22.22.2. Independent review repeated all25 focused tests on both
runtimes and all eight direct-engine routes. Lint, formatting and diff checks
pass. Review-requested exact fixture metadata assertions were added, and the full
165-test cohort passed again on both runtimes.

## Native authoring and remaining gates

Exact source JSON imported through Studio Inspect import → Apply in the separate
`horizon-outpost-spatial-review` local project, checkpoint2. The editor shows
both actual keeper positions,25 excluded foundation cells,2355 earnable cells,
one retained field and no automatic-fill cells. It displays the shared Standard
pressure-v2 policy and the unchanged62% target.

Actual Standard Solo preview: Start → Left closes the western bridge, shows0.7%
reveal/160points and retains three lives. A screenshot confirms the stopped craft,
island connection and distinct keeper positions. Pause/Close preview returns to
the saved draft. Time spent inspecting the interface is not play-duration evidence.
This is a keyboard first-return check, not a native full clear or physical-device
matrix. The preview is explicitly a greybox; retained optional original-picture
bindings are not a new artwork validation claim.

Still required: human route/line-only understanding and retry enjoyment; wider
seed/timing and whole opening-arc pacing; final picture and controller/touch
checks; whole-Journey enrollment; release-owner integration, reviewed PR,
immutable version and verified Pages. The original public edition is not replaced
by the presence of this candidate factory or a local Studio draft.
