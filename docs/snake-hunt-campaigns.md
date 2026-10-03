# Snake Hunt campaigns

**Classic Snake is now the default 2D edition:** an automatically moving,
four-cell snake catches one humanoid at a time and grows on a discrete grid.
The earlier territory game remains available as the **Capture remix**. Sim is a
separate 3D flight interpretation. The hub is `game/snake/index.html`; the classic
play page is `game/snake/play.html`.

Implemented candidate source, 3 October 2026, on `codex/snake-hunt-campaigns`.
This document does not declare that the public GitHub Pages release includes the
change. Final integration/build verification and publication require their own
receipts. See [the classic improvements and research](classic-snake-improvements.md).

## What players get

- **48 distinct classic layouts in eight chapters**, playable in Solo,
  paired-board Versus and shared-board Team. Each uses a 24 × 18 grid and a finite
  goal of 8–20 catches. Eight missions wrap at the edges; nine explicitly use a
  fleeing target. The other targets stay still until caught.
- The **48 existing Capture-remix missions** remain available. Classic adapts
  their authored layout ideas into grid obstacles. These are two editions of the
  content, not 96 independently invented layouts, and the three play modes do
  not multiply the level count.
- **24 additional simulator courses in four six-course playlists**, available in
  both Self-level and Acro. These adapt collection and tail avoidance to the
  existing 3D flight model; they do not import 2D territory capture into Sim.
- Native English and Ukrainian names, descriptions, rules, objectives and HUD.
- Recognizable humanoid catch targets. Classic uses one collectible at a time;
  shooting guards and field keepers belong to the Capture remix. Clean feedback
  is the default; Brutal destruction, blood and remains remain player choices.
- Classic has its own saved rounds, replay import/export and local records.
  Capture-remix authoring retains its Solo/Team Studio sources, scenario/pack
  formats and resume support. Sim retains its Workshop/export/proof flows.

The hub lists every classic mission. Choose Solo, Versus or Team, then select a
campaign and level and press Start. Existing Snake Journey URLs now open the
classic page; append `snake-style=capture` to retain the territory edition:

| Entry  | Default                                              | Capture remix                                                            |
| ------ | ---------------------------------------------------- | ------------------------------------------------------------------------ |
| Solo   | `game/?journey=snake-hunt-v1`                        | `game/?journey=snake-hunt-v1&snake-style=capture`                        |
| Versus | `game/couch/?journey=snake-hunt-v1`                  | `game/couch/?journey=snake-hunt-v1&snake-style=capture`                  |
| Team   | `game/couch/relay-rescue.html?journey=snake-hunt-v1` | `game/couch/relay-rescue.html?journey=snake-hunt-v1&snake-style=capture` |

The classic play page also links directly to its Capture remix. Other Journeys
and their progress remain separate. Simulator playlist links prepare the chosen
collection, and the player arms the selected course when ready.

## Classic mechanics

The entire four-cell body is visible before the first move. After Start, the
snake advances automatically one cell per step; arrow keys, WASD, swipe or the
direction pads queue turns. Immediate reversals are ignored, and at most two
turns wait in the buffer. Pause or losing focus stops advancement.

A successful head contact adds one cell and 100 points, then introduces the next
target. Reaching the finite catch goal wins. Walls and snake bodies end the
round; there is no territory percentage, safe border, capture enclosure or
extra-life recovery. A tail cell is legal to enter only when it vacates during
that same non-growing move. Edge wrapping and slower-moving quarry are explicit
mission variants. Slow, Normal and Fast prepare distinct accepted pace recipes.

Solo controls one snake. Versus uses matched recipes and seeds on independent
boards, each with its own earned step clock; a goal completion or opponent crash
decides the race, with simultaneous due events resolved together. Team has two
snakes on one board, a shared target and one catch goal. A fatal collision by
either snake ends the shared round; head-on contacts and head swaps are fatal,
and a fatal transaction awards no catch.

The classic catalogue and chapter descriptions are documented in
[Classic Snake catalogue](classic-snake-catalogue.md). Gore, blood, remains and
reduced-effects choices affect presentation only; they cannot change body
collision, target spawning, score or replay identity.

## Capture remix mechanics retained

The Capture remix has a persistent following body, **separate from the unfinished capture
line**. Moving fills its initial capacity; every accepted humanoid contact or
enclosure increases capacity. The body survives completed cuts and can harm the
player even on safe ground. Crossing it costs a life/downing under the existing
mode's recovery rules. Recovery clears the body path but retains catches and
earned capacity. Selected later missions shed capacity on completed cuts, bounded
by their initial length.

All Capture-remix Snake missions require every authored target. Capture is a tactical way to
remove enemies and create safe routes, without a mandatory coverage percentage.
Existing keepers remain dangerous and retain uncaptured territory. Optional catch
chains and numbered-order bonuses never block the clear; out-of-order removals
still count. Hunt score and Snake bonus are displayed separately. Existing Hunt
records persist; a separate lifetime Snake-bonus leaderboard is not introduced.

Capture-remix editions use turns at cell centres to make body geometry exact and bounded.
The ready briefing explains this even when the general control preference is
Immediate. Paths have at most 132 points per body and 64 cells of capacity. The
renderer consumes the collision geometry. Blood, effects and remains cannot
change movement, catches, scoring or simulation randomness.

Capture-remix Versus prepares matched accepted boards/populations/seeds; its hunt-only objective
selects completion under existing race rules. Team uses one finite target count,
with each catch credited once. Each player has their own body; Shared Circuits
and selected finales require avoiding both players' bodies. Existing rescue and
Support controls stay available.

