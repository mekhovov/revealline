# Native FPV pursuit successor

Native ground pursuit uses `FlightCourse.v3` and a pinned `FlightPursuit.v1` or
`FlightPursuit.v2` policy, executed by the matching `civilian-world-pursuit.v1` or
`civilian-world-pursuit.v2` model. Both use the existing `FlightAttempt.v3` envelope;
its exact model and course identities prevent a recording from changing rules.
Historical `FlightCourse.v2`, `civilian-world-hunt.v1`, fixed routes,
`FlightAttempt.v2`, and all original v1 pursuit courses retain their interpretation. A recording restores by replaying
accepted controls, including graph decisions, heading, armor phase and cooldown;
imported actor positions are not trusted. The existing `hunt-contact-v1` criterion
still describes the finite objective; v3 course/model identity owns the new movement
and protected-contact rules.

## Play and author

Open **FPV SIM → Worlds → Challenges**, select Snake Hunt, and choose the **Native
Pursuit · Ground intentions** playlist or its individually selectable courses:

| Course              | Seed | Required prey                   | Additional content                |
| ------------------- | ---: | ------------------------------- | --------------------------------- |
| Runner Court        | 9801 | Runner                          | Field utility car                 |
| Burst Lanes         | 9802 | Sprinter                        | Cargo truck                       |
| Refuge Return       | 9803 | Refuge seeker                   | Optional courier; armored carrier |
| Switchback Crossing | 9804 | Switchback and Patroller        | Tracked tank                      |
| Meeting Yard        | 9805 | Rendezvous pair                 | Relay truck                       |
| Armor Windows       | 9806 | Shield bearer and Brace trooper | Explicit armor contact rules      |

All six support native Self-level and Acro flight. Their independent
`fpv-native-pursuit:` ownership does not replace older Hunt courses or awards.
These are six behavior samples on a shared training yard, **not six newly
qualified distinct campaign layouts**. The native playlist now selects **Refuge
Return · Committed routes** and **Meeting Yard · Committed routes**, the two r2
revisions using v2 policies. The other four samples are unchanged. All six r1
courses and their original pack identity remain available for saved attempts,
recordings and saved playlists; the two successor revisions do not count as new
layouts or inherit older completion records. All targets are finite. Courier catches are recorded separately without adding
points or quota credit; they do not respawn or expire.

Use **World Studio → Create a copy** to preserve an installed original. In
**Actors**, select an unarmed hostile Hunt target with at least one distinct
native waypoint and a Contact Hunt objective in each flight mode. Open **Native
pursuit · advanced routes → Create Runner from waypoints**. This copies its route
into a graph; the ordinary waypoint path is then empty. Alternatively, copy a
Native Pursuit sample to start from admitted data. New waypoint conversions use
v2. An existing v1 graph changes only through **Upgrade to committed pursuit v2**
or an explicit graph-format edit. Upgrade uses native admission and Undo; pending
text edits must be applied or discarded first.

The advanced graph editor edits nodes, undirected edges and actor policies as one
JSON transaction. **Apply graph and Hunt targets** explicitly updates the existing
Hunt target lists in both modes: ordinary policies remain required; couriers become
optional. It does not create or replace unrelated objectives. Nodes use integer
millimetres. Each policy names its actor, start node, goal nodes and optional pair
identity. A rendezvous requires exactly two policies with one common meeting goal.
Undo, export/import and exact preview use the existing World Studio pipeline.
Unapplied graph edits survive panel refresh and block other actor edits until
applied or discarded. External accepted source changes invalidate stale drafts.
Removing an actor also removes its policy; a remaining partner becomes a Runner.

V2 rendezvous admission requires separate graph approaches. One actor reaches the
meeting node; its partner stops on an admitted approach edge, separated by the
two body radii plus 100 mm. The complete XZ approach corridors must remain body-separated, including
segments whose node IDs differ; vertical overpasses do not bypass this conservative
rule. The follower’s approach must not intersect the first actor’s committed graph
route. A graph that cannot provide these routes is rejected before
launch with an explanation; it is not silently turned into a Runner. Other actors
or a player can still temporarily block an admitted route. Native geometry checks
remain authoritative, and structural admission is not proof of a played route.

## Rules and presentation

- At most 64 graph nodes, 128 edges and 12 finite pursuit actors. Graph edges are
  0.6–20 metres; the entire graph must be connected. Preparation checks every
  required body shape using the native ground controller, in both directions,
  for body clearance, supporting ground, 30° slopes and 0.2 m steps.
