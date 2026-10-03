# Classic Snake improvements

Classic Snake is now the default 2D Snake experience. It has automatic grid
movement, a complete visible starting body, one humanoid collectible at a time,
contact growth and immediate wall/body failure. The earlier territory-based
edition remains available as the Capture remix, with its saved identities intact.
Sim remains a separate flight interpretation.

This describes candidate implementation on `codex/snake-hunt-campaigns`, reviewed
on 3 October 2026. It is not a production-publication receipt.

## Research and resulting decisions

The following references informed the design. The implementation choices are our
inferences from those sources; no reference establishes one universal Snake
specification, and no third-party artwork, levels or game code were copied.

| Reference                                                                                                                                                                                                                                                                                                                                 | Relevant finding                                                                                                                                                          | Decision in this game                                                                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Google Maps Snake announcement](https://blog.google/products-and-platforms/products/maps/sssnakes-map/) and its [official standalone game](https://snake.googlemaps.com/)                                                                                                                                                                | Google's variation uses collecting passengers while avoiding the map boundary and the train itself.                                                                       | Keep the collection-and-self-avoidance loop immediately recognizable, while using the game's existing humanoid visual language.                                                                                               |
| [Nokia 8265 user guide, printed page 98](https://www.instructionsmanuals.com/sites/default/files/2019-05/Nokia-8265-en.pdf#page=105)                                                                                                                                                                                                      | The original manufacturer manual, retained by a third-party archive, describes food-driven growth, scoring, clear fields or mazes, and game over on tail or wall contact. | Start with a visibly complete snake on an empty board; introduce mazes later. Classic rounds end on collision rather than using territory-game recovery.                                                                      |
| [Battlesnake's official rules](https://docs.battlesnake.com/rules)                                                                                                                                                                                                                                                                        | The developer documents discrete moves, body/head collisions and simultaneous turn resolution. Its competitive head-to-head outcome depends on length.                    | Resolve Team movement from one pre-step state, including head swaps and tail vacancy. Our cooperative rule ends the shared round on any fatal collision; it does not adopt Battlesnake's length-based duels or health system. |
| Xbox accessibility guidance on [input](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/107), [difficulty](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/108) and [motion](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/117) | Microsoft recommends flexible input and challenge options and control over distracting motion.                                                                            | Provide tap-to-turn controls, pace selection, pause, visible control help and independently selectable cosmetic effects. These features support accessibility review; they do not establish compliance with every guideline.  |

The four-cell initial body, two-turn buffer, 24 × 18 board, finite catch goals and
specific timing values are deliberate choices for this game. Wrapping edges and
fleeing collectibles are named variants; stationary collectibles form the default
classic introduction.

## Implemented gameplay

- The snake starts with four distinct, visible cells and advances automatically
  after Start. A direction press queues a turn. Direct reversals are rejected
  against the most recent accepted heading, and at most two turns can wait.
- One humanoid occupies a free grid cell. Catching it adds one body cell and 100
  points, then spawns the next target. Completing the accepted finite goal wins.
  Targets cannot spawn in static wall pockets or on a current body.
- A wall or occupied body cell ends the round. Moving into a tail cell is legal
  only if that cell vacates in the same non-growing transaction. There are no
  safe borders, coverage requirements, shooting guards or extra lives in Classic.
- Selected levels wrap across edges. Selected moving-quarry levels let the one
  target take a fleeing step every four or five snake steps, using current head
  positions rather than predicting future input.
- Slow, Normal and Fast prepare distinct pace recipes. Later chapters also earn
  modest speed increases through catches. Pause, page hiding and focus loss stop
  advancement. Keyboard arrows/WASD, swipe and on-screen direction pads are
  implemented; physical-device qualification remains separate.

### Modes and content

There are **48 classic layouts in eight six-level chapters**, with goals of
8–20 catches. The chapters are First Coils, Wide Turns, Island Circuits, Moving
Quarry, Borderless Routes, Chicanes, Shared Circuits and Final Weave. Eight levels
wrap and nine use fleeing targets. Native English and Ukrainian names and
geometry-specific instructions accompany every level. The same layouts serve
all three modes; mode copies are not counted as additional levels.

| Mode   | Rules                                                                                                                                                                                                                                                                                                                          |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Solo   | One snake, one board and the finite catch goal.                                                                                                                                                                                                                                                                                |
| Versus | Two independent boards use matched accepted recipes and seeds. Each board advances on its own earned clock. A goal completion or opponent crash decides the result; events due at the same time resolve together. The deterministic preferred target sequence is shared until body occupancy requires a different legal spawn. |
| Team   | Two snakes share one board, one target and one catch goal. Either snake can claim the target once. Any fatal contact ends the shared round and cancels catch credit in that transaction; head-on and head-swap contacts are fatal.                                                                                             |

The catalogue adapts the 48 Capture-remix layout ideas into smaller grid
obstacles. It does not claim 96 independently conceived maps. The first classic
level is deliberately empty. See [the complete catalogue description](classic-snake-catalogue.md).

The existing **24 Sim courses** remain in four playlists, supporting both
Self-level and Acro with physical drone contact and a world-space echo tail.
Those are flight controls and course records, not the classic grid core. See
[Sim Snake Hunt](sim-snake-hunt.md).

### Presentation, records and saved rounds

Clean catches work by default. Brutal destruction, blood/body parts, settled
remains and reduced effects use presentation settings; none changes target
contact, body collision, score, random state or completion. Gameplay bodies stay
visible even when decorative effects are reduced.

Classic has separate local records and a saved-round format. The accepted level,
mode, pace, seed, pending turns and each board's elapsed clock belong to the run.
Replay restoration reconstructs the deterministic simulation and verifies its
checkpoint before replacing the live round. The UI wrapper preserves fractional
time between moves. Imported core state cannot simply supply a body or score.
Historical Capture-remix and Sim formats retain their own ownership.

## Entry routes and compatibility

Use `game/snake/index.html` for the campaign hub or
`game/snake/play.html?mode=solo` for the classic page. The page also accepts
`mode=versus` and `mode=team`.

The existing `journey=snake-hunt-v1` entry now opens Classic from Solo, couch
Versus and Team. The same URL with `snake-style=capture` keeps the original
territory edition. For example:

- Classic Solo: `game/?journey=snake-hunt-v1`
- Capture Solo: `game/?journey=snake-hunt-v1&snake-style=capture`
- Classic Versus: `game/couch/?journey=snake-hunt-v1`
- Capture Versus: `game/couch/?journey=snake-hunt-v1&snake-style=capture`
- Classic Team: `game/couch/relay-rescue.html?journey=snake-hunt-v1`
- Capture Team: `game/couch/relay-rescue.html?journey=snake-hunt-v1&snake-style=capture`

The classic page links back to the Capture remix. Classic uses its own
`classic-snake-level.v1`, `classic-snake-core.v1` and `classic-snake-replay.v1`
contracts. Existing capture cores, levels, Journey progress, Studio authoring
sources and saves are not reinterpreted as classic games.

## Verification and remaining qualification

Scoped syntax, ESLint and formatting checks passed. Production structural calls
admitted all 48 recipes and initialized 192 cores: Solo, paired Solo instances
for Versus and Team for each layout. All starting bodies had four cells; paired
Versus recipes and initial targets matched. This establishes initial admission,
not that every body route is solvable after arbitrary player turns.

A disclosed model-driven playthrough of the actual first classic mission caught
eight targets, grew from four to twelve cells and won in 93 steps / 18,600 ms.
Its complete replay restored the identical canonical state. Focused observations
also cover pending-turn restoration, legal tail vacancy, once-only Team head
swap failures, authoritative speed timing and replayable resource-limit endings.
Evidence is retained in [the core observation record](verification/classic-snake/core-observations.md)
and [the catalogue receipt](evidence/classic-snake-catalogue-observation.json).

**Automated suites remain WAIVED_SKIPPED_NOT_PASSED** under
`publishing/test-policy.json`; the new regression sources are unrun.
Repository-wide lint/validation, changed-file formatting and committed-source
default-build inspection passed. Exact identities and bounded browser
observations are retained in the
[integration receipt](verification/classic-snake/integration.md). Human play
qualification remains deferred: all-mission balance, physical keyboard/touch
devices, slower devices, small-screen two-player readability and full Team
campaign completion are not declared passed by the model observations. Classic
does not implement gamepad input or a Studio GUI; those claims are not implied
by retaining the earlier Capture-remix Studio tools.