## Separate simulator interpretation

Simulator catches require actual swept drone contact, with no pulse shortcut.
Ordered simulator courses leave wrong-order targets alive. Its echo body is a
bounded chain of physical world-space spheres behind a safe neck gap. Vertical
routes, raised platforms, moving quarry and architectural obstacles use the
existing flight controls and collision engine. The introductory course omits the
echo body; later catches grow it. A tail collision fails the flight. Sim has
separate course proof/record identities and does not award 2D Journey progress.

## Retained Capture-remix and simulator progression

| Capture-remix chapter | Main challenge                                        | Missions |
| --------------------- | ----------------------------------------------------- | -------: |
| First Coils           | Grow, loop and leave an exit                          |        6 |
| Wide Turns            | Elbows, pockets, U-turns and switchbacks              |        6 |
| Long Way Round        | Longer tails, islands and detours                     |        6 |
| Interception Grounds  | Forks, parallel paths and optional catch chains       |        6 |
| Safe Returns          | Persistent length versus shedding at returns          |        6 |
| Crossfire Gardens     | Guard warnings, cover and wide escape routes          |        6 |
| Shared Circuits       | Crossings, paired routes and Team body hazards        |        6 |
| Final Weave           | Combined routes, guards and optional numbered catches |        6 |

| Simulator playlist | Main challenge                                   | Courses |
| ------------------ | ------------------------------------------------ | ------: |
| Open loops         | Physical contact and growing echo introduction   |       6 |
| Weave and return   | Slalom and ordered circuits                      |       6 |
| Height changes     | Raised catches, platforms and vertical clearance |       6 |
| Moving quarry      | Interception against moving humanoids            |       6 |

The maps use original authored geometry and existing licensed/pinned RevealLine
pictures, actors and themes. This change adds no third-party game artwork,
characters, music or code. It does not claim 48 new pictures or characters.

## Capture-remix research and design choices

These earlier remix choices remain relevant to that edition. The new classic
research, including Google Maps Snake, Nokia and Battlesnake, is documented in
[Classic Snake improvements](classic-snake-improvements.md). These are design
inferences from developer references, not copied levels.

- [Snakebird](https://store.steampowered.com/app/357300/Snakebird/) demonstrates how
  growth changes the shape-space problem; [Snakebird Primer](https://store.steampowered.com/app/1014140/Snakebird_Primer/)
  motivates an accessible introduction before more demanding combinations. Here,
  broad turn pockets precede long bodies and combined hazards.
- [Snake Pass](https://store.steampowered.com/app/544330/Snake_Pass/) combines
  collection with distinctive movement and separate time-trial challenges. Our
  Capture-remix clears are untimed, with optional performance goals; Sim keeps its flight
  model and course limits rather than pretending to be a 2D grid game.
- [PAC-MAN's official character guide](https://pacman.com/en/character/) and
  [Championship Edition 2](https://pacman.com/en/games/pce2.php) inform pursuit
  reversal and readable trains of hazards. Our existing runners, guard warnings
  and separate keeper silhouettes keep their distinct meanings.
- [Snake Rivals, by Supersolid](https://apps.apple.com/us/app/snake-rivals-io-snakes-games/id1440185894)
  illustrates growth in shared multiplayer space. Team uses visible independent
  bodies, a shared quota and once-only credit; Versus retains paired fairness.
- Xbox accessibility guidance on [objectives](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/109),
  [difficulty](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/108)
  and [motion](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/117)
  supports reviewable counts/briefings, existing difficulty presets and
  presentation settings independent of the rules.

## Compatibility and verification

Classic uses separate `classic-snake-level.v1`, `classic-snake-core.v1` and
`classic-snake-replay.v1` identities and its own UI saved-round wrapper. It does
not reinterpret historical capture saves or overwrite Journey records.

Retained Capture-remix identities: Solo level11/core12/replay13, Team level10/core12, Snake rules1,
scenario11/pack11. Historical authored levels do not acquire a body. Other
encounter variants cannot remove a Snake mission's required population or rewrite
its ordered bonus; ordinary missions in a mixed creator project retain their
usual encounter options.

Classic structural evidence is in
`docs/evidence/classic-snake-catalogue-observation.json`: 48 admitted recipes,
192 initial core instances and 48 distinct geometries. A directed authored
Open Loop playthrough caught all eight targets in 93 steps / 18,600 ms, grew from
four to twelve cells and replayed exactly. Source-bound core observations are in
`docs/verification/classic-snake/`. Scoped syntax, lint and formatting checks
passed; final repository-wide integration/build verification is pending the
integration owner's final receipt.

Capture-remix and Sim evidence remains in `docs/evidence/snake-hunt-content-coverage.json`,
`docs/evidence/sim-snake-hunt-runtime-observation.json` and its recorded-input
proofs. The content receipt establishes 432 structural mission/mode/difficulty
admissions and initializations, plus 48 different geometries. This is not proof
that all missions are balanced or human-play-qualified.

Automated suites remain **WAIVED_SKIPPED_NOT_PASSED** under
`publishing/test-policy.json`. Focused regressions are authored for later execution.
Direct bounded production observations and browser checks are reported separately.
Human play qualification remains deferred. It should cover every classic route,
physical input and pace choice, plus the remix's route/class/input combinations,
late-chapter catchability, two-player body readability, low-end rendering and
small-screen controls. Remaining qualification must not be represented as passed.
