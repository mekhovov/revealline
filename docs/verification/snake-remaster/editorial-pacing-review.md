# Editorial pacing review: first chapters and quiet-interval candidates

This is an authored recipe and route review, not a player study. It follows the
prior 97-mission quiet-interval shortlist in `catalogue-trace-review.json`; that signal
counts discrete state changes and deliberately does not count ordinary movement.
It therefore cannot distinguish thoughtful steering from boredom on its own.

The review covers **48 missions**, one complete first expansion chapter in each
world, plus **eight selected outliers** outside those chapters. Actual walls,
objective ordering, target rules, cargo, switches, gates and neighbouring lessons
were inspected. Two recipes change; all catch quotas stay unchanged. The other
54 recipes retain their current gameplay. Existing tactical revisions count as
retained here rather than being claimed again as new work.

## Two changes and their evidence

### Loaded Excavation — repair a promised choice

`classic-operation-loaded-excavation` had a wall occupying x=11–12, y=4–13.
Its only eroder marks (11,8). Breaking that cell left (12,8) intact, so the
advertised central passage never existed. The player could win by going around,
but waiting for the marked demolition could not buy the promised direct route.
This was found by inspecting geometry, not because the trace was long.

Remove only (12,8), creating a visible far-side recess. The marked (11,8) cell
still blocks the passage until the existing eroder warning completes. Between
(10,8) and (13,8), the terrain-only shortest route remains 13 moves before the
break and becomes three after it. The old recipe stayed at 13 even after the
break. The permanent outer approach, three catches, two parcels, dock, stages,
enemy sequence and warning rules are unchanged. No new hazard is introduced.

The regression checks the actual eroder opening at slow, normal and fast pace,
including at least 800 ms between warning and accepted opening. It also checks
that both historical recipes remain available through explicit archive lookup.
The landmark's existing solid anchor at (11,11) is unaffected by the recess.

The reference pilot takes **107 Solo / 73 Team moves** at each pace, compared
with 99 / 69 for its old recipe routes. This is not a claimed speed improvement:
a new open cell changes later seeded prey placement and the pilot's choices.
The improvement is that a previously false route option now works. Shorter
terrain distance does not establish a universally better full-cable route.

### Pressure Elbow — make the shortcut serve the pursuit

`classic-operation-pressure-elbow` previously combined three freely roaming
runner catches with a pad activation and an east-side exit. The runner could
remain on the approach side, making the named elbow shortcut largely unrelated
to interception. Neighbouring Near and Far already covers a free pursuit around
a two-sided gate; Double Pressure follows with two independent shortcuts.

Use the existing v6 runner commitment on the clear east-side route
(14,6)–(14,13), beyond the wall at x=13. Catching now asks whether to hold the pad
at (9,9) and use the gate at (13,10), or approach a committed endpoint around the
permanent lower bypass. This adds no mechanic or control, changes no wall, and
keeps all three catches, stages, exits and warning rules. The two endpoints and
recovery state provide interception opportunities rather than perfect evasion.

Reference routes change as follows. These are verified witness lengths, not
optimal-route claims or a measure of enjoyment:

| Setup         | Before | Revised |
| ------------- | -----: | ------: |
| Solo / normal |     85 |      45 |
| Solo / slow   |     85 |      45 |
| Solo / fast   |     85 |      53 |
| Team / normal |     53 |      35 |
| Team / slow   |     53 |      35 |
| Team / fast   |     53 |      39 |

Both changes receive new recipe identities and completion stars only. Old raw
operation recipes and journals remain untouched; explicit archive lookup finds
the prior recipes, while fresh official progress accepts only current recipes.
No foundation v1 recipe or unrelated game mode changes.

## Chapter-by-chapter editorial decisions

All IDs in the following six tables have the prefix `classic-operation-`.
Every row is a reviewed mission, not a generated uniqueness claim. “Keep” means
its current decision is justified by the inspected recipe; it does not assert
that every player will enjoy it.

