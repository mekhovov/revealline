# Together: Relay Rescue

## Player experience

Two equivalent craft reclaim one territory board, defeat enemy strongholds, rescue one another and finish each mission together. The mode is a new choice beside the existing couch race. It uses one shared camera, world, enemy population, clock, coverage total and result. Each player can cut, protect and rescue. Players may prefer covering or cutting without forced role rotation or equal contribution quotas.

The first campaign contains six authored missions on bounded 72 × 36 playgrounds, one authored remix per mission, and Gentle, Standard and Expert difficulties. Sessions should last minutes, with quick current-mission retries. There is no mandatory mission countdown. First Connection uses a coverage goal; later missions require defeating their required cores, with coverage reserved for mastery. There is no exit requirement. A valid clear by the surviving craft restores its downed partner for the shared celebration. Team medals reward mastery separately from a clear; any difficulty can unlock the next mission.

Keep existing tap steering and Boost, and add one Support action. Closing a cut stops that craft; a fresh direction starts it again. Keyboard, two gamepads, touch, and mixed input pairs must have equivalent actions, including explicit held-Support capability rather than inheriting Arcade's action suppression. Player numbers, silhouettes and distinct trail patterns supplement color. The complete active playground, both craft and attack warnings remain visible at usable scale.

## Shared simulation contract

Use a separate, versioned cooperative simulation and result boundary. Reuse movement, swept geometry and presentation primitives where appropriate, while retaining the solo and competitive race contracts. A cooperative run owns both players and both input samples, individual live trails and support cooldowns, shared cells and enemies, objectives, rescue state, reserves, events and deterministic progression. Rendering and storage do not mutate simulation state.

### Cuts and contacts

Evaluate both players from the same fixed-step state. Use swept paths and exact event times, not endpoint-only contact checks or a Player 1-first update loop. Earlier events happen first. At the same time, a lethal enemy, trail or self-contact invalidates that craft's proposed closure before capture resolves. A later closure cannot erase an earlier hit.

Ally bodies and crossings of another player's historical unfinished trail are harmless. They do not themselves close a cut. A new meeting of the two active trail heads can close their joined cut, including cuts from the same origin; stationary body overlap and crossing an old segment are not head meetings. Eligible simultaneous closures commit as one union. Apply captured cells, coverage, objective awards and score once, irrespective of seat iteration order. Both craft returned home by that event stop and require fresh steering. Small joins remain legal; team celebration credit requires at least 2% meaningful new playable area. Persistent overlap cannot repeat a join or farm credit.

Allies and their live trails are **not** flood-fill retention seeds. Enemy and shielded-core anchors retain their regions. When newly safe territory intersects a surviving live trail, bank its connected prefix through the last newly safe point, use that point as the new safe anchor, and leave only the remaining suffix vulnerable. If the new safe region reaches the craft, bank the whole trail and return it home. Travelling impacts on banked trail portions disappear; impacts still belonging to the live suffix retain their valid route. Do not leave a vulnerable historical overlay on already banked territory, invent a new departure, or repeatedly award the same area.

Normalize all affected trails to a bounded fixed point within the capture transaction. Banking a connected prefix can release another fill; union these new cells with the transaction's claims and normalize again only while safe territory grows or an existing trail shortens. Each existing trail can only shorten or finish; normalization cannot create a fresh cut or an unbounded chain of simulated inputs. Frozen core retention seeds remain in force through every such fill. A hit clears only the struck player's unfinished trail. Shared captured territory and the other player's valid live trail remain.

### Strongholds

Each stronghold has two ordinary capturable anchors and a shielded core that retains its field region. The anchors are ordinary objectives, not additional retention seeds. Capturing both permanently drops the shield; there are no occupied pads or simultaneous standing requirement. Show the shield change while the associated emitter remains active until the core is defeated.

Keep the core's shield/retention eligibility frozen for the entire transaction that captures the second anchor. Remove the shielded-core retention seed only after that transaction finishes. A later capture must actually secure the exposed core before the stronghold is defeated and its associated emitter and hazards are removed. Simultaneous closures, allied trail normalization and objective callbacks cannot use an anchor capture to claim that core retroactively. Defeating one stronghold does not disable another's enemies or hazards.

### Support and recovery

Support holds one charge and refills in eight seconds of active simulation. A pulse reaches six cells, slows affected enemies by 50% for 1.5 seconds, and clears travelling trail impacts in range. Slows cannot multiply or extend indefinitely through overlapping pulses. Each cumulative 2% of unique new team territory advances both players' cooldowns by two seconds; already claimed cells cannot be farmed for refill. Preserve charge/cooldown state through every death and recovery. Credit actual protection, interception, slowing a threat or helping bank a cut, not merely pressing Support.

