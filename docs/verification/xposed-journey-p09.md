# P09 Relay Labyrinth — implementation evidence

Status: isolated implementation candidate, excluded from the frozen v0.76 release.
No P09 release, Pages deployment, final artwork, human acceptance or Team relay
qualification is implied by these checks.

## Original archive artwork continuation

Seven original Relay Labyrinth compositions are now pinned as opt-in candidates,
17,223,024bytes total in1774×887 opaque PNGs. Courtyards, connected pavilions,
separate conservation yards, circular stores, nested arches, a watchpost and a
blue-hour exchange give each mission its own composition. The Nested relays
variant was edited to remove decorative banner glyphs. Full prompts, exact pins,
inspection limits and pending gates live in
`../research/relay-original-art-prompts.json`. These are detailed stylized
environmental illustrations, not strict pixel art, copied references or collision maps.

The factory retains its unchanged greybox default. Explicit artwork opt-in and
Studio Inspect → Apply use the same immutable registry as packaging. No public
Journey enrollment, score/progress authority or publication permission is added.
The six-file art/candidate/relay-framework/registry/whole-library cohort passes
40/40 on Node20.19.5 and22.22.2, no failures, skips or cancellations, including all42
historical Relay clear checkpoints and498 whole-library manifests. Scoped
ESLint, formatting and diff checks pass. Native picture/gate-overlay observations,
broad-area/victory states, campaign actors/audio, devices, human qualification,
accepted-source integration and release remain separate open gates.

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

## Greybox content increment

Seven original Relay Labyrinth candidates now compile through the same registry
as Studio and CLI: six core missions in two three-mission arcs, plus one optional
Remix. The explicit Studio inspection action does not enroll them into the public
Journey or replace a saved draft without the existing apply flow. Four supplied
reference motifs have non-final proposals in `../research/relay-reference-crosswalk.md`.

The initial content/Studio cohort passes 24/24 on both Node versions. This includes
42 first-return/decision-space cases across all presets and steering policies,
public replay verification, visible trigger capture, fixed coverage denominator,
all initial field regions genuinely enemy-retained and exact CLI/Studio manifests.
The first return is not a full mission clear. Early full-route probes prompted
trigger and geometry revisions; no full-route fixture is qualified by this note.

Exact `88dfc52c5654bbeeb0cb206d5fe6a92b63c28a66` was then served read-only on
localhost:8795. Native Studio Inspect → explicit Apply exposed all seven missions.
Second approach's real Practice showed two numbered triggers and two matching
closed connectors. A normal keyboard upward cut captured only the western link:
three lives, 13 earned cells / 0.6%, score 630, Relay 1/2. The western crossbars
became reclaimed ground with brackets and its number; the eastern connector
remained visibly closed and its uncaptured trigger remained visible. Pause/Resume
and Close returned focus to Studio's Play action. No hidden engine mutation was
used. This is a scoped first-return/independent-link observation at the desktop
viewport, not a native complete clear or physical-device acceptance.

## Full-route feasibility and preset qualification

The committed `relay-clear-routes.json` fixture contains all 42 candidate × preset
× steering cases. Its 13-test cohort passes on Node20.19.5 and22.22.2. Solo routes
use the actual candidate attempt preparer, exact compiler/roster identities and
public replay verification; paired boards use separate mutable runs and finish
equally with no lost lives. Optional Remix remains outside core continuation.

Every recorded route opens each relay before the winning cut and traverses at
least one opened connector. All gate cells remain permanent, non-scoring and
outside the fixed denominator. No required objective remains outstanding when
coverage reaches the goal. This rules out the measured quota-first cleanup
pattern, not every possible uninteresting route or human pacing problem.

Five additional seeds (2,7,19,41,99) pass 210 no-loss/public-replay checks on both
Node versions. They are finite deterministic samples, not proof for all seeds.
The same Standard route did not transfer safely across every preset/steering
pair; independently searched legal routes are recorded instead of relaxing the
failure checks. Two initial probes also opened a late connector or never crossed
one. Replacement routes satisfy the stricter pre-victory/traversal assertions.
The solver never modifies gameplay state to produce a route.

