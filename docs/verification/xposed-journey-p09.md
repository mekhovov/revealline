# P09 Relay Labyrinth — implementation evidence

Status: isolated implementation candidate, excluded from the frozen v0.76 release.
No P09 release, Pages deployment, final artwork, human acceptance or Team relay
qualification is implied by these checks.

## Explicit editions and capture contract

`MapDesignV2` adds up to 32 named interior gate rectangles. `MissionDesignV2`
links each gate to exactly one existing capture objective through `relayLinks`
(`gateId`, `objectiveId`). One objective may operate several gates. Every gate
must be linked; dangling, duplicate and script/timer fields are rejected. V1
missions/maps are not silently reinterpreted. Shared geometry does not own
mission-specific objective identities.

Solo and equal paired-board missions resolve to level v6 / core v7 / replay v8 /
checkpoint `fnv1a64-state-v7`. Old editions retain their tuples and checkpoint
sections. Team requests fail closed pending their own explicit qualification.

Closed gates are walls, not return ground. They reserve non-scoring cells from
initialization, so their opening never changes the earned-coverage denominator.
After a valid capture awards objectives, linked gates become permanent reclaimed
connectors before anchor refresh. This is one idempotent transaction: no second
flood, fabricated cut, score, coverage, pickup collection or erosion eligibility.
Opening persists through life recovery; fresh attempts start closed.

Both WALL and SAFE are non-field. Opening does **not** join enemy-retained field
components or let field enemies pass. An empty remote chamber still fills at
an accepted closure; a gate alone does not retain it. These semantics preserve
the existing enemy-seeded capture contract.

## Shared inspection

Frozen-time capture inspection lists affected objective/gate IDs and reserved
gate cells without changing the board. It remains explicitly conditional on a
legal closure and current enemy positions.

Topology inspection expands gates optimistically from movement-reachable
objectives or initially empty remote regions. It detects a retained trigger
locked behind its own gate rather than assuming all gates open. Initial remote
auto-fill warnings remain visible even if that capture could unlock a route.
Reachability is not proof of a legal cut, solution, timing or enjoyment.

## Automated checks

The 11-file focused cohort passed 112/112 on Node 20.19.5 and 22.22.2:

- `relay-map`, `relay-core`, `relay-project`, `relay-diagnostics`;
- historical `foundation-core`, `foundation-transport`, `map-design`,
  `content-diagnostics`, `classic-core`, `classic-capture-stop`, `replay`.

Checks include overlap/occupant rejection, non-scoring reserved cells, remote
empty/retained regions, trail objectives, multiple links/objectives, ordering,
closed-wall collision versus open return, life recovery, fresh reset, mixed-tuple
rejection and authoritative replay tamper detection. Recovery/movement unit
fixtures explicitly arrange state to isolate the contract; they are not authored
mission playthroughs. Existing closure/contact tie tests remain unchanged.

Scoped ESLint and diff whitespace checks pass. Sparse historical fixtures are
read through the existing read-only exact-Git adapter, not fabricated locally.

All 59 existing P01–P08 Standard/immediate/seed-1 candidate routes retain their
exact simulation identities, no-loss outcomes and final authoritative checkpoints
on both Node versions. The compatibility reports are byte-identical, SHA-256
`bf2e01360e45d3fb089bdeedfd5f481cb93af5a968744ed107c101e58801fb45`.
This is regression evidence for the historical candidates, not new relay content
or a human difficulty benchmark.

## Remaining gates

Relay Labyrinth greybox decisions and route qualifications;
preset/steering/seed/race/mastery checks;
original art and contrast; Team successor; human pacing; reviewed integration,
version allocation, immutable release and Pages acceptance all remain open.

## Transport and presentation increment

Explicit `xonix-playground.v7` / `xonix-pack.v7` transport now preserves relay
definitions through Studio preview, prepared import, loose-map editing, scenario
selection and expansion export. Version mismatches fail closed; old outputs do
not acquire relay fields. Legacy equipment mastery remains unavailable for this
Classic-family edition. Deleting a linked objective is rejected before adoption.

