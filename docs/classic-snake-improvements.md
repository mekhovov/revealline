# Classic FPV Snake improvements

This document describes the candidate source implementation, not a production
publication receipt. The Classic catalogue now has **84 distinct 24 × 18 layouts
in fourteen chapters**: the original 48 recipes and 36 new pursuit recipes. The
Sim catalogue contains **36 flight courses**, including twelve new patrol courses.
Mode copies and different visual styles are not counted as additional maps.

## Recognizable rules and presentation

Classic retains automatic cell movement, a complete four-cell starting body,
contact growth, and wall/body collision. Cable and Signal are presentation styles
for the same occupied-cell body; choosing a style must not change physics,
randomness, completion or record identity. The FPV head and humanoid targets use
the main game's presentation language. Body occupancy, target warnings and closed
routes remain readable regardless of optional destruction, blood, remains or
reduced-effects preferences.

The original eight chapters remain `classic-snake-level.v1`; their recipes and
accepted identities are unchanged. The new content explicitly uses
`classic-snake-level.v2`, `classic-snake-core.v2` and
`classic-snake-replay.v2`. Older territory-based Snake is still the Capture remix.
Flight courses keep their separate physical flight model and controls.

## Four campaigns

| Campaign        | Chapters                         | Missions | Teaching sequence                                                               |
| --------------- | -------------------------------- | -------: | ------------------------------------------------------------------------------- |
| Classic         | Original eight chapters          |       48 | Turns, islands, moving quarry, wrapping edges, chicanes and shared circuits.    |
| Pure Pursuit    | Patrol Routes; Escape Lines      |       12 | Read a patrol route, then intercept a reactive runner.                          |
| Tactical Routes | Burst Timing; Route Windows      |       12 | Read a sprint warning, then choose timed shortcuts with permanent bypasses.     |
| Arcade Sorties  | Field Supplies; Combined Pursuit |       12 | Use contact pickups, optionally chase couriers, then combine established rules. |

Every chapter has six maps and native English/Ukrainian titles and instructions.
All 36 new boards are individually authored directly in grid coordinates. Unlike
the original projected layouts, selected new walls reach the boundary and break
the universal outer circuit. The new campaign uses a fixed 200 ms base step;
mission goals are 10/12/14/14/16/18 by chapter, with eight catches in the first two
lessons. Host pace choices remain separate accepted recipes.

Fourteen featured sorties select each chapter's sixth mission with fixed seeds
4201–4214. They reuse those exact layouts; they do not inflate the map count.
See [the catalogue](classic-snake-catalogue.md) for every new mission name.

## Bounded pursuit mechanics

- Patrollers follow explicit adjacent-cell closed walks, waiting if blocked.
  Runners respond to nearby current head positions using traversable distance.
  Sprinters warn for four steps, burst for two, then rest for eight. They never
  move multiple cells in a single core step.
- New levels admit at most two active humanoids. The first lessons use one.
  Ordinary catches contribute to the finite quota and grow the catching body.
- Optional couriers offer 250 points and one body cell without quota credit.
  Offers follow required catches four and eight, at most twice; an active first
  courier defers the second. They persist until caught or the round ends, with no
  expiry race or repeated farming. Three authored maps include them.
- Stop Pulse activates on contact and pauses target movement/phases for eight
  steps. Cable Reel removes four tail cells from the collector, with a four-cell
  minimum. The same rule applies in Cable and Signal. Neither pickup adds a button.
  Nine authored maps contain supplies, on permanently walkable pads.
- Nine maps contain one or two yielding shutters. A group occupies 1–8 cells,
  stays open for 32 steps with an eight-step closing warning, then closes for 16.
  Occupancy defers closure; all closed groups still leave a connected permanent
  bypass. A pickup cannot retroactively save an already fatal collision.

## Modes, replayability and records

Solo and Team use the same accepted map recipes. Team shares quota, targets and
route state, records contributors once, and preserves simultaneous fatal-contact
priority. A contribution medal may reward cooperation without making a particular
player's catches mandatory for campaign completion.

The new host work adds three-minute Versus score duels, mission mastery, featured
sorties and bounded Endless presets alongside finite campaign play. Their evidence
belongs to the core/match/host integration observations, not to the content
admission receipt. Comparisons must bind the accepted recipe, pace, seed and mode;
cosmetic style must not split gameplay records. Historical finite race recipes
and saved rounds retain their versioned interpretation.

