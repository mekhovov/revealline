# RevealLine: what is next

Updated 16 September 2026. This is the readable view of the [active execution plan](cross-mode-execution.md), with [delivery evidence and retained requirements](delivery-priorities.md). P01 v0.57.4 is published and awaiting public acceptance. Shared master sound is being prepared on that exact source as the [P02 candidate](p02-p01-v0574-composition.md); its final qualification and delivery remain pending. A source feature, generated picture or passing test is not by itself an accepted phase.

## Current work

The v0.56 candidate combines guided saves/backups, clearer contextual couch controls, a browsable library of forty reserve illustrations and the existing Field Kit game presentation. Native keyboard checks found and then verified the correction of a first-open music-library focus issue; its regression and browser evidence are recorded in the [focus review](verification/studio-first-open-focus.md). Each release must also pass the complete source/build checks, frozen-package checks and public play verification.

Capture-stop, continuous steering during a cut, travelling line damage, differentiated enemy roles and several native menu/feedback paths already exist. They still need consistent acceptance across every advertised mode, theme, difficulty and supported device. The current game is not yet the complete production target.

## First priority: make every session feel like one finished game

| Phase | Player-visible result                           | Done when                                                                                                                                                                                                              |
| ----- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P00   | A reliable integrated baseline                  | Existing art, progress and releases are preserved; the exact release passes source, package and public checks.                                                                                                         |
| P01   | Immediate feedback while anything loads         | Loading, cancellation, failures and retries are clear; stale operations cannot change the current screen or flight.                                                                                                    |
| P02   | One dependable audio experience                 | Music and mute work throughout the session; actual MP3 imports and built-in/custom playlists pass playback, persistence, transfer and offline checks. Finished tracks are also auditioned for their campaign releases. |
| P03   | Clear Solo, Versus and Team entry               | Start, Continue, lobbies, Back and Resume work through keyboard, controller and touch without a mouse-only step.                                                                                                       |
| P04   | Flexible editions and creation tools            | Pictures, actors, sounds, maps and registered rules can be edited, validated and moved through existing versioned pack formats without losing original bytes.                                                          |
| P05   | Consistent readable pixel-inspired presentation | Typography, palettes, menus, focus, ornaments and Team presentation remain readable in normal, Large/Plain and reduced-motion settings.                                                                                |

Touch controls appear when useful, respect safe areas and avoid hiding the arena. Arcade bonuses activate through play; it does not gain a permanent row of Scan, Supply and Boost buttons. Tactical actions appear only when the authored class and map support them.

## Second priority: make the challenge and rewards consistent

| Phase | Player-visible result                     | Done when                                                                                                                                            |
| ----- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| P06   | A clear content catalogue                 | Every compatible campaign can be selected and installed; failed downloads preserve the working game and saved flight.                                |
| P07   | Satisfying endings and quick continuation | Retry and Next are direct, unlocks are clear, scores are counted once, and results survive a failed transition.                                      |
| P08-A | The right picture in every mode           | Existing Solo, Versus and Team maps use their approved art, retain the whole arena and show readable players, hazards and objectives.                |
| P08-B | Clear action feedback                     | Cuts, impacts, capture, loss, recovery, Support and rescue explain what happened without overwhelming the picture.                                   |
| P09   | More varied, fair encounters              | New roles have recognizable silhouettes, movement, warnings and counters; difficulty and class interactions are tested without changing old results. |
| P10   | Two richer Team encounters                | Shared objectives, Support and rescue remain understandable for both players.                                                                        |

Enemy pressure should create route choices and close escapes, not unavoidable hits or forced waiting. Bomber/carrier objectives, impact/redeployment and fiber resistance with vulnerable cable remain explicit authored progression work. Winning grants the full picture, then an optional skippable story; unlocked pictures and stories remain replayable without duplicate rewards.

## Third priority: produce complete campaigns

P11–P15 retain the newer target of **132 new Solo missions**: four twelve-mission FPV campaigns, four twelve-mission DroneAid campaigns, and twelve missions each for Ukrainian culture, retro arcade and spend management. Each campaign is its own tested release. Team compatibility must be explicitly authored and verified; it is not inferred from Solo support.

For each campaign, finish its pictures, actor states, role-specific enemies, obstacles, pickups, menus, effects, sounds, soundtrack and rewards together. Introduce unfamiliar mechanics gradually and verify difficulty, progression, replay and every advertised mode before counting a campaign as delivered.

The earlier inventory targets—29 map families, 116 pictures, 12 stories, 56 complete character presentation sets and 24 finished tracks—remain tracked separately. Forty reserve illustrations are now complete as reviewed source art. Body images are not complete animation sets, and reserve artwork is not another finished campaign.

## Final priority: qualify the complete product

P16 completes supporting screens, Collection, scores, saves and recovery. P17 completes guides, AI skills, prompts, templates and reproducible authoring tools. P18 performs the full regression and public browser-release qualification, including performance, media, offline use and real device/controller journeys.

Native iPhone, macOS, Steam and Steam Deck distribution still require their own lifecycle, packaging, signing, controller and store checks. Online multiplayer remains a later workstream; couch play belongs to the browser release.

## How progress is reported

For each phase: show what changed, what passed, what failed, its playable version and what remains. Keep logical Git commits and independently testable releases. Preserve failed evidence and immutable old releases. Mark a phase accepted only after its required public and device checks—not because its code or artwork exists.