- Runners move at 1.5 m/s, notice a visible drone within 6 metres and reconsider
  every 25 ticks (0.5 s). Decisions use current positions, never queued controls.
- Sprinters telegraph for 40 ticks, burst at 3 m/s for 20, and recover for 80.
  In v2, Refuge seekers announce for 40 ticks, keep the selected refuge through
  intermediate graph nodes, and rest for 80 ticks before selecting another.
  Switchbacks announce their next junction exit. V2 pairs wait for both separate
  arrivals, share an 80-tick recovery deadline, then wait at their meeting point.
  A surviving partner becomes a Runner without teleporting. The v1 controller is
  retained exactly, including its earlier refuge reselection and common-point
  pair behavior; these corrections are not retroactively applied to old proofs. Lookouts and Patrollers retain explicit
  stationary/circuit policies.
- Shield facing remains committed for at least 40 ticks; turns warn for 40.
  Front contact is protected; the exact side boundary and rear are exposed.
  Brace warning/burst contact is protected; recovery is exposed. Protected
  contact deals 25 hull damage with the native shared 20-tick contact cooldown.
  Armor uses the heading/phase visible before that movement transaction.
- Native collision and weapons resolve before accepting v3 catches. A fatal
  frame grants no catch. Targets wait at blocked ground, another actor, the drone
  or the solid echo. No actor gains teleporting, input prediction or new shots.
- Native articulated humanoids face their accepted heading. Gait, armor tells,
  recovery and intent markers sample simulation time, so pause and replay seek
  cannot introduce cosmetic motion. Clean/brutal feedback and reaction audio use
  shared actor identities and preferences; optional courier feedback uses the
  same path. A missing sound pack retains existing procedural cues.

Five original procedural vehicle models are selectable on v3 vehicle actors in
Studio: utility car, cargo truck, armored carrier, tracked tank and relay truck.
They reuse the existing vehicle collider, waypoint motion, health and weapon
rules. They do **not** introduce tank armor, ballistics, new damage or vehicle
control. Earlier vehicle artwork remains selected when no new model is declared.
All models have compact geometry; wheel/radar motion stops with simulation time.
The Ukrainian player aircraft is unchanged.

## Verification status

The original [mutable-source structural receipt](verification/native-pursuit-structural.json)
records production preparation of the six r1 samples in both native modes,
including every graph edge using real collision geometry. Scoped formatting, lint and generated projection identity checks passed. Regressions cover native admission, legacy
separation, graph failures, movement commitments, partner fallback, protected
contact, Studio conversion and proof recovery. The original receipt used the
then-active suite waiver. The 4 October continuation restored required tests:
both native pursuit regression files and the native pursuit editor cases passed
on committed source `ac7bd48a9d873782b1b96324229c8c09ffbf822b`, within the
[568-case feature verification](industrial-parallel-delivery-2026-10-04.md).

[Twelve fixed native completion witnesses](../game/test/fixtures/native-pursuit-flight/README.md)
now cover the current six-course playlist in Self-level and Acro. They retain
the authored seeds, exact pack/recipe/model identities and native Gentle response.
Every route finishes with 100 hull health, no damaging contacts and no shots;
Armor Windows uses exposed Shield contact and Brace recovery. Refuge Return
finishes with the optional courier still active. The regression replays fixed
hashed controls, restores halfway through using native recovery, and compares
both terminal recordings with independent native replay. The reviewed generator
submits only legal controls; normal tests do not regenerate adaptive routes.

These software existence witnesses passed on Node 20 and 22. They are not human
catchability review, phone performance results or public-release qualification.
Those remain release gates, as do visual review of every cast and native slope
examples. The samples still share a training yard and do not become six new
campaign layouts merely because completion is demonstrated.

The [v2 structural continuation](verification/native-pursuit-v2-structural.json)
prepares all six retained r1 courses and both corrected r2 revisions in Self-level
and Acro: 16 native geometry admissions, with zero simulation steps. Native
Studio definition compilation preserves their accepted identities. The two r2
revisions also pass programmatic `.rlpack` and editable ZIP round-trips (7,117 and
7,176 bytes). These are mutable-source receipts, not a committed build, browser
editing session or completed gameplay route. Relevant commitment, pair spacing,
shared rest, survivor fallback, invalid approaches, explicit Studio upgrade and
v1/v2 replay/recovery regressions are now executed as described above. The
[generated Low Pass Depot routes](qualification/pursuit-pilots/generated-routes-2026-10-04.md)
exercise the separate three-patroller pilot in both flight modes. The twelve
new native pursuit witnesses above supply separate evidence for these six
behavior samples; neither batch substitutes for the other.
