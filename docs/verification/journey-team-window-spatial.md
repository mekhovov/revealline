# Window Exchange — contested outer pockets

2026-09-22. Explicit `window-spatial-1` candidate, not a replacement for a
published edition or acceptance of P02/P14. Human balance remains pending.

## Cause and bounded redesign

The original production-start Expert pickup-free route finished at tick 1369,
before the first bonus expired at 1559. Its two large captures benefited from both
keepers drifting into the same side of each chamber. This was a spatial retention
problem, not evidence that every bonus needed a longer timer or every actor needed
another speed increase. Gentle/Standard routes also reclaimed future anchors or
left them outside the shared opportunity search.

The successor changes exactly two actor placements/headings:

- `west-lower`: `(8.5,28.5)`, heading `[0,-1]`.
- `east-upper`: `(63.5,7.5)`, heading `[0,1]`.

Outer keepers contest readable vertical routes beside the bonus pockets; inner
keepers retain diagonal routes around the existing shelves. All four keep their
standard field-retaining role and shared pressure-v2 speed. Maps, foundations,
spawns, handling, reserves, 74% quota, collision, bonus schedule and collection
rules are unchanged. Coolant/Depot runtime and pictures are unchanged. A trial
with four extra baffles was rejected: it removed usable opening returns without
solving the pickup-pocket problem. It is not part of this edition.

The original routes remain negative controls: they still clear the historical
source, but no longer clear this successor and cause no opening knockdown. All 27
sampled combinations of three outward directions per pilot across three presets
still establish both first returns. Rejecting an old optimized route alone is not
proof of good difficulty.

## Public-input evidence

`game/test/fixtures/team-window-spatial-routes.json` records nine full routes,
each replayed with both seat assignments and joint cuts on/off: 36 no-loss clears.
Production seed 17, one initial idle tick, ordinary direction commands. No state
injection, neutral braking, forced pickups or parked-wait segments. The helper's
read-only observations preserve exact simulation/event hashes; this is not an
official Team replay format.

| Preset | Pickup-free clear | First-window cooperation: contact / clear | Relocated contact / clear |
| --- | ---: | ---: | ---: |
| Gentle | 3937 | 1181 / 2861 | 3443 / 3769 |
| Standard | 3499 | 1046 / 4016 | 2678 / 3175 |
| Expert | 4477 | 551 / 2663 | 2882 / 5071 |

Times above are 120 Hz simulation ticks, not native performance measurements. Every
route has at least three real return closures per pilot and unchanged reserves.
The optimized clears remain about 22–42 seconds, below the authored 60–150 second
estimate; this is an unresolved pacing question, not an excuse to add waiting.

All cooperation routes contact the still-unclaimed first pickup while the partner
is cutting; the partner closes during the shared 720-tick slow. Relocation routes
instead prove genuine missed-window recovery: announce 239 → appear 359 → expire 1559
→ announce at the other anchor 2519 → appear 2639. Both the first window and recovery
contain meaningful earned captures. The second pickup is still field at contact,
and the collector makes a slow-active return. Those three recovery routes do
**not** claim a concurrently cutting partner. Expert may reclaim the first live
pickup before it expires; enclosure still grants nothing. Reappearance remains
conditional on an eligible anchor and the bounded appearance cap.

## Studio and uninterrupted player integration

The existing Shared windows library card gains an explicit edition selector,
defaulting to the old placements. Inspect prepares the new source without
altering the draft; Apply opens its separately identified project/history.
Original immutable pictures are reused without changing their bytes or pins.

The optional route is
`game/couch/relay-rescue.html?journey=team-window-spatial-1`, using its own
`team-window-spatial-1` profile. It keeps Window → Coolant → Depot, preset and
party, cross-campaign Next and two-activation Skip. Old shared-window and default
Team progress remain separate. The bundled player does not include Studio edits.

All nine logs also clear through the actual keyboard host with exact simulation
tick/coverage and pickup cue transitions. A pictured routed-host test proves
first-window cooperation, exact original image bytes, direct Next, Skip without a
clear, and nonempty valid old-profile isolation. The original three-mission host
sequence, failed picture retry and cancelled late preparation still pass.

Native in-app checks on the isolated local server:

- Search `outer pockets` finds one paired library entry; Inspect leaves Nearby
  Shore applied, then Apply selects the separate Window project and pressure-v2.
- The explicit pictured Team route loads and labels human validation pending.
  Real W/Down opening inputs bank 1.2% with both pilots back on reclaimed ground
  and two reserves; the unchanged shelf/foundation geometry is visually readable.
- Skip asks once, then starts Coolant directly at 0%; reloading retains Coolant.

These are bounded native observations, not a two-person session, full native
route replay, controller/compact-screen test or timing benchmark.

## Verification and limitations

The six-file regression cohort passes 218/218 on Node 20.19.5 and 22.22.2, including
36 successor route configurations and nine keyboard-host clears. Two subsequent
test-only hardenings pin the exact nine-row/full-options matrix and use a valid
qualified historical bookmark; both affected tests pass again on each Node.
Changed JavaScript passes ESLint and formatting.
All 13 snapshot/boot/build-guard tests also pass on Node 20, including unchanged
historical generated sources and refusal to replace a playable build with stale
or changed-after-validation content.
Sparse historical asset reads use the existing read-only fallback at exact source
`daaef1facfe573cf13a7da2132ea8fd57aded898`; present worktree code always wins.
No engine state is injected. Independent review found no production blocker and
separately verified unchanged pictured Coolant/Depot manifests.

Remaining: coordinated release/Pages verification, broader starts and timing,
short optimized clears and route discoverability, physical controllers, two-human
cooperation/enjoyment and accessibility. Other timed studies still need Depot
Gentle/Standard and reserve relocation qualification. This closes one specific
Window feasibility/integration gap, not whole-Journey balance or deployment.