Holding Support beside a downed ally on safe ground takes priority over pulsing: stop, channel a one-second free rescue, then require fresh steering. Rescue does not require or spend a pulse charge. Movement or a hazardous interruption cancels the channel. Downed craft return to their last safe anchor and can crawl through connected safe territory and signal for help; they cannot cut or pulse.

A surviving teammate also earns a free recovery by capturing 2% of previously unclaimed playable area since the down event, or completing a required objective. Process these free recoveries before charging reserves. Record the down-event territory baseline so old claims and repeated objective events cannot count again.

| Difficulty | Shared reserve redeployments | Downed recovery window |
| ---------- | ---------------------------: | ---------------------: |
| Gentle     |                            5 |             16 seconds |
| Standard   |                            3 |             12 seconds |
| Expert     |                            1 |             10 seconds |

If one craft's recovery window expires, spend one available reserve to redeploy that craft while preserving the survivor's position, trail and heading. If no reserve remains, keep free rescue available; a single downed craft does not fail the mission. If both craft are down, spend one reserve to redeploy both at their authored spawns, or fail the current mission if none remains. Resolve same-event free recoveries and a valid mission win before reserve expenditure; never double-charge one casualty event. Recovery must not expose a player to an unannounced immediate hit. No player is permanently eliminated from rescue eligibility.

Within each fixed step, advance inputs and timed effects and process swept events chronologically. At each event time, invalidate hit trails before equal-time closure; union valid closures in one bounded capture transaction; normalize trails and record new objectives; apply free recoveries and valid victory; then resolve any due downed deadlines/team redeployment once. Recompute later movement and hazards from the resulting state so a later hit cannot preempt an earlier closure. Publish events after state is coherent. Pause, visibility loss and controller disconnection freeze active timers, clear held inputs and preserve seat identity.

## Campaign and presentation

Build each mission around one new cooperative decision before combining it with prior lessons:

| Mission          | Playground and purpose                                                                                         |
| ---------------- | -------------------------------------------------------------------------------------------------------------- |
| First Connection | Open arena and opposing launch points; teach shared captures, head meetings and covering with a coverage goal. |
| Forked Orchard   | Two loop approaches with useful crossings; choose routes and coordinate their capture.                         |
| Crosswind Yard   | Clearly warned alternating enemy sweep lanes; cover crossings and exploit recovery windows.                    |
| Twin Relays      | Two strongholds with overlapping pressure; open their anchors and capture each exposed core.                   |
| Rescue Run       | Long loops, shortcuts and optional recovery beacons; weigh recovery against route risk.                        |
| Warden's Ring    | Central refuge and three sectors combine learned cutting, rescue and stronghold rules.                         |

Drifters provide predictable moving pressure. Hunters visibly select a trail/head target, warn, commit, recover, and only then select a new target; no silent retargeting, downed targets or unannounced recovery hits. Sentries have marked approaches and belong to specific strongholds. The Warden combines taught patterns. Author bounded pressure and breathing spaces without secret adaptation. Difficulty changes warning duration, pressure overlap, encounter composition and recovery opportunities; extra health or speed alone is not sufficient tuning.

The original and remix use authored, validated sockets. Preserve valid anchor/core routes, enough safe return space and reachable rescue anchors. No random unseen spawn may attack immediately. Keep safe/risky route choice and visible counterplay in both variants. Give stages distinct pictures and reveals. Shared accomplishments and meaningful coordinated cuts receive team feedback; no individual power grind, winner-versus-loser couch result or solo achievement is emitted.

Create separate versioned cooperative progress, difficulty records and backup records with validated content identity. Preserve solo/race saves and imported replay compatibility. Use one active writer lease for cooperative progress across tabs. Provide explicit cooperative export/import, controlled corrupt/incompatible-data errors and no silent overwrite. Retry the exact current seed/setup. Starting another mission or difficulty is a deliberate lobby action. There are no mid-mission saves, online play, AI partner, arbitrary solo-map conversion or deployment in this scope.

## Phased delivery and gates

Each phase follows the same loop: research the specific open design question, implement the bounded change, review source and player behavior, run appropriate checks, fix findings, and rerun affected checks. Record evidence and remaining limitations. Stage only related hunks/lines, inspect the staged diff, synchronize the three game-version files, and commit the phase. Test/build the actual committed revision in a clean temporary checkout and preserve its playable artifact. A failed required gate keeps the phase open. Do not stage unrelated work or claim a gate passed from a version number alone.

