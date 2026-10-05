# Snake field mechanics v4

The catalogue appends 22 missions without changing any of the 96 v1–v3 recipes. Signal Tactics has eight missions, Patrol Frontiers six, and Field Mastery eight. Each mechanic has an isolated introduction followed by a harder route; combined encounters follow those introductions. The first eight mechanics/replay tests were run successfully before the later catalogue entries were enabled.

`classic-core.mjs` dispatches the `classic-snake-level.v4`, `classic-snake-core.v4`, and `classic-snake-replay.v4` contracts. Version 4 is a separately frozen simulation implementation, preserving historical replay behavior. `prepareClassicSnakeLevel` retains v4 mechanics when changing pace or producing an explicit variant.

## Rules and counterplay

| Kind        | Behavior                                                                            | Counterplay                                                                                                       |
| ----------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `jammer`    | Twelve recovery moves, a warning, then four moves of full signal loss.              | Memorize an open route before the blackout; Pulse temporarily restores the feed, and catching the jammer ends it. |
| `lane`      | Warns before activating its authored lane for two moves, then rests for eight.      | Cross during recovery or use a permanent connected bypass. Only the head is vulnerable.                           |
| `relay`     | Contact is protected until both linked diamond pads are collected.                  | Visit both pads without growing the cable, then catch the core. The opening stays available.                      |
| `perimeter` | Follows an adjacent-cell circuit around the outer field.                            | Intercept across the interior; a blocked patrol waits.                                                            |
| `contour`   | Follows an authored island contour.                                                 | Meet its next corner. Its path never crosses occupied snake cells.                                                |
| `rover`     | Starts dormant; warns when a head is within six traversable cells, then approaches. | Approach from open ground. The body is always safe to catch.                                                      |
| `ricochet`  | Moves straight and reverses at a blocked cell.                                      | Intercept its predictable returning route. Its body is always safe to catch.                                      |
| `eroder`    | Warns before opening an explicitly marked adjacent wall cell.                       | Use the new opening or the permanent outer bypass. It cannot create walls.                                        |
| `guard`     | Locks an authored heading, warns, then fires a one-cell-per-move projectile.        | Move the head away from its marked next cell and approach the guard from the side. Catching it removes its shots. |

All new warnings last `max(4, ceil(800 / minStepMs))` moves, so faster accepted setups still show at least 800 ms of warning. No wall-clock callback changes the simulation. A lane/guard cannot begin a new attack during jamming, and a pending warning restarts with its full duration after interference. Jamming waits for existing lane attacks/projectiles to finish. Pulse freezes both movement and current attack phases, including projectiles.

New attacks are head-only. Projectile birth yields while any snake segment occupies the birth cell. Projectiles stop at walls and board boundaries. Relay pads do not emit enemy-catch events or grow the body. All catches retain the existing accepted-step transaction: a fatal simultaneous Team move cancels every catch on that move.

## State and presentation

V4 adds `signal`, `projectiles`, `relays`, and `removedWalls` to the replay checkpoint. `target.caught` remains the enemy-statistics event. `relay.collected`, `target.opened`, and `wall.opened` are separate events. A win clears interference and remaining projectiles before the victory presentation.

The renderer reads those fields without advancing gameplay or consuming RNG. The jammer warning includes a dashed amber arena edge. During the four interference moves, an opaque signal-loss screen replaces the entire playfield: enemies, snake movement, walls, relays, remains, and other world effects are not drawn underneath it. The arena boundary, cut-antenna symbol, English/Ukrainian instructions, recovery pips, and remaining-move count stay visible. Players must plan an open route before reception drops and keep steering from memory.

Pulse temporarily stabilizes the feed while freezing the existing jammer phase; its remaining interference resumes when Pulse ends. A terminal collision reveals the board for failure review. Reduced effects uses stationary bands with exactly the same concealed information, rather than granting extra visibility. This presentation refinement changes neither the v4 simulation timing nor recipe/replay identities.

Relays show links and collected checkmarks; projectiles mark the next cell; lane warning and active states use different line styles as well as color. `classic-mechanic-guide.mjs` supplies English and Ukrainian names, tells, and counterplay through the shared guide component.

## Qualification

`game/test/fixtures/classic-snake-v4-proofs.json` contains 132 independently generated, verified winning recordings: all 22 missions in Solo and Team, at Slow, Normal, and Fast pace, with default seed 17. Every recording binds its full accepted recipe and exact checkpoint. Fast warning durations change simulation timing; normal recordings are not merely retimed to create fast proofs.

The qualification pilot in `game/test/helpers/classic-snake-v4-playthrough.mjs` only submits regular legal turns. It cannot modify positions, catches, hazards, or RNG. These recordings establish completion and replay compatibility for their exact setups; they do not prove optimal routes or replace human touch/controller balance review. Ratings can use these verified routes while preserving separate setup identities.

Run the focused regression group with:

```sh
node --test game/test/classic-snake-core.test.mjs game/test/classic-snake-v2.test.mjs game/test/classic-snake-v3.test.mjs game/test/classic-snake-v4.test.mjs game/test/classic-snake-presentation.test.mjs game/test/classic-snake-signal-rendering.test.mjs
```