### Freight Switchyard — Switchyard Pursuit

| Mission ID suffix | Decision and pacing judgement                                                                                                                                                            |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| first-dispatch    | Keep. One junction and two catches teach selection followed by interception. The opposite lever gives a second approach; adding another enemy would dilute the first lesson.             |
| long-and-short    | Keep. Unequal loops and opposite exit stages change the return distance. The open area outside the machinery provides recovery between commitments.                                      |
| platform-cut      | Keep. A patrol follows a platform edge while the player cuts the clear centre. The offset walls change the interception line, rather than merely extending First Dispatch's quota.       |
| courier-gap       | Keep. The runner competes with a routed patrol for attention; both can be intercepted before the upper rendezvous. Two active targets create a choice absent in Platform Cut.            |
| twin-dispatch     | Keep. Independent west/east controls introduce ownership; the central return lets a partner divide the task. Retain the open crossing so switching is not a compulsory tight-cable trap. |
| edge-express      | Keep. Wrapping reaches the far lever, while the patrol itself remains on its marked route. The changed approach is the lesson, not faster patrol motion.                                 |
| shutter-transfer  | Keep. The route decision occurs before the timed court; an outer bypass avoids forced waiting. The final exit deliberately tests the shutter approach after interception.                |
| last-departure    | Keep. Two dispatch activations and a sprinter combine established commitments with a longer homeward cable. This chapter finale earns its extra pressure; no additional quota is needed. |

### Copper Foundry — Cable Foundry

| Mission ID suffix | Decision and pacing judgement                                                                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| first-pressure    | Keep. Zero catches are needed for the first crossing, isolating body-held gate learning; one catch belongs to the return. The outer route stays available.                                                    |
| near-and-far      | Keep. Pads on opposite sides of a single divider support approaching or reopening on return. Its 29-move sampled quiet interval includes routing around a real barrier; no evidence requires shaving catches. |
| pressure-elbow    | Revise as above. East-side commitment makes the pad and elbow relevant to the runner, instead of duplicating Near and Far's free pursuit.                                                                     |
| double-pressure   | Keep. Independent gates ask which side to secure first. The 28-move quiet flag does not erase that order decision; the central court supplies turning room.                                                   |
| heavy-crossing    | Keep. Two temporary cargo segments help hold a thick gate, then unloading changes the return. Replacing the load with more catches would lose the reversible-length lesson.                                   |
| runner-valve      | Keep the existing v6 revision. Its committed L-shaped switchback makes the shortcut an interception option, and outside recovery offers a second approach. Do not count this as new work.                     |
| edge-pressure     | Keep. Wrapping competes with the closed direct crossing and allows access to the far pad. It changes the meaning of the barrier without adding an unrelated hazard.                                           |
| assembly-return   | Keep. Opposite deliveries and two pads justify Team division, followed by a central rendezvous. Solo retains a sequential route; its travel serves cargo and gate decisions rather than an empty quota.       |

### Orchard Research Station — Loaded Routes

| Mission ID suffix   | Decision and pacing judgement                                                                                                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| orchard-post        | Keep the existing committed-runner revision. Two parcels share one dock before the lighter interception; this remains the cargo introduction.                                                      |
| split-delivery      | Keep. Four parcels share two mismatched docks, allowing batching versus short individual trips. Forcing two separate delivery stages would remove that planning choice and duplicate Two Harvests. |
| glasshouse-elbow    | Keep. The dock lies before the cramped return, connecting unloading with turning room. The quiet outer approach is useful preparation, not necessarily dead time.                                  |
| two-harvests        | Keep. North delivery activates southern cargo, explicitly teaching stage-specific pickup availability. This is different from Split Delivery's simultaneously available load choices.              |
| refuge-cargo        | Keep the existing aisle commitment. A dock beyond the east wall and two interceptable aisle ends compete for the loaded return.                                                                    |
| irrigation-shortcut | Keep. Carrying length helps hold the irrigation crossing; unloading changes the useful path back. The outer detour preserves a clear fallback.                                                     |
| border-harvest      | Keep. Opposite-edge parcels make wrapping useful while the cable still occupies its traversed seam. Central delivery prevents the mission collapsing into two adjacent pickups.                    |
| harvest-rendezvous  | Keep the existing committed sprinter. North/south loads then a central meeting combine familiar tasks; burst recovery separates pressure from delivery planning.                                   |

