# Round 05 — reference-driven mechanics and challenge adjustments

> Round 06 update: [closer video analysis](../../docs/research/round-06-reloaded-observations.md) directly shows contact pickup collection and territory erosion. Enclosed wall/slow/lethal artwork disappears in one board. Permanent wall behavior below remains our provisional choice, not a confirmed Reloaded match; a reference-oriented terrain lifecycle needs an explicit extension.

Status: proposed next design revision; no schema or runtime was changed. Existing v0.1 primitives remain specifications, not implemented behavior. This document distinguishes what current content data can express from extensions needed to follow the newly inspected Reloaded footage.

## Direct reference evidence

The parent visual audit inspected Lord Parker's [Reloaded settings and gameplay video](https://www.youtube.com/watch?v=SKKvpZ2DvUY); the two saved tutorial frames were also independently inspected for this brief.

| Evidence | Confirmed meaning | Design implication |
|---|---|---|
| [Tutorial at 00:45](https://www.youtube.com/watch?v=SKKvpZ2DvUY&t=45s); [saved frame](../../docs/research/evidence/round-05/reloaded-manual-0045.png) | Four pickups: a life refill, reduced enemy speed, increased player speed, and enemy freezing; stick and D-pad control; stars unlock further levels | Pickup rules and mastery rewards deserve explicit data models. Durations, strength, stacking, collection trigger and caps are not visible here. |
| [Tutorial at 00:55](https://www.youtube.com/watch?v=SKKvpZ2DvUY&t=55s); [saved frame](../../docs/research/evidence/round-05/reloaded-manual-0055.png) | Slow terrain affects the player while enemies ignore it; lethal terrain likewise affects only the player; walls block both | Terrain must declare actor-specific effects. A global enemy-speed modifier cannot represent a slow patch. |
| Same 00:55 frame | A regular field threat, a large diamond that removes exposed ground, a threat that patrols lines, and a threat that moves within exposed ground | Four distinct spatial roles. These are four documented classes, not proof of the complete enemy roster. |
| [Pack 1 footage at 02:16](https://www.youtube.com/watch?v=8L3PwVcvg40&t=136s), observed in parent audit | Line enemies traverse internal contours after capture | The current outer-border patrol specification is too narrow. |
| [Pack 1 footage at 04:33](https://www.youtube.com/watch?v=8L3PwVcvg40&t=273s), observed in parent audit | HUD shows a 90% target alongside mixed terrain | Quota is level-authored; 80% must not become a global assumption. |
| [Pack 1 results at 13:40](https://www.youtube.com/watch?v=8L3PwVcvg40&t=820s), observed in parent audit | Level 8 includes completion, retained lives and a 150-second speed condition | Speed medals need per-level thresholds; the earlier level-1 60-second target was not universal. |

The tutorial identifies three special field roles as **slow, lethal and wall**. Earlier speculation that the three were “normal, slow and lethal” is superseded. The named pickup list is now directly established for Reloaded, independently of Switched's marketing counts. Exact capture-side selection still needs a separate evidence-backed decision.

## Honest gap matrix against the current contract

Read alongside [CONTRACT.md](../CONTRACT.md), [primitive catalog](../schema/primitive-catalog.json), [schema](../schema/content-pack.schema.json) and [validator](../scripts/validate_pack.py).

“Expressible” below means representable in current draft data. It never means a playable implementation exists.

| Requirement | Current v0.1 support | Required action |
|---|---|---|
| Different background media, palette, avatar and wording | Expressible: assets, reveal art, theme roles and captions are separate | Preserve this separation. Background vehicles, historical illustrations and invoice pictures must not silently create collision or goals. |
| Coverage target including 90% | Expressible: `goal.coverage.v1.targetFraction` | Author the target per ruleset/level. Show it before play and alongside current coverage. |
| Rectangular wall arrangements | Expressible: `grid.blockedRects`; field bouncers reflect at blocked cells | Compose meaningful shapes from non-overlapping rectangles. Clarify player-wall movement at runtime; current validator checks static reachability only. |
| Arbitrary authored terrain patches | Missing: grid has only blocked rectangles and a one-cell safe border | Add a terrain layer separate from occupancy, with masks/rectangles and explicit interaction rules. Painted red/blue pixels are not terrain data. |
| Local player-only slowdown | Missing: current speed modifier scales field enemies globally | New terrain effect with player speed multiplier and enemy exemptions. |
| Player-lethal terrain traversable by enemies | Missing | New terrain collision response. Decide whether enclosure neutralizes its effect; tutorial contact wording alone does not answer that. |
| Regular unclaimed-area bouncer | Expressible as `enemy.bounce-field.v1` | Verify motion and fill-anchor semantics; similarity is not proof of identical reference behavior. |
| Patrol along newly created internal contours | Missing: `enemy.patrol-boundary.v1` is explicitly outer border only | New versioned patrol behavior and contour-graph model. Do not change the meaning of an existing `.v1` ID. |
| Enemy wandering in captured territory | Missing: only field/boundary spawn domains exist | New claimed-area movement domain and safe spawn/activation rule. Captured territory cannot be presented as permanently harmless. |
| Large enemy destroying exposed territory | Missing: no erosion or ownership reversal | New enemy/effect plus topology rebuilding, score/goal semantics and clear warning feedback. |
| Four timed/random pickups | Missing: markers trigger after enclosure; they are not contact pickups | Add pickup spawn/collection/expiry records, life effects and timed actor status effects. Preserve the existing marker model for objectives. |
| Freeze | Not expressible through current speed-scale modifier: minimum is 0.25 | New timed status must support zero velocity intentionally. Define expiration and interaction with other statuses. |
| Three independent result stars | Missing: `rewardMode="medals"` is only vocabulary; unused goals do not award medals | Add result conditions, per-level threshold values and persistent best medal state. |
| Speed medal without losing the run at its deadline | Partial: hard timer exists, independent deadline result test does not | Keep main completion separate from the speed medal. Missing a medal should not automatically fail the level. |
| Immediate trail failure versus traveling strike pulse | Only immediate `lose-life` or `cancel-cut` choices exist | Leave unchanged until the reference pulse is verified and a rule selected. A future pulse needs an explicit versioned contact policy. |
| Equivalent board on phone, browser and desktop | Expressible: fixed 4:3 grid and content coordinates | Keep simulation geometry, speed and target identical; test actual input and scale separately. |

## Proposed extension boundaries

The following names are **candidate extension requests**, not registered IDs to insert into current manifests. A future contract revision must add parameter schemas, semantic checks and runtime behavior together.

1. **Terrain:** an actor interaction layer orthogonal to `unclaimed / claimed / wall` occupancy. Candidate capabilities `terrain.player-slow.v1` and `terrain.player-lethal.v1`; wall can retain current blocked geometry. For the initial design, propose that lethal patches are claimable and cease being lethal after their region is safely captured. That is our rule choice, not a confirmed Reloaded fact. Slow patches can similarly deactivate after capture. Walls remain excluded from claimable area.
2. **Contour patrol:** `enemy.patrol-contour.v1` follows the live frontier between claimed and unclaimed cells, including internal edges. Specify edge orientation, corner traversal, branch ties and rerouting when a cut changes the contour. Preserve the old outer-border behavior for simpler levels.
3. **Claimed-space patrol:** `enemy.wander-claimed.v1` moves through claimed cells and threatens the player there without anchoring unclaimed components. An enemy may be activated after enough safe ground exists rather than placed in an illegal starting domain.
4. **Erosion:** `enemy.erode-claimed.v1` reopens a bounded area on contact/cadence. It may change current coverage, but must not erase permanent walls or escape the board. Specify how the player, objectives and other enemies respond when their underlying cell changes.
5. **Pickups/statuses:** `pickup.contact.v1` specifies spawn domain, collection condition and lifetime; `effect.add-life.v1` handles lives; `effect.timed-speed-scale.v1` selects player or enemy actor scopes and supports a zero-motion freeze. Decide refresh/replace semantics explicitly. A pickup cannot be faked by relabeling an enclosed marker.
6. **Result medals:** data for completion, zero lives lost and finish-before thresholds, with independent awarded/best-state fields. Separate these from level unlock requirements and the hard failure timer.

Minimum extra event records: cut closed, cells claimed, cells reopened, player life lost, pickup collected, status expired, contour rebuilt and level finished. New art should respond to these events, not infer them from image colors or particle positions.

For erosion, track **current coverage** for the HUD and win test, and **first-time captured cells** for ordinary area score. Otherwise repeated reclaims can become an accidental unlimited score loop. A captured objective's one-time reward stays granted unless a deliberately separate recapture mode is authored. Completion commits once, after the tick's documented collision/fill/erosion order.

## Proposed twelve-level teaching campaign

Each board uses the same 48×36, 4:3 arena. All figures below are **starting design hypotheses**, not measurements from Reloaded and not dynamically validated. Initial movement target: player 10 cells/second, regular enemy 3 cells/second, three lives. Start untimed for main completion; tune optional speed medals after keyboard, D-pad and touch playtests. Changing the picture never changes these values.

The first three stages are largely representable in v0.1 data. Later stages deliberately depend on the extensions above. No JSON pack is emitted with invented capability IDs.

| # | Board silhouette and spatial lesson | Main challenge and proposed completion | Distinct route decision |
|---|---|---|---|
| 1 — First Cut | Broad open field; two faint tutorial route hints that disappear after use | One regular field enemy; 65% coverage | Compare a shallow strip with a longer rectangular bite. Teach that a closed cut and a filled region are separate events. |
| 2 — Staggered Gates | Three short wall bars alternate left/right without touching the border; at least four-cell passages | Two field enemies; 70% | Make small cuts from each flank or time a longer dogleg through the gates. Introduces walls without a cramped full maze. |
| 3 — Twin Courtyards | Two C-shaped wall courtyards face opposite directions, with broad central and exterior routes | 72% plus one captured marker | Choose a courtyard opening first; reconnect to a known safe contour. No fully sealed unreachable interior pocket. |
| 4 — Blue Ford | A horizontal slow band leaves broad passages at both ends; one central nonlethal shortcut | Player slow multiplier initially 0.5 in the band; 72% | Short but slow crossing versus longer normal-speed detour. Enemies ignoring the band is taught visibly. |
| 5 — Broken Halo | Four separated lethal arcs surround an open center; clear gaps at cardinal directions | 75% | Approach through a gap and enclose a patch from outside. Moving through a lethal cell and capturing its region have visibly different consequences. |
| 6 — The Comb | Alternating wall teeth with two generous cross-aisles and open ends | One contour patrol plus field traffic; 75% | Anticipate how a successful cut creates a new patrol edge. A previously safe return location may become busy. |
| 7 — Safe-Side Visitor | Offset wall islands produce two large captured footholds, joined by a wide connector after early cuts | One claimed-space threat activates with warning after the first substantial enclosure; 78% | Spend time on the new safe ground or leave it promptly for a new cut. Avoid presenting “revealed” as “enemy-free.” |
| 8 — Fraying Edge | Broad central diamond of open ground, four short wall spokes that never seal it | One slow eroder; 80% | Consolidate a large region or pursue the eroder's exposed flank. First erosion stage has little other traffic so reopening is understandable. |
| 9 — Supply Detour | Two offset lanes connected by generous openings; pickup lanes sit away from the shortest completion route | Four known pickup types introduced one at a time; 80% | Detour to collect a temporary opportunity, or finish an already safe cut. No pickup is required to meet the basic quota. |
| 10 — Twin Spirals | Two shallow, mirrored wall spirals with wide exits; slow patches only on selected inner turns | One contour patrol and modest field traffic; 82% | Reverse the order of the two spirals; use safe exterior cuts to shorten the second route. Geometry raises difficulty, not just speed. |
| 11 — Windows and Bridges | Four unequal rooms joined by offset open corridors; scattered lethal patches leave at least two viable approaches | Capture two objective markers and reach 85%; captured objectives disable tagged threats | Which objective is captured first changes pressure elsewhere. This adds our thematic goal layer on top of recognizable Xonix cuts. |
| 12 — Open Choice | Asymmetric three-lobe field connected through a large hub; each lobe remixes one earlier lesson | 90%; restrained mix of slow/lethal/wall terrain and at most one specialist enemy of each introduced role | Choose the order of lobes, create broad footholds, then finish the cleanest remaining cut. Avoid one-pixel cleanup corridors. |

After stage 12, alternate challenge layouts can reuse images with a new challenge ID: open-field speed version, contour-control version, pickup-free mastery version and gentler gallery version. A new rule/topology gets a distinct score category. Merely changing art or device size does not.

Provisional pickup tuning for discussion: player boost ×1.3 for 4 seconds, enemy slowdown ×0.5 for 5 seconds, enemy freeze for 2 seconds; pickup visibility lifetime 8 seconds; extra life capped at the chosen ruleset limit. These values need control and escape-time tests. Status durations and spawn randomness are not established by the manual. For learning stages, author deterministic spawns first; seeded variability belongs in later challenge variants.

## Theme mappings preserve mechanical identity

The same geometry and challenge IDs can carry all four families. Neutral semantic roles belong to the simulation; visuals and words are swappable. Distinguish live game actors from figures painted into the reward illustration.

| Neutral role | FPV FRONT — main | UKRAINE ATLAS | 1994 FOREVER | NAVI NETWORK |
|---|---|---|---|---|
| Player / trail | Ukrainian FPV drone / luminous signal trace | Firefly, craft shuttle or small bird, chosen per chapter / stitched trace | Microship / phosphor trace | Approved Coupa/Navi token / illuminated flow |
| Regular field enemy | Fictional invading military patrol drone | Restless storm mote | Neon orb | Duplicate-charge sprite |
| Contour patrol | Hostile perimeter crawler | Thorn runner | Circuit crawler | Fee ticker following the network edge |
| Claimed-space enemy | Hostile scout on cleared sectors | Wandering gust on restored ground | Glitch roaming lit pixels | A recurring expense roaming visible operations |
| Eroder | Fictional hostile interference unit | Encroaching shadow | Corruption diamond | Cost-leak unit reopening waste |
| Slow terrain | Stylized interference haze | Marsh or dense thread | Magnetic tape drag | Approval backlog |
| Lethal terrain | Clearly marked danger patch | Thorn/squall patch | Red short circuit | Red exception zone |
| Wall | Abstract barrier blocks | Stone or geometric craft tiles | Circuit blocks | Closed ledger blocks |
| Captured objective | Signal relay; artwork reveals fictional Russian invading military presence | Landmark, craft emblem or historical object | Disk, cartridge or radio station | Supplier node, invoice cluster or savings opportunity |
| Reward image | Fictional Ukrainian military setting with invading equipment represented clearly | Region- and era-specific art, illustration, photograph or archive | Coherent period scene and hardware culture | Fictional client operations gaining visible savings |

Example chapter titles for the twelve shapes can vary without changing the mechanics: Blue Ford becomes **Signal Crossing / Carpathian Ford / Tape Drag / Approval Queue**; Broken Halo becomes **Danger Ring / Thorn Wreath / Short Circuit / Exception Ring**; Twin Spirals becomes **Relay Labyrinth / Twin Ornaments / Data Maze / Supplier Routes**. Cultural ornaments may inspire the silhouette, but playability decides corridor widths and hazard placement.

Use player, open-field enemy, contour enemy, claimed-space enemy, eroder, slow terrain, lethal terrain, wall and objective as distinct **semantic art roles**. The current schema has only generic field/boundary enemy visual roles, so this expanded role map is another presentation contract extension. Do not turn a Coupa logo or a red embroidered motif into a collision rule implicitly.

## Acceptance cases for the next implementation

These are required future tests, not tests already run.

| Case | Expected observable result |
|---|---|
| Same board, four themes | Given identical seed and input stream, positions, damage, captured cells, objectives and final score are identical. Only presentation changes. |
| Slow strip | Player crosses the strip at configured reduced speed; field, contour and claimed-space enemies obey their explicitly authored exemptions. Leaving the strip restores normal speed without a frame-dependent jump. |
| Lethal versus wall | Player contact with lethal terrain causes its documented penalty; an enemy passes unaffected. Both actors are blocked by a wall. The art distinctly communicates all three outcomes. |
| Capture over lethal region | Under the proposed rule, enclosure neutralizes the captured patch; direct travel into it before capture still causes damage. Alternate policies require a separate rule ID and tutorial. |
| A cut with enemies on both sides | The selected fill policy produces exactly the explained result; a no-fill outcome identifies its blocker. Do not promise this equals Reloaded until its precise rule is resolved. |
| New internal contour | After a cut, the contour patrol joins a legal new edge without teleporting through the player or becoming stuck. Corner/branch choices are deterministic. |
| Claimed-space activation | The new enemy spawns only on legal claimed cells, outside a tested warning/escape margin; a small first cut does not cause an unavoidable death. |
| Erosion | Only eligible claimed cells reopen; fixed walls survive; contours and HUD update together; no orphaned player/enemy is silently dropped. Reclaiming the same cells cannot farm first-capture score. |
| Life and timed pickups | Life cap, status duration, expiry and repeated collection follow the documented policy. Pausing does not consume active-play duration. Slow terrain and player boost compose in an explicit order. |
| Last-tick interactions | Collision, fill, erosion and victory on one tick resolve consistently. The game cannot show victory and subtract a life in contradictory order. |
| Medals and progression | Completing a level advances ordinary campaign access even after a death or missed speed medal. Replay can improve persistent medals without relocking content. |
| 90% target feasibility | Quota denominator excludes border/walls as specified. The authored board has viable completion routes without tiny unavoidable cleanup pockets; a static validator alone cannot certify this. |
| Device scale/input | The same full board remains visible in portrait and landscape; controls do not cover critical play; turning, speed and hit regions agree across keyboard, D-pad, stick and touch. |
| Art readability | Every live actor and terrain role remains distinguishable over pixel, painterly, photographic and graphic backgrounds; reveal FX never hide the current trail or imminent contact. |

Before building all twelve stages, a small prototype should validate one open board, one mixed-terrain board and one changing-contour board. That sequence tests the distinctive reference mechanics before expensive chapter production. The existing authoring validator remains useful for structural content checks; it does not yet validate the behaviors proposed here.
