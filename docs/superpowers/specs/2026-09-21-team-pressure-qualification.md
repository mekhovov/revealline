# Team stronger-pressure qualification

Status: independent specification review completed; offline verification slice.
No new Team mechanics, runtime editions, maps, shared host or release changes.

Use the existing shared pressure-v2 projection of all twelve Team candidates.
Preserve the five actual campaigns/packs and three editorial learning arcs.
The qualified roles currently vary movement speed only: keeper2.4/3.36/4.2 and
roamer1.6/2.24/2.8 cells/s across Gentle/Standard/Expert, craft10 cells/s,
shared reserves4/2/1, roamer warning120 ticks. Do not invent attack-rest effects
for actors that have no such cycle.

## Evidence contract

- Reproduce all existing fixture inputs against unchanged historical recipes
  before reuse. Check recorded terminal hashes where available. The older Signal
  test adds neutral ticks outside its route array: use the explicit opening JSON
  fixture instead, never silently transpose that test's abbreviated array.
- Twelve missions × three presets × joint-cuts on/off × normal/relabelled seats
  gives144 ordinary cases. Select one route per mission/preset that succeeds in
  all four settings, or report a bounded-search unresolved result.
- Only public two-seat input commands. Do not edit run state or enemy/terrain
  values. Refuse neutral commands that artificially brake continuous steering.
  Stop immediately at first knockdown; current reserves cannot conceal damage.
- Require both contributors, record closure reasons, actual joint events,
  Support uses, reserves, exposure, stationary time, first returns and mastery.
  Enabled joint-cuts is not evidence of an actual joint cut. Assisted closure is
  not a self-return. Relabelling seats/spawns tests symmetry, not route adaptation.
- Exact fresh-run repeats are local deterministic evidence, not an exported Team
  replay format. Team currently stores but does not use seed for movement RNG;
  use departure delays for real timing variation. No seed-count inflation.
- Check all36 selected manifests through the real Team test-pack exporter and
  validator. Candidate-only status and original identities remain distinct.
- Record short clears, idle waiting, incomplete goals and failures. Reused paths
  failing at higher speed do not establish unsolvability. Successful paths do not
  establish human balance or useful cooperation.

## Delivery and remaining gates

Add a read-only JSONL assessment command, reusable observer, immutable result
fixture and regression tests. First search tries existing same-mission templates
with initial delays0/30/60/120/240/600 ticks. Fresh routes may then be added as
separate evidence, without erasing old failure results. Use two supported Node
versions, independent review and update the completion ledger.

Native full play, controller/recovery, Team timed/combat semantics, human balance,
accepted-host integration and public deployment remain separate gates. Release
owner retains shared source/version/publisher ownership.