### Tidal Relay Harbor — Split Horizons

| Mission ID suffix | Decision and pacing judgement                                                                                                                                                                |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| harbor-clearances | Keep. First catch, opposite extraction, then return establishes staged wrapping without cargo or a lethal overlay.                                                                           |
| seam-parcels      | Keep. Matching docks across each edge make two short deliveries, followed by a central interception. This introduces loaded seams after the simpler clearances.                              |
| north-south       | Keep the existing complementary pair route. Opposite approaches and north/south exits give wrapping a tactical use and permit Team role separation.                                          |
| offset-quays      | Keep. Offset solid quays prevent a direct chase, while refuge destinations and the edge offer different approaches. It tests destination prediction rather than repeating the paired routes. |
| tidal-door        | Keep. A central plate crossing competes with the wrap. Because both paths remain viable, the player can account for current cable occupancy instead of waiting.                              |
| quay-dispatch     | Keep. Wrapping reaches the lever, but the junction's patrol route stays local. This teaches that player topology and authored prey topology need not match.                                  |
| lighten-at-sea    | Keep. Alternating loads become available after delivery, making shortening before the next return meaningful. The final centre approach gives the last load a destination beyond its dock.   |
| horizon-relay     | Keep. West, south and east exits combine direction changes with runner/switchback pursuit. Open interior lanes let Team divide space between the two cables.                                 |

### Alpine Observatory — Signal Smugglers

| Mission ID suffix  | Decision and pacing judgement                                                                                                                                                                               |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| silent-parcel      | Keep the existing mobile local source. Cargo can skirt coverage or intercept the source during recovery. Retain the full warning and do not increase blindness to manufacture difficulty.                   |
| ridge-reception    | Keep. The divider separates two local sources; the first clearance makes the second flank useful. The switchback is a later interception rather than another stationary antenna quota.                      |
| broadcast-freight  | Keep. Global concealment changes the local-circle lesson, while two parcels and a shared dock retain readable terrain and objectives. Catching the source remains an immediate alternative.                 |
| unseen-dispatch    | Keep. The visible switch establishes a route before broadcast hides the patrol. The later runner makes source removal versus remembered interception a real choice.                                         |
| clear-side-channel | Keep. Parcels and docks on opposite edges give a clear seam alternative to local coverage. Two different emitters change the useful approach across stages.                                                 |
| pulse-rendezvous   | Keep. Pulse after the first catch offers a deliberate detour; catching the antenna can avoid it. Cargo activates later, so the supply has a readable upcoming use.                                          |
| receiver-bridge    | Keep. A visible plate/gate stays reliable when actors disappear. The return traverses the receiver wall in the opposite direction; this is not a pure visual-noise variant.                                 |
| summit-blackbird   | Keep. Local approach, broadcast return and a later lane combine known hazards with staged deliveries. Preserve hazard coordination and the full post-interference warning rather than overlapping pressure. |

### Basalt Gardens — Breaking Ground

