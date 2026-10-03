# Native FPV pursuit successor

Native ground pursuit is an explicit `FlightCourse.v3` / `FlightPursuit.v1` recipe,
executed by `civilian-world-pursuit.v1` and recorded as `FlightAttempt.v3`.
Historical `FlightCourse.v2`, `civilian-world-hunt.v1`, fixed routes and
`FlightAttempt.v2` retain their interpretation. A recording restores by replaying
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
qualified distinct campaign layouts**. All targets are finite. Courier catches are recorded separately without adding
points or quota credit; they do not respawn or expire.

Use **World Studio → Create a copy** to preserve an installed original. In
**Actors**, select an unarmed hostile Hunt target with at least one distinct
native waypoint and a Contact Hunt objective in each flight mode. Open **Native
pursuit · advanced routes → Create Runner from waypoints**. This copies its route
into a graph; the ordinary waypoint path is then empty. Alternatively, copy a
Native Pursuit sample to start from admitted data.

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

## Rules and presentation

- At most 64 graph nodes, 128 edges and 12 finite pursuit actors. Graph edges are
  0.6–20 metres; the entire graph must be connected. Preparation checks every
  required body shape using the native ground controller, in both directions,
  for body clearance, supporting ground, 30° slopes and 0.2 m steps.
- Runners move at 1.5 m/s, notice a visible drone within 6 metres and reconsider
  every 25 ticks (0.5 s). Decisions use current positions, never queued controls.
- Sprinters telegraph for 40 ticks, burst at 3 m/s for 20, and recover for 80.
  Refuge seekers commit to a reachable authored refuge; Switchbacks announce
  their next junction exit. Paired actors seek their meeting point and become
  a Runner when their partner is caught. Lookouts and Patrollers retain explicit
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

The [mutable-source structural receipt](verification/native-pursuit-structural.json)
records production preparation of all six samples in both native modes,
including every graph edge using real collision geometry. Scoped formatting, lint and generated projection identity checks passed. Regressions cover native admission, legacy
separation, graph failures, movement commitments, partner fallback, protected
contact, Studio conversion and proof recovery; they are authored but **unrun**
under the repository suite waiver.

No completion recordings, human catchability review, phone performance results
or public-release qualification are claimed for these successor samples. Those
remain release gates, as do visual review of every cast and native slope examples.