Optimized fixture times are 18.95–55.25 seconds, below the authored 90-second
lower estimates. Those estimates are design targets, not observations. Retain
this discrepancy for human pacing review; do not infer boredom or add artificial
delays solely to make solver times match an estimate.

Seven authoring tests now additionally confirm manual image geometry preserves
V2 links/editions, trace-over-gate collisions reject atomically, duplicated
campaign missions retain their local links, and later edits fork only the copy.
Both Node versions pass. The shared renderer now projects relay display state
once per frame; no visual cache is allowed to become simulation authority.

## Delayed starts and optional-goal evidence boundaries

All 35 Standard/immediate routes after 0.5, 1, 2, 3 and 5 seconds of initial idle
now pass fresh-input/public-replay verification on both Node versions. These are
independently adapted legal routes, not a claim that the same commands survive
every delay. Each clears without a life loss, opens all relays before victory,
traverses an opened connector, keeps the denominator fixed and captures required
objectives before the coverage quota. The six-test delayed-route cohort is backed
by `relay-delay-routes.json`; it does not qualify arbitrary waits or other presets.

The test-only optional-goal observer now has six negative/positive invariant tests
on both Node versions. They reject tied/reversed order, pre-opening landing visits,
two openings on separate closures, several gates sharing only one trigger, unrelated
or departure-directed impacts, and unfinished/life-loss clears. The observer never
changes gameplay state or awards mastery. Full optional routes remain in progress;
ordinary clears and bounded search timeouts do not certify or disprove those goals.

### Spiral Stores optional-goal redesign

The initial proposal was “capture both relays in the same closure.” A four-connected
shortest-path inspection of the initial unclaimed field puts the two triggers 129
steps / 130 cells apart around the linked store foundations. This is not an
impossibility proof: later capture topology and indirect fill can change the problem.
It does show that the obvious direct approach asks for a long winding trail, against
this mission's stated lesson of using shortcuts instead of tracing every bend.
Bounded straight-cut searches did not qualify the original proposal.

The candidate now asks for both shortcuts within two consecutive captures and a
no-loss clear. This rewards deliberate relay ordering without an unrelated cleanup
capture between them; a genuine same-closure capture also qualifies. The observer
counts distinct linked objective IDs, never several gates from one trigger, and
negative tests reject intervening captures. Geometry, actor tuning, runtime identity
and ordinary clear fixtures remain unchanged. The candidate/ordinary-route/evidence
cohort still passes 29/29 on both Node versions. Human quality remains a hypothesis.

### Complete optional-goal feasibility matrix

All 42 mission × preset × steering optional goals now have no-loss full-clear
fixtures in `relay-mastery-routes.json`. The mastery/evidence cohort passes 13/13
on Node20.19.5 and22.22.2. Every fixture checks exact simulation identity and final
checkpoint, public replay, fixed denominator, real connector traversal, all relay
openings before victory and no quota-first required-objective cleanup. A distinct
evidence observer verifies the authored goal rather than trusting the route label.
The ordinary 42 clear routes remain separate and unchanged.

The Remix's first-return impact prefixes wait 15.95–20.9 seconds on reclaimed
ground for the carrier's approach, then make a real vulnerable cut and close while
a player-directed impact is active. All six routes subsequently traverse both
connectors; full times including that wait are 56.6–72.2 seconds. This establishes
an available interaction, not desirable human pacing. Ordinary completion never
requires that wait or the optional impact. Review whether a human can recognize
and use the same window during productive play before accepting this mastery goal.
Earlier greedy routes that opened their last shortcut only at victory were rejected.

Original background artwork, broader native/devices, Team, human validation,
integration, phase version/PR and release/Pages gates remain incomplete. P09 remains
local-only and excluded from the coordinator's frozen v0.76 candidate.