A bounded detached relay display projection rejects malformed state and getters.
Gameplay, Studio and the map editor share closed crossbar/open corner patterns
inside the exact gate bounds. Open connectors have no opaque overlay. Terrain,
actor/contact cues and the foundation craft locator retain their compatibility
adapters without changing authority. Briefs, capture captions and Studio inspection
explain permanent return ground and the unchanged coverage denominator. These
are automated rendering checks, not native contrast or small-screen acceptance.

The nine-file transport/presentation cohort passes 92/92 on Node20 and Node22
(`relay-transport`, `foundation-transport`, `content`, `packs`, `playground-model`,
`mission-brief`, `content-capture-overlay`, `presentation-renderer`,
`renderer-readability`). Preview/Team/mastery/import/host regression coverage is
recorded separately; no physical controller or human clear is inferred.

The seven-file preview/Team/mastery/import/host regression cohort also passes
64/64 on both Node versions, including real modeled foundation host controls.

## Studio relay authoring increment

Authors explicitly enable the successor edition on one selected mission before
using its relay controls. Create, reshape, relink and remove validate geometry
and links together through the shared compiler. Both map and mission content
identities bind commands, so same-revision replacements invalidate stale forms.
Copy-on-write preserves shared consumers and old revisions. Removing a linked
objective reports its dependent gates; removing a gate does not delete its
objective or silently downgrade the edition. Removal requires two activations,
and edits or selection changes cancel the armed confirmation. Team is disabled
and compiler-rejected, not projected onto Solo.

Existing draft history/autosave/recovery/export remain the only persistence path.
The nine-file authoring/recovery cohort passes 59/59 on Node20 and Node22
(`content-relays`, `content-objectives`, `content-geometry-edit`, `content-drafts`,
`content-structure`, `content-studio`, `content-studio-empty`,
`content-image-authoring`, `content-recovery`).

## Scoped native authoring and gameplay observation

Exact source `38d7f3be94a6fd042735406c39d63bb6a303e52f` was served read-only
from Git on localhost:8794, independently of the user's existing browser origin.
The starter mission was edited through visible Studio controls: add a required
`first-relay` objective, explicitly enable the successor edition, then link a
2×3 `east-shortcut` gate. Eligibility changed from 2,355 to 2,349 at authoring
time. An overlapping replacement was rejected without adopting it; Undo/Redo
and checkpoint 6 reload restored the same gate, link and preserved map revisions.

Actual Solo Practice captured that objective on the first return to the island:
three lives, 0.6% earned coverage, 640 points (14 cells plus the objective), and
the opened connector caption. The gate changed from crossbars to corner brackets.
Closing and preparing a fresh Practice restored the closed gate, zero coverage,
zero score and uncaptured objective. No engine state was injected for this check.

This is one edited starter interaction, not a Relay Labyrinth mission clear,
multi-link readability test, physical-device matrix, timing benchmark or human
enjoyment evidence. Native deletion was not exercised; dependency and two-action
removal remain covered by the automated authoring tests.

## Lifecycle and link readability follow-up

A six-file cohort (`relay-lifecycle`, `relay-core`, `relay-project`,
`relay-diagnostics`, `sessions-continuous`, `sessions`) passes 45/45 on both
Node versions. New relay-edition fixtures cover timeout at closure, contact
before closure, independent equal paired-board clears, suspended closed/open
state and deterministic continuation, changed installed geometry rejection,
contour cache refresh, reclaimed-versus-field domain membership, stale erosion
requests and permanent connector anchoring. Topology tests explicitly arrange
state to isolate those invariants; paired races and session tests use real inputs.
Initial fixture errors (spawn clearance, anchor selection and path orientation)
were corrected without weakening the engine's established contracts.

Required linked objectives must be visible; this successor-edition restriction
does not reinterpret historical levels. Matching static numerals now identify
each trigger and its connectors in gameplay, Studio and the map editor. Numbers
are stable under gate reordering, support one trigger opening several gates,
and do not expose hidden optional triggers. Closed crossbars and open brackets
remain the collision-state cues. Text uses an outlined light treatment and no
flashing, color key or line across the active board. The five-file presentation
cohort passes 51/51 on both Node versions; native multi-link readability and
small-screen qualification remain open.