| Mission ID suffix   | Decision and pacing judgement                                                                                                                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| first-notch         | Keep. A one-cell wall genuinely opens at its marked cell. The permanent outside path lets the player choose whether to wait before catching the source.                                                         |
| loaded-excavation   | Revise as above. Make the advertised opening penetrate the thick wall; preserve the loaded outer route and every objective.                                                                                     |
| stepped-masonry     | Keep. Its two breaks remove exposed corners, not a promised through-tunnel. The description correctly says the stepped island changes shape and advises going around the end.                                   |
| survey-seam         | Keep. Two single-cell dividers can open later, while wrapping already provides a detour. The central dock makes the loaded return differ from the initial survey.                                               |
| temporary-permanent | Keep. One plate-held gap and a separate permanent break support different return plans. The 28-move sampled quiet interval contains traversal around a real divider, not forced inactivity.                     |
| ricochet-quarry     | Keep. Removing a cell in the horizontal arm changes the reflected actor's environment; opposite deliveries retain the wide outer arc as recovery space.                                                         |
| restored-arch       | Keep. Relay pads lie outside opposing arch sides; cargo lies inside. The side break can aid the loaded return, but the open bottom remains a valid exit.                                                        |
| garden-breaches     | Keep. Three marked single-cell breaks, moving prey and north/delivery/south stages provide a chapter synthesis. The two active-actor cap keeps the three demolition sites from all demanding attention at once. |

## Additional shortlisted recipes

| Exact mission ID                     | Evidence and editorial decision                                                                                                                                                                                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| classic-expedition-courier-overpass  | Keep. Prior alternate proofs reduce Solo from 1,226 to 119 moves without changing the recipe. The long route chases the optional courier; the required interception remains available. Do not remove the optional gamble to optimize one pilot.                                      |
| classic-pursuit-supply-circuit       | Keep. Prior alternate Team proof reduces 284 to 127 moves. Supply choice and a shorter accepted route remain available; this is not evidence for a lower catch quota.                                                                                                                |
| classic-pursuit-three-way-escape     | Keep pending player observation. Edge-anchored walls create broad junction choices for a free runner; the 38-move quiet interval still includes choosing which exit to cover. It is a pacing watch item, not an established defect.                                                  |
| classic-pursuit-final-airfield       | Keep pending player observation. Twelve catches, two prey families, offset shutters and Pulse/Reel form a long mastery encounter. Its 38-move quiet interval could feel slow, but reducing the goal would also remove the long-cable/supply phase; no automatic change is justified. |
| classic-pursuit-zigzag-exit          | Keep. Opposite edge-reaching walls force use of central gaps; a six-catch goal grows the cable through that route. The 37-move signal alone does not establish redundant catches.                                                                                                    |
| classic-expedition-tail-workshop     | Keep. Brace recovery and Reel after three catches give the narrow inner route a changing value. The 35-move quiet flag does not count ordinary pursuit and should not erase this length-management decision.                                                                         |
| classic-pursuit-runner-at-the-window | Keep. One timed west opening competes with the permanently open east side of the ring. Pulse after two catches creates a reason to revisit the shortcut; preserve the bypass rather than accelerate the shutter.                                                                     |
| classic-operation-two-landings       | Keep. The first landing activates the second cargo delivery, and the open channel between pump islands connects their opposite returns. The 29-move interval includes serving different docks rather than repeating a catch at one cell.                                             |

## Verification and limits

- `node scripts/qualify-snake-remaster.mjs --mission=pressure-elbow --check`
- `node scripts/qualify-snake-editorial.mjs --check`
- `node --test game/test/classic-snake-editorial.test.mjs`
- Release A/B retained recipe replay and current official record tests also run.
- English and Ukrainian descriptions explain both changed decisions.
- New proofs are in `tactical-proofs.json` (six Pressure Elbow witnesses) and
  `editorial-proofs.json` (six Loaded Excavation witnesses).
- Catalogue-wide trace regeneration includes only exact current recipe evidence;
  old raw operation proofs remain retained rather than being rewritten.

No quota was lowered, no foundation recipe changed and no new mechanic was added.
This review does not establish aesthetic quality, player enjoyment or universal
solvability across random setups. The unreviewed remainder of the 97-mission
shortlist remains visible in the trace report. Higher-star calibration and
physical-device play observation remain separate work; successful journals do
not justify silently assigning gold budgets.
