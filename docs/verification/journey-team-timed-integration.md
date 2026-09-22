# Team timed bonuses: authoring and host integration

2026-09-21. Successor to engine commit `e14080cd`. Local candidate qualification,
not publication, whole-campaign balance, physical-device or two-human acceptance.

## Implemented

The common compiler, Studio editor and Team pack reader now agree on the explicit
`TeamMissionV4` / level v5 / ruleset v7 / pack v5 edition. Applying a timed schedule
creates a new revision of the selected mission only. Other missions, historical
editions, maps and published data remain unchanged; undo restores the prior draft.
Removing the last schedule retains the explicit edition. Mixed-edition campaign
exports still refuse instead of silently migrating their missions.

Only trail-aware `timed-bonuses.v2` is accepted. Foundations, terrain, keepers and
reclaimed roamers are qualified; unsupported actors, objectives, relay gates,
directional fields and encounters remain closed. Import retains the compiled
difficulty and exact schedule. No automatic enrollment of the twelve Team missions.

Studio numbers all potential anchors using the resolved Team map. The actual Team
painter reuses Solo pickup silhouettes, hollow announcements and shrinking rings.
The HUD identifies available pickups and per-pilot/shared effect expiry. Existing
pause flow contains field details explaining contact-only collection, relocation,
shared reserves, collector speed and freeze exceptions. There is no new compulsory
screen. Captions work with muted audio; no new music or discrete audio assets.

The rendering projection is owned, bounded and immutable. Unknown editions,
accessors, mismatched schedule/items and invalid clocks fail closed. Terminal
boards retire live windows/effects. Rendering never advances simulation time.

## Automated evidence

Eight integration tests cover exact three-preset compiler/export/import results,
historical refusal, undo/redo, unchanged neighboring missions, mixed-edition
campaign rejection, Studio anchor overlay, pause-stable shared drawing, malformed
projection refusal, actual host import/retry, and real keyboard collection with
per-pilot effect text. The actual-host tests use the production HTML and modules
with controlled frames and a minimal DOM, not a physical-device simulation.

Independent review reproduced a mid-pickup drawing failure that left nested
canvas saves unbalanced. Shared pickup and erosion scopes now restore in `finally`.
A regression injects a countdown-ring fault into the actual Team painter and
checks zero leaked frames, restored scale, unchanged runtime, and normal next paint.

The combined engine, historical Team pressure, Solo timed-taking/replay/race,
compiler/export, painter and actual-host cohort is rerun on Node20.19.5 and22.22.2.
All **761/761 tests pass on each runtime**, with no skips; independent review
passes, including additional announcement/available/erosion drawing-fault probes.
Sparse test
fixtures use `.cache/read-source-git.mjs`: existing files win; only missing tracked
content JSON and compiled presentation media are read from exact commit `daaef1fa`.
No fixture is fabricated and no source file is substituted. Two stale host test
strings were corrected to the pre-existing “On reclaimed ground” vocabulary.

## Native browser observations

Working-source localhost8844, separate Studio/Team tabs, not the user's8778 tab:

1. Inspected and applied the bundled twelve-mission Team draft.
2. Added `native-team-window` to Twin landings through the timed editor: speed,
   anchors(20.5,8.5)/(51.5,8.5), delay0s, announcement1s, availability10s,
   cooldown12s, three appearances, one collection. Apply succeeded with undo.
3. Exported the selected mission. The browser download-event waiter timed out,
   but the completed file existed and its bytes showed the exact v5/v7 edition
   and authored schedule; this was not treated as a failed compiler export.
4. Imported that file into the actual Team player. Standard was pinned and help
   explained ownership/contact. Test scenery was correctly labelled, not claimed
   as the mission's original artwork.
5. Started and paused: “Pilot speed arrives in1.0s” remained unchanged while
   paused. The pause panel and Resume action were visually readable at the tested
   desktop viewport. Resuming and missing the first window produced an expiry
   caption and “No pickup or effect window active” during cooldown.

Keyboard collection is automated-host evidence here, not a claimed native taking
route. Small-screen/controller readability and two-human cooperation remain open.

## Remaining

- Three purpose-built Team optional-route studies: useful complementary jobs,
  pickup-free and taking clears, presets, seat permutations and delayed seeds.
- Physical touch/gamepad, reduced-effects and muted-audio native matrix; genuine
  two-player understanding, temptation, timing and retry assessment.
- New content artwork/qualification, coordinated release-owner integration,
  reviewed phase PR, immutable version and verified Pages deployment.

This completes the scoped authoring/transport/host implementation slice, not P02,
P14, Team suspension/replay support or the whole Journey redesign.