| Phase / version | Deliverable                                                                                                                                                                                              | Completion evidence                                                                                                                                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 / 0.44.3      | Durable design, acceptance criteria, regression baseline and couch markup harness repair.                                                                                                                | Parser regressions plus existing couch input, shell, navigation and multiplayer encounter checks; distinguish existing defects from new behavior.                                                                       |
| 2 / 0.45.0      | Shared-world playable prototype: two craft, shared board, deterministic capture/head meetings, one camera and couch launch path. Temporary short automatic recovery is explicitly prototype scaffolding. | Swept simultaneous geometry, contact ties, normalization, seat-swap symmetry, render-rate independence, shared-state host smoke tests and existing-mode regression checks.                                              |
| 3 / 0.46.0      | Full helping loop: Support economy, targeted pressure, rescue/reserves, stronghold transaction rules and one representative polished mission. Replace prototype recovery scaffolding.                    | FIRST REAL PAIRED PLAYTEST GATE with the user's pair before campaign expansion. Teach the mechanics, compare the three configurations below and fix cooperation/readability failures before Phase 4.                    |
| 4 / 0.47.0      | Six missions × two authored variants × three difficulties: 36 reviewed configurations, progression and explicit cooperative backup.                                                                      | Completion and reachable-objective checks for all configurations; difficulty and save isolation tests; meaningful route choices and solvable rescue paths.                                                              |
| 5 / 0.48.0      | Cohesive lobby, instructions, shared HUD, sound/effects, controller/touch/keyboard parity and accessibility tuning.                                                                                      | SECOND REAL PAIRED PLAYTEST GATE with the user's pair. Check both players' agency, comprehension, recovery and voluntary replay; verify small-screen layout, pause/disconnect/resume and reduced-motion/non-color cues. |
| 6 / 0.48.1      | Release qualification, final fixes and a reproducible frozen build with recorded checks.                                                                                                                 | Full applicable tests, content validation, lint/build checks, built-browser smoke checks, compatibility/save/lease checks and the exact qualified revision/artifact record.                                             |

Real paired playtests require two humans playing together. The user's pair provides the two agreed milestone tests. Broader newcomer or expert qualification requires those actual players and is recorded separately as pending when unavailable. Scripted bots, deterministic routes and one operator driving both seats validate implementation but do not establish fun or mixed-skill usability. If a required paired gate is unavailable, report it as pending and retain a technical checkpoint; do not silently treat it as passed or expand content past the first gate.

## Review and test cases

- Geometry: simultaneous closures, active heads meeting/crossing between ticks, common-origin cuts, old-trail crossings, ally overlap, own-trail collision, contact before/equal/after closure, partial/full partner banking, impacts on banked prefixes and live suffixes, duplicate area awards, seat-order and input-sample-rate invariance.
- Objectives: either anchor order, both anchors in one transaction, shielded core enclosed by a cut, core seed retained until the next transaction, later real core capture, independent strongholds, current objective completion while an ally is down, and valid survivor completion restoring the partner for celebration.
- Recovery: free nearby rescue with empty pulse, pulse-versus-hold precedence, channel interruption, 2% since-down free recovery, duplicate claims, simultaneous down events, timeout with/without reserve, last-reserve team redeployment, valid win/free rescue before resource spending, and survivor trail preservation.
- Host and persistence: both seats across keyboard/gamepad/touch, held-input release, pause/blur/disconnect without timer drift, deliberate retries, restart isolation, malformed imports, writer-lease loss, exact mode/content identity, no solo awards, and unchanged historical solo/race behavior.
- Human evaluation: teach each configuration before comparison and vary its order on the same arenas: (1) independent cuts plus ordinary covering, (2) joint cuts plus assist capture, (3) the full covering/rescue loop. Record route choice, safety, completion time, actual helping outcomes, support-player agency, waiting/blame and voluntary retries. Ask each player what endangered them and how their partner helped. Use the user's actual pair for milestone evidence; do not infer untested newcomer/expert findings.

## Research used

These primary references inform experiments rather than a ranking or a guarantee of enjoyment:

- [Overcooked 2](https://www.team17.com/news/the-a-z-of-overcooked-2): communicating through coordinated actions and separating an accessible clear from optional mastery.
- [Lovers in a Dangerous Spacetime](https://www.loversinadangerousspacetime.com/): simple controls with coordination depth and useful, exchangeable responsibilities.
- [Moving Out 2 developer design account](https://blog.playstation.com/2023/08/14/designing-moving-out-2-to-be-more-fun-diverse-and-inclusive/): test mechanics in simple prototypes with actual pairs before adding art; reject boring stationary-helper duties and communicate through more than color.
- [PlateUp developer press kit](https://www.plateupgame.com/presskit/): shared planning and player-chosen ways to cooperate. Apply player agency without importing its restaurant upkeep or progression grind.
- [Valve's cooperative design talk](https://cdn.akamai.steamstatic.com/apps/valve/2009/GDC2009_ReplayableCooperativeGameDesign_Left4Dead.pdf): pressure and recovery rhythms. This is a pacing reference from an online/split-screen game; use authored breathing windows here, not a hidden adaptive director.
- [Ember Knights developer account](https://news.xbox.com/en-us/2025/10/22/ember-knights-co-op-xbox/): keep players visible, make one player's action visibly help another, and tune an easier mode for mixed-skill pairs.
