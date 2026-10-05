# Snake field mechanics v4

The catalogue appends 24 missions without changing any of the 96 v1–v3 recipes. Signal Tactics has ten missions (including a broadcast introduction/mastery pair), Patrol Frontiers six, and Field Mastery eight. Each mechanic has an isolated introduction followed by a harder route; combined encounters follow those introductions.

`classic-core.mjs` dispatches the `classic-snake-level.v4`, `classic-snake-core.v4`, and `classic-snake-replay.v4` contracts. Unprofiled v4 and `local-burst-v1` recipes retain their original deterministic simulation. Current local missions use `local-burst-v2` with recipe revision 3; broadcast recipes are unchanged. Jammer profiles are explicit recipe fields, revised rows have new recipe identities, and accepted attempts retain a separate `hazardSeed`. `prepareClassicSnakeLevel` retains v4 mechanics when changing pace or producing an explicit variant.

## Rules and counterplay

| Kind        | Behavior                                                                                           | Counterplay                                                                                                       |
| ----------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `jammer`    | Local six-cell interference or an explicit full-board broadcast, with a warning before each burst. | Read the antenna and radius, approach between bursts, use Pulse, or catch the source.                             |
| `lane`      | Warns before activating its authored lane for two moves, then rests for eight.                     | Cross during recovery or use a permanent connected bypass. Only the head is vulnerable.                           |
| `relay`     | Contact is protected until both linked diamond pads are collected.                                 | Visit both pads without growing the cable, then catch the core. The opening stays available.                      |
| `perimeter` | Follows an adjacent-cell circuit around the outer field.                                           | Intercept across the interior; a blocked patrol waits.                                                            |
| `contour`   | Follows an authored island contour.                                                                | Meet its next corner. Its path never crosses occupied snake cells.                                                |
| `rover`     | Starts dormant; warns when a head is within six traversable cells, then approaches.                | Approach from open ground. The body is always safe to catch.                                                      |
| `ricochet`  | Moves straight and reverses at a blocked cell.                                                     | Intercept its predictable returning route. Its body is always safe to catch.                                      |
| `eroder`    | Warns before opening an explicitly marked adjacent wall cell.                                      | Use the new opening or the permanent outer bypass. It cannot create walls.                                        |
| `guard`     | Locks an authored heading, warns, then fires a one-cell-per-move projectile.                       | Move the head away from its marked next cell and approach the guard from the side. Catching it removes its shots. |

Lanes and other legacy specialist warnings last `max(4, ceil(800 / minStepMs))` moves. Profiled jammers use at least 800 ms of deterministic warning, 600–1,400 ms bursts and 2,000–4,400 ms rest at the authored fixed paces. A shared clear interval is at least 1,600 ms, and only one source may transmit at once. Local and broadcast schedules draw from dedicated source RNG seeded by the accepted `hazardSeed`; they do not consume target-motion or spawn RNG. No wall-clock callback changes the simulation. A lane/guard cannot begin a new attack during jamming, and a pending warning restarts with its full duration after interference. Jamming waits for existing lane attacks/projectiles to finish. Pulse freezes enemy movement and current attack phases, including projectiles; player heads continue moving.

For `local-burst-v2`, a living head must be within the source's six-cell Euclidean radius before a warning can start. Team uses either living head and wrap boards use wrapped distance; cable segments alone do not trigger reception. Leaving coverage cancels a warning, or ends an active burst and begins recovery plus the shared clear interval. Re-entry waits for recovery and a fresh full warning. Thus a burst cannot be prepared outside coverage and surprise the player on entry. Broadcast scheduling remains independent of proximity. Reception status only describes sources that actually cover a living head, including during playback of older local recordings.

New attacks are head-only. Projectile birth yields while any snake segment occupies the birth cell. Projectiles stop at walls and board boundaries. Relay pads do not emit enemy-catch events or grow the body. All catches retain the existing accepted-step transaction: a fatal simultaneous Team move cancels every catch on that move.

## State and presentation

V4 adds `signal`, `projectiles`, `relays`, and `removedWalls` to the replay checkpoint. `target.caught` remains the enemy-statistics event. `relay.collected`, `target.opened`, and `wall.opened` are separate events. A win clears interference and remaining projectiles before the victory presentation.

The renderer processes the live full-board feed with the shared `applyAnalogSignalNoise`, blending at most 65% processed pixels with tearing bounded to 0.15 cell. Every simulation tick refreshes actor positions. Heads, their two-cell neighborhood (including wrap seams), and jammer source cells stay readable; antenna and radius cues are painted after interference. A host-owned status line sits outside the playfield.

Reduced effects freezes only the noise pattern and removes tearing, not the live image. Pulse temporarily stabilizes reception and pauses the source deadlines. A terminal collision is shown clearly for failure review. Scene selection and visual-noise generation never change simulation RNG, input timing, or collision geometry.

Living Circuit adds Auto, Orchard Workshop, Workshop, and Field Relay scenes. Shared material pixels form a quiet traversable floor; raised materials mark actual wall cells only. Trees, workshops, and machinery decorate the outer board-card frame without shrinking or cropping the canvas. `classic-scenes.mjs` resolves scenes by explicit choice/chapter identity; `classic-view.mjs` retains native actor facing and art revisions.

Relays show links and collected checkmarks; projectiles mark the next cell; lane warning and active states use different line styles as well as color. `classic-mechanic-guide.mjs` supplies English and Ukrainian names, tells, and counterplay through the shared guide component.

## Qualification

`game/test/fixtures/classic-snake-v4-proofs.json` contains 144 winning recordings: all 24 missions in Solo and Team, at Slow, Normal, and Fast pace, with default seed 17. Every recording binds its full accepted recipe and exact checkpoint; profiled recordings also bind the hazard seed. Fast warning durations change simulation timing; normal recordings are not merely retimed to create fast proofs.

The official recipe archive admits nine exact retired definitions: five unprofiled revision-1 recipes and four local-v1 revision-2 recipes. Continue, import and Retry retain an admitted historical recipe rather than replacing it with the current catalogue row. Installed packages receive no archive authority from a matching ID. `classic-snake-v4-archive-proofs.json` retains 30 fixed-schedule recordings and their existing grades; `classic-snake-local-v1-proofs.json` retains all 24 previous local-v1 recordings and their completion-only records. Archive admission and checkpoint tests verify the retained bytes without rewriting old proof records.

The qualification pilot in `game/test/helpers/classic-snake-v4-playthrough.mjs` only submits regular legal turns. It cannot modify positions, catches, hazards, or RNG. These recordings establish completion and replay compatibility for their exact setups; they do not prove optimal routes or replace human touch/controller balance review. Variable-hazard routes earn a completion star and personal records; fixed-seed silver/gold calibration is not reused for their varying schedules.

The [coverage follow-up record](verification/living-circuit/coverage-followup.md) separates current lifecycle/compatibility checks, 18-route simulation measurements, and mobile result observations from earlier build evidence.

Run the focused regression group with:

```sh
node --test game/test/classic-snake-core.test.mjs game/test/classic-snake-v2.test.mjs game/test/classic-snake-v3.test.mjs game/test/classic-snake-v4.test.mjs game/test/classic-snake-presentation.test.mjs game/test/classic-snake-signal-rendering.test.mjs game/test/classic-snake-scenes.test.mjs game/test/classic-snake-variable-signal.test.mjs game/test/classic-snake-local-coverage.test.mjs game/test/classic-snake-archive.test.mjs
```