Local progress now keeps exact match witnesses for scores, clears and mastery. Record keys distinguish mission, Endless, score-duel and survival-duel policies as well as mode, recipe and seed. A same-ID altered recipe cannot grant a catalogue clear. Reads verify witnesses and keep unknown or corrupt stored data untouched; failed writes remain visible in this session and retry on later reads. The HUD reads compact summaries rather than copying replay journals each frame. This proof-based path does not turn historical best-score numbers into verified clears.

The content exports four campaign cards and fourteen featured recipes. Endless
presets reuse admitted pursuit, route and supply rules rather than declaring
hundreds of procedurally renamed missions. Bounded replay resource limits remain
part of the runtime contract. Cosmetic mastery rewards do not grant new physics
or require multiplayer to access the content.

## Separate Sim adaptation

The two new six-course playlists are Patrol Interception and Flight Route Choices.
They use actual ground patrol paths, static physical obstacles, ordinary manual
flight, contact catches and the existing solid world-space echo trail. All twelve
support Self-level and Acro. The new courses do not claim grid shutters, runner AI,
sprint phases, pickups or Classic Versus/Team rules.

The original 24 course objects, catalogue entries, pack identities and playlist
references remain exact. The twelve new courses have a separate
`fpv-snake-pursuit:` pack identity, so adding them does not silently move earlier
flight progress into a newly hashed collection.

## Research basis

These are design inferences from primary examples, not copied game rules or assets.

- [Google Maps Snake](https://blog.google/products-and-platforms/products/maps/sssnakes-map/)
  keeps the growth/self-avoidance loop while changing the visual subject. That
  supports an FPV presentation with stable grid physics.
- [PAC-MAN Championship Edition 2](https://pacman.com/en/games/pce2.php) combines
  maze pursuit, Time Attack and remixed challenges. That supports finite lessons
  plus score challenges built from a small, readable set of mechanics.
- [Snakebird Primer](https://store.steampowered.com/app/1014140/Snakebird_Primer/)
  explicitly introduces easier puzzles before harder challenges. This catalogue
  introduces behaviors separately before combining them.
- [Vampire Survivors Adventures](https://poncle.zendesk.com/hc/en-gb/articles/20118186268177-What-are-Adventures)
  separates a remixed progression path while preserving main unlocks. Its
  [co-op design FAQ](https://poncle.games/coop-faq) also explains optional co-op
  progression and persistent player highlighting. These inform independent
  challenge records and readable, optional cooperative mastery.
- Xbox guidance on [input](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/107),
  [difficulty](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/108)
  and [motion](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/117)
  supports visible controls, pace choice, pausing and reduced distractions. This
  source implementation alone is not an accessibility-compliance assessment.

## Evidence and remaining qualification

Direct production validation admits all 84 grid recipes and initializes 336 cores:
Solo, two independent equal-seed Solo boards for Versus, and Team for each layout.
All 84 wall arrangements differ. Separate geometry inspection checks each possible
closed-shutter combination. This establishes recipe/start-state admission, not
catchability after arbitrary player-created coils or complete mission solutions.

Production flight validation admits all 36 courses. A bounded five-second neutral
startup observation of each new course moves all fifty new patrol actors without
blocked-actor ticks. This is not a complete flight or contact-win observation.

The new receipt is
[`evidence/classic-snake-pursuit-content-observation.json`](evidence/classic-snake-pursuit-content-observation.json).
The [v2 route journals](verification/classic-snake/pursuit-v2/README.md) retain a
verified Solo clear for every new mission, including disclosed failed attempts.
The [v2 integration report](verification/classic-snake/pursuit-v2/integration.md)
records browser observations, variant preparation, static checks and build evidence.
The earlier
[catalogue receipt](evidence/classic-snake-catalogue-observation.json),
[core observations](verification/classic-snake/core-observations.md) and
[integration receipt](verification/classic-snake/integration.md) describe their
historical source revisions and must not be presented as new-feature qualification.

Automated suites remain **WAIVED_SKIPPED_NOT_PASSED** under
`publishing/test-policy.json`. Syntax, scoped lint and formatting are checked;
root integration owns repository validation, build, browser and publication
receipts. Human qualification remains necessary for all-mission balance,
keyboard/touch devices, slow devices, small-screen Versus/Team readability and
complete cooperative campaigns. The catalogue does not by itself establish a
Classic Studio editor, gamepad support, multiplayer flight or completion of those
human checks.
