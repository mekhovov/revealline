# Three original route-choice challenge layouts

These authoring candidates use the unchanged runtime at `575af1ac35da0998eb990d5e28fbfba8d6d008bd`. Each has a distinct 72 × 36 wall layout, level ID and saved practice context. They extend the earlier single-clearing teaching demos with route choices. They remain outside public catalogs and build includes; no runtime, schema, existing map or replay fixture changes are included.

The source theme and seven class recipes come from the exact registered byte pins in [build.mjs](build.mjs). All pictures are **procedural placeholders**. New original illustration candidates being prepared separately are not assigned, embedded or verified here. No finished music or human difficulty claim is made. These studies do not complete Tactical mode, cargo delivery, realistic communication or the broader production campaign.

## Authored progression

| Study                                                           | Real geometry and objective                                                                                                                    | Choice and counterplay                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Forked Approach](scenarios/challenge-forked-approach.json)     | Start at the top center. A central horizontal barrier splits two exits, with asymmetric western and eastern ribs. Reveal 30%; no relay.        | Direction-only Arcade. Read the interceptor warning, pick a side before reaching the wall, and reconnect at the bottom safe edge. The warning locks its target; staying against the center wall leaves the cable exposed to travelling line-hit fronts. Walls cannot close a cut.                                            |
| [Crosswind Depot](scenarios/challenge-crosswind-depot.json)     | A western gate between two vertical walls and a separate eastern rib divide the routes. Reveal 45% and the visible western relay.              | Recommended Light carrier: collect at home, fly Down about five cells, then use its stun field before the patrol crosses the cable. A longer equipment-free route uses the safe west border, the middle gate and two cuts. Supply/field are a time advantage, not a mandatory hidden win flag or cargo delivery.             |
| [Signal Switchback](scenarios/challenge-signal-switchback.json) | Begin halfway down the west edge; upper wall pockets and a lower bar flank a full-height interference band. Reveal 48% and the northern relay. | Recommended Fiber: take the horizontal shortcut through the band. Scan can reveal the relay there, but a scan is not required to win. Signal resistance preserves speed and equipment; it does not extend the eight-second / 76-cell cable limits. Scout can use the safe northern rim and cross vertically beyond the band. |

The goals, corridors and resource limits form an intended progression; successful fixed input traces do not establish player difficulty, fairness or enjoyment. No successful route depends on waiting for an enemy phase. The equipment-free depot route makes two captures and supplies a fresh direction after the first stopped closure. A separate test holds that stopped capture for one second only to check continuing world simulation and saved-session behavior.

The exact transport remains `xonix-playground.v5`, `xonix-level.v4`, `xonix-core.v5` and `xonix-replay.v6`. Only Forked Approach opts into `classic.arcadeActions` version `arcade-actions.v1`; it disables manual ability, Supply and Boost. The other studies keep the existing manual equipment contract. The pressure actor uses `enemy-pressure.v1`; its line fronts use `line-impact.v1`. There are no new primitives, roster overrides, mastery predicates or simulated outcomes assigned by the proof controller.

## Try in the isolated source checkout

Start the ordinary development server and open `game/playground/`. Import a scenario JSON from the links above, inspect its recommended class and rules, then use **Play configuration**. The existing ready card and full Mission brief display the scenario's `Recommended:` teaching text. There are no new launcher buttons or campaign awards. These manual import and full-preview journeys still need actual browser/input/readability review for these particular layouts.

The depot fallback travels Left along the top edge to the west border, Down to the middle row, Right through the western gate to the central column, then Down to close at the bottom border. After that partial capture stops, release and choose Up for the second cut. The signal fallback travels Up the west edge, Right along the top safe border beyond the band, then Down through the eastern corridor. Safe-edge travel costs time but avoids the relevant equipment hazard.

## Reproducible source evidence

```sh
node scripts/verify-tactical-challenges.mjs
node --test game/test/tactical-challenges.test.mjs
```

[The verifier](../../../scripts/verify-tactical-challenges.mjs) follows the existing small teaching-proof structure. It requires exact builder output, registered source pins, bounded commands, exact unique route coverage and the full generated proof record. It simulates each route through the real core, verifies the exported replay, compares its authoritative checkpoint and restores a serialized unfinished session before replaying the complete suffix. [routes.json](routes.json) contains **24 traces: 14 wins and 10 deliberate failures, 18,200 total ticks, under both immediate and grid-center steering**. Each of the 24 routes has a verified saved continuation.

| Route                                 | Result in either policy                                                                   |
| ------------------------------------- | ----------------------------------------------------------------------------------------- |
| Forked west exit                      | 66.3194%, 15,280, 606 ticks                                                               |
| Forked east exit                      | 35.4167%, 8,160, 594 ticks                                                                |
| Blocked center                        | Enemy-trail loss after a seeded line front arrives; 660 immediate / 650 grid-center ticks |
| Depot supply + field                  | 51.2998%, 12,340, 415 ticks; 300 enemy-stun ticks                                         |
| Depot omitted pickup or omitted field | Enemy-trail loss, 195 ticks                                                               |
| Depot equipment-free western gate     | 75.0867%, 17,830, 1,687 immediate / 1,699 grid-center ticks, two captures                 |
| Fiber shortcut with or without Scan   | 53.0736%, 12,760, 846 ticks                                                               |
| Fiber long dogleg                     | Cable-limit loss, 919 ticks, before the time limit                                        |
| Scout through the same band           | Scan rejected by interference, cut-timeout loss, 966 ticks                                |
| Scout northern-rim route              | 63.9827%, 15,280, 1,170 ticks; no interference exposure                                   |

Winning traces retain the single authored life. Saved prefixes explicitly include pressure warning, committed pursuit and cooldown; a live carrier stun; Fiber inside the band; and the first stopped depot capture. Tests also reject altered geometry, foreign contexts, duplicate/missing routes, fabricated outcomes, modified saved evidence and manual Arcade commands. The underlying pressure routes and capture physics remain unchanged.

`node authoring/library/tactical-challenges/build.mjs --write` materializes the three scenarios only when the destination files are absent. `node scripts/verify-tactical-challenges.mjs --record` similarly refuses to overwrite its proof fixture. Routine verification is read-only. Preserve earlier authoring evidence before any intentional revision; independent source/proof review must precede a new catalog, artwork assignment or public integration.

Actual browser journeys, touch/controller hardware, small-screen presentation, audio continuity and human challenge testing remain separate gates. No newly generated source image, video or personal uploaded media is read by this builder or verifier.
