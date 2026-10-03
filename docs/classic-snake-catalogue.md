# Classic Snake catalogue

The classic catalogue contains eight chapters and 48 missions on a 24 × 18 grid. Each snake starts with four visible occupied cells, advances one cell per step, and grows by catching the single humanoid target. Goals range from eight to twenty catches. Solo uses one snake, Versus uses two independent equal-seed boards, and Team uses two snakes sharing a board and a catch goal.

This is a separate recipe family, `classic-snake-level.v1`. Existing territory-capture Snake recipes and their saved identities remain unchanged. The Sim remains a flight interpretation. Classic missions have no capture trail, territory percentage, keepers, shooting guards, return shedding, or safe-cell immunity.

## Content and progression

| Chapter           | Ukrainian title       | Six-mission focus                                                                              |
| ----------------- | --------------------- | ---------------------------------------------------------------------------------------------- |
| First Coils       | Перші витки           | Empty-grid introduction, then small islands and a first circuit.                               |
| Wide Turns        | Широкі повороти       | Elbows, U-shaped pockets, alternating corners and S-bends.                                     |
| Island Circuits   | Кола навколо островів | Larger islands, detours and inner-versus-outer route choices.                                  |
| Moving Quarry     | Рухлива здобич        | A lone target takes one fleeing step every four or five snake steps.                           |
| Borderless Routes | Маршрути без меж      | All four edges wrap; obstacles and bodies still collide.                                       |
| Chicanes          | Шикани                | Solid edges return, with staggered passages and modest speed increases.                        |
| Shared Circuits   | Спільні кола          | Crossing schedules and opposite approaches; Team shares the target and must avoid both bodies. |
| Final Weave       | Останнє плетіння      | Mixed islands, moving targets and two explicitly wrapping missions.                            |

Every mission has a native English and Ukrainian title and geometry-specific brief. The catalogue exports `CLASSIC_SNAKE_CHAPTERS` and `CLASSIC_SNAKE_LEVELS`; each level entry carries `id`, `chapterId`, bilingual `title` and `description`, and its exact core `level` recipe. The supplementary lookup `classicSnakeLevel(id)` returns a recipe or `null`.

## Geometry conversion

The 48 authored Snake Hunt layouts supplied the wall and island arrangements. Their rectangle coordinates are copied literally into the classic catalogue, so future changes to the capture authoring source cannot silently alter a saved classic recipe. The source factory itself is unchanged and is not imported by the classic runtime.

The original 72 × 36 rectangles project onto 24 × 18 cells. Former foundation islands become ordinary solid obstacles. The first mission deliberately discards its small island to teach movement on a completely empty board. Every later map retains a distinct obstacle arrangement. A three-cell-wide band around the board stays open for circulation; it is ordinary floor and provides no immunity. The two starts occupy separate straight four-cell corridors, with clear first moves.

The production validator checks unique in-bounds wall cells, both full starting bodies, clear first moves, capacity for the finite catch goal, and one connected region of walkable cells. All 48 projected layouts pass without deleting obstacles or filling disconnected pockets. This rules out targets appearing inside a permanently sealed wall region. Routing around a growing body remains the player's challenge; static connectivity does not guarantee that every player-created coil is escapable.

## Pacing

Starting step duration is 175–200 ms. The first five chapters use a fixed speed. The final three reduce step duration by 10 ms after every four catches, with a 135 ms minimum. Eight missions wrap; nine have fleeing targets. These variations are explicit recipe fields and visible in the mission description rather than hidden difficulty changes.

The finite goals, initial four-cell body, 24-column grid and exact timing values are implementation choices for this game. They are not claims about a historical Snake specification or a completed balance study. Human phone/keyboard/controller play remains necessary to qualify readability and campaign pacing.

## Research basis

- Google's original [Maps Snake announcement](https://blog.google/products-and-platforms/products/maps/sssnakes-map/) describes picking up passengers while avoiding the map boundary and the growing vehicle itself. That supports keeping pickup, visible growth, and self/wall collision as the recognizable central loop; the classic implementation uses humanoid targets on a discrete grid.
- The developer's [Snakebird Primer page](https://store.steampowered.com/app/1014140/Snakebird_Primer/) describes a more approachable introduction to its harder puzzle game. That supports introducing one spatial idea at a time. This catalogue borrows the teaching principle, not Snakebird's physics or puzzle solutions.
- Microsoft's [Xbox Accessibility Guideline 108](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/108) recommends configurable challenge components, pausable local play and understandable descriptions. The authored timing and target movement fields separate those components. Host-level slower play, pause and input usability must be reviewed independently; the catalogue alone does not establish accessibility compliance.

## Bounded evidence

[`evidence/classic-snake-catalogue-observation.json`](evidence/classic-snake-catalogue-observation.json) binds the observed source hashes and lists every admitted recipe. Direct production calls admitted 48 levels and initialized 192 cores: Solo, two independent equal-seed Solo cores representing Versus, and Team for each recipe. All initial bodies contain four cells, all paired Versus recipe/target identities match, all 48 obstacle layouts differ, and all titles and briefs contain English and Ukrainian copy.

Scoped syntax, ESLint and formatting checks passed for the catalogue. No automated test suite was run, in accordance with the repository's current test waiver. This observation does not claim complete playthroughs, runtime persistence coverage, browser usability, or balance across every mission.
