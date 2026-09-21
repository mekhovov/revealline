# Authored pursuit and interception — slice D1

User-authorized next increment after pressure presets, timed pickups and eight
cultural/workshop greyboxes. This exposes existing `enemy-pressure.v1` runtime
behaviours through the shared authoring framework. It does not implement optional
combat actors, change capture, introduce a second movement engine, or enroll maps.

## Evidence and choice

The existing classic engine already supports bounded line-of-sight sensing,
locked targets, warning, committed field-only paths and cooldown. Its replay,
renderer and information paths are exercised by `enemy-pressure.test.mjs` and
renderer readability tests. The Journey actor catalogue currently cannot author
these behaviours. Reuse them rather than add redundant seeker AI.

[Mike Stout's first-person attack-design article](https://www.gamedeveloper.com/design/enemy-attacks-and-telegraphing)
supports clearly communicating the incoming action before requiring avoidance.
[AirXonix's developer rules](https://www.axysoft.com/airxonix/) distinguish interior
balls from filled-ground mines. These support readable threat domains, not a claim
that either specific AI guarantees popularity. Xposed remains the spatial/reveal
reference; its exact hidden AI parameters are unverified and are not copied.

Chosen: two distinct roles with shared deterministic recipes and one mandatory
lesson per three-mission arc. Rejected: speed-only recolours, invisible continuous
homing, shortening warnings on Expert, or mixing both new roles in their first
mission. Optional fictional combat actors remain a separate D2 design.

## Catalogue and compiler contract

Register additive `journey-actors-v7`, preserving v1–v6 exactly. Inherit existing
roles and add `trail-pursuer` and `heading-interceptor`, both `bouncer` movement
types retaining their unclaimed field region. Body and unfinished-line contact
remain harmful; enclosure never eliminates these as if they were combat targets.
Normal keepers, rovers and patrols retain their original behaviour.

Both use the existing measured/standard/brisk base speeds2.4/3.2/4 cells/s. Resolve
through the pinned difficulty catalogue. No arbitrary per-mission speed, sensing
or timing overrides. Shared recipe: sense radius18cells, scan24ticks, warning120,
commit180, cooldown360. Pursuit lead0; interception lead36ticks. The interceptor
predicts only the last seen direction and stops prediction before blocked ground.
Targets lock at warning start; neither role tracks an unseen later turn.

V1 difficulty keeps the authored cooldown. V2 scales only cooldown by its existing
attack-rest factor (450/306/234ticks Gentle/Standard/Expert), alongside its existing
movement multiplier and lives. Warning, sensing, scan, lead and commit duration do
not change with difficulty. This stays within the two non-life challenge dimensions.

Compile descriptor `classic.enemyPressure` from registered actor recipes only,
using sorted actor IDs and runtime version`enemy-pressure.v1`. Omit it entirely
when no pressure roles exist, preserving historical simulation identities. Strict
actor keys continue to reject inline recipes/scripts. Existing levelv5+ supports
this descriptor; do not change runtime versions or reinterpret old replays.

Capture/topology change, return or recovery cancels an attack using the existing
runtime contract. Freeze and movement slow retain existing tested behaviour.
No engine changes in D1; if a runtime defect is found, isolate and verify a separate
fix rather than silently weakening the authoring contract.

## Studio and mode boundaries

The existing actor editor gains named roles, eight-way heading and registered
speed tiers. Effective information shows actual speed, locked-target warning,
commit and cooldown for the selected preset, counterplay and retained-field
meaning. Use one catalogue helper for compiler and inspector timing.

CRUD still goes through `editContentActor`, all-supported-mode compilation,
immutable draft revisions, explicit Apply, stale-context protection and Undo.
Source/CLI/preview use exactly the same compiler. No separate editable raw timing
panel and no silent upgrade of existing project catalogues.

Team rejects these roles until its own semantics and evidence are qualified.
Solo and paired-board Versus resolve identical definitions and independent states.
Existing pressure visual overlays/locked-target cues and field descriptions must
be observed; actors remain distinguishable by the pressure mode/phase cues in
muted/reduced-effects play. Do not substitute a decorative sprite for a warning.

## Candidate studies

Create two optional three-mission arcs at bands4–5, using copies of existing C1
geometry as explicit encounter variants, not six newly drawn maps. One pressure
actor plus one ordinary keeper in first exposure; established patrols may enter
only in later practice/combination missions. No bonuses, countdowns or objectives
obscuring the behaviour under study. V2 pressure is explicit.

- Pursuit: short return after visible trail warning; choose between two openings;
  combine a pursuer with already-taught perimeter pressure.
- Interception: change route after the target locks; choose an alternative return;
  combine interception with already-taught moving-frontier pressure.

Each variant records one route decision, counterplay, capture consequence, lesson,
optional mastery, moment, difficulty facets and provisional60–150second target.
First mission introduces only its arc's role; subsequent missions practice it.
Exact IDs, placements and routes are authored during greybox iteration and pinned
in fixtures. Do not claim that adding a hunter fixes C1's short-clear pacing risks.
Art follows route/readability qualification. Inspection remains explicit and does
not publish, alter progress, replace originals or touch frozen release candidates.

## Implementation and verification sequence

1. Add immutable catalogue/recipe resolution and compiler emission. Check old
   manifests unchanged, strict unknown-role/inline-override rejection, all preset
   values, absence without roles, deterministic actor ordering and mode parity.
2. Extend Studio controls/effective timing and shared inspection. CRUD, stale
   contexts, Undo, selection/preset switching and Team rejection must be tested.
3. Author six encounter variants, inspect topology/departures, run lossless initial
   spawn observations and record real-input completion/replay/race fixtures for
   both steering modes and three presets. Observe actual warnings/commits in played
   routes; a route that avoids the new role entirely cannot teach its behaviour.
4. Check existing core pressure/renderer/replay/save suites plus new authoring
   cohort on Node20/22. Native exact-source Studio and at least one live encounter
   per role. Record missing seeds/devices/human evidence rather than fabricate it.
5. Review and hand off bounded successor packet to release owner for assigned PR,
   version and Pages test integration. Human balance, optional mastery and broader
   level migration remain independent gates. No routine confirmation pause.
