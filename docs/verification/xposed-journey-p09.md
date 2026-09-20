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

Playable scenario/pack transport, safe renderer projection and visible gate cues;
Studio gate/objective CRUD, copy-on-write and dependency-aware deletion; preview
and import/export round trips; new native observations; Relay Labyrinth greybox
decisions and route qualifications; preset/steering/seed/race/mastery checks;
original art and contrast; Team successor; human pacing; reviewed integration,
version allocation, immutable release and Pages acceptance all remain open.
