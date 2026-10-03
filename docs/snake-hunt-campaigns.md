# Snake Hunt campaigns

Implemented candidate feature, 3 October 2026. Entry: `game/snake/index.html`.
This is reviewable source on `codex/snake-hunt-campaigns`, stacked on the global
Running enemies feature; it is not a declaration that the public GitHub Pages
release includes it. No release promotion or version bump is part of this change.

## What players get

- **48 distinct 2D layouts in eight chapters**, playable in Solo, paired-board
  Versus and shared-board Team. The modes reuse those 48 layouts, rather than
  counting each mode or difficulty copy as another new level.
- **24 additional simulator courses in four six-course playlists**, available in
  both Self-level and Acro. These adapt collection and tail avoidance to the
  existing 3D flight model; they do not import 2D territory capture into Sim.
- Native English and Ukrainian names, descriptions, rules, objectives and HUD.
- Existing recognizable humanoid runners and guards as catch targets. Clean
  feedback is the default; Brutal destruction and blood remain player choices.
- Studio source entries for the two 2D source editions, canonical scenario/pack
  import and export, replay identities and resume support. Sim courses and
  playlists retain the existing Workshop/export/proof flows.

The hub lists every mission. Enter Solo, Versus or Team, then use Select Mission
and the chapter filters. The explicit route is `journey=snake-hunt-v1`; old
Journeys and their progress remain separate. Simulator playlist links prepare the
chosen collection, and the player arms the selected course when ready. Settings
for Running enemies and encounter variants link to the hub.

## Mechanics and deliberate differences

2D Snake has a persistent following body, **separate from the unfinished capture
line**. Moving fills its initial capacity; every accepted humanoid contact or
enclosure increases capacity. The body survives completed cuts and can harm the
player even on safe ground. Crossing it costs a life/downing under the existing
mode's recovery rules. Recovery clears the body path but retains catches and
earned capacity. Selected later missions shed capacity on completed cuts, bounded
by their initial length.

All 2D Snake missions require every authored target. Capture is a tactical way to
remove enemies and create safe routes, without a mandatory coverage percentage.
Existing keepers remain dangerous and retain uncaptured territory. Optional catch
chains and numbered-order bonuses never block the clear; out-of-order removals
still count. Hunt score and Snake bonus are displayed separately. Existing Hunt
records persist; a separate lifetime Snake-bonus leaderboard is not introduced.

Snake editions use turns at cell centres to make body geometry exact and bounded.
The ready briefing explains this even when the general control preference is
Immediate. Paths have at most 132 points per body and 64 cells of capacity. The
renderer consumes the collision geometry. Blood, effects and remains cannot
change movement, catches, scoring or simulation randomness.

Versus prepares matched accepted boards/populations/seeds; its hunt-only objective
selects completion under existing race rules. Team uses one finite target count,
with each catch credited once. Each player has their own body; Shared Circuits
and selected finales require avoiding both players' bodies. Existing rescue and
Support controls stay available.

Simulator catches require actual swept drone contact, with no pulse shortcut.
Ordered simulator courses leave wrong-order targets alive. Its echo body is a
bounded chain of physical world-space spheres behind a safe neck gap. Vertical
routes, raised platforms, moving quarry and architectural obstacles use the
existing flight controls and collision engine. The introductory course omits the
echo body; later catches grow it. A tail collision fails the flight. Sim has
separate course proof/record identities and does not award 2D Journey progress.

## Content progression

| 2D chapter           | Main challenge                                        | Missions |
| -------------------- | ----------------------------------------------------- | -------: |
| First Coils          | Grow, loop and leave an exit                          |        6 |
| Wide Turns           | Elbows, pockets, U-turns and switchbacks              |        6 |
| Long Way Round       | Longer tails, islands and detours                     |        6 |
| Interception Grounds | Forks, parallel paths and optional catch chains       |        6 |
| Safe Returns         | Persistent length versus shedding at returns          |        6 |
| Crossfire Gardens    | Guard warnings, cover and wide escape routes          |        6 |
| Shared Circuits      | Crossings, paired routes and Team body hazards        |        6 |
| Final Weave          | Combined routes, guards and optional numbered catches |        6 |

| Simulator playlist | Main challenge                                   | Courses |
| ------------------ | ------------------------------------------------ | ------: |
| Open loops         | Physical contact and growing echo introduction   |       6 |
| Weave and return   | Slalom and ordered circuits                      |       6 |
| Height changes     | Raised catches, platforms and vertical clearance |       6 |
| Moving quarry      | Interception against moving humanoids            |       6 |

The maps use original authored geometry and existing licensed/pinned RevealLine
pictures, actors and themes. This change adds no third-party game artwork,
characters, music or code. It does not claim 48 new pictures or characters.

## Research and design choices

These are design inferences from primary developer references, not copied levels.

- [Snakebird](https://store.steampowered.com/app/357300/Snakebird/) demonstrates how
  growth changes the shape-space problem; [Snakebird Primer](https://store.steampowered.com/app/1014140/Snakebird_Primer/)
  motivates an accessible introduction before more demanding combinations. Here,
  broad turn pockets precede long bodies and combined hazards.
- [Snake Pass](https://store.steampowered.com/app/544330/Snake_Pass/) combines
  collection with distinctive movement and separate time-trial challenges. Our
  2D main clears are untimed, with optional performance goals; Sim keeps its flight
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

New identities: Solo level11/core12/replay13, Team level10/core12, Snake rules1,
scenario11/pack11. Historical authored levels do not acquire a body. Other
encounter variants cannot remove a Snake mission's required population or rewrite
its ordered bonus; ordinary missions in a mixed creator project retain their
usual encounter options.

Evidence is kept in `docs/evidence/snake-hunt-content-coverage.json`,
`docs/evidence/sim-snake-hunt-runtime-observation.json` and its recorded-input
proofs. The content receipt establishes 432 structural mission/mode/difficulty
admissions and initializations, plus 48 different geometries. This is not proof
that all missions are balanced or human-play-qualified.

Automated suites remain **WAIVED_SKIPPED_NOT_PASSED** under
`publishing/test-policy.json`. Focused regressions are authored for later execution.
Direct bounded production observations and browser checks are reported separately.
Before release, human review should cover every route/class/input combination,
late-chapter catchability, two-player body readability, low-end rendering and
small-screen controls. Remaining qualification must not be represented as passed.
