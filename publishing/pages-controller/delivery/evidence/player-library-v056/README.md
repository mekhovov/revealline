# v0.56 player-library and controls delivery

**v0.56 is deployed, with complete public-byte verification and the scoped browser checks below.** [Play the current game](https://mekhovov.github.io/revealline/game/) · [Play frozen v0.56](https://mekhovov.github.io/revealline/releases/v0.56.0/site/game/).

Publication PR #54 merged at controller `02364d4`. [Production run 34950891496](https://github.com/mekhovov/revealline/actions/runs/34950891496) and deployment `6455476355` succeeded, serving frozen game source `20f0179`. The [complete public audit](public/completion.json) verified **2,337 files / 635,636,681 bytes**, with **zero failures, retries, skips or uninspected files**. Source and deployment identity remained unchanged after the audit. This covers the deployed namespace; it does not repeat every historical archive-body audit.

[PR #57](https://github.com/mekhovov/revealline/pull/57) subsequently admitted Archive12's preserved v0.52/v0.56 editions. [Production run 34954644998](https://github.com/mekhovov/revealline/actions/runs/34954644998), controller `65b1935` and deployment `6456165541` succeeded. The [successor full public audit](public-successor/completion.json) again passed all **2,337 files / 635,636,681 bytes**, with zero failures, retries or skips. Its entire ordered public inventory is byte-identical to the first deployment. The earlier browser observations below retain their original attribution; they are not presented as new native checks.

P00/v0.55 is accepted. **P01/v0.57 is in progress in the cross_mode workstream.** This additive release preserves P00 and the earlier Field Kit work; it does not mark later roadmap phases complete.

The [feedback-to-phase review](planning/feedback-and-next-phases.md) maps every requested correction to its implemented behavior, remaining acceptance and priority. The [audio acceptance matrix](planning/audio/ACCEPTANCE.md) defines the next bounded implementation slices against its explicitly recorded source checkpoint; it is planning, not completed audio qualification.

## Delivered player changes

- **Guided backups:** prepare game data, picture originals, stories, music and a coverage report together, then download each explicitly. A unique common filename prefix avoids collisions. Short purpose labels, wrapped optional filenames and details-first Back keep the interface compact. The strict read-only checker verifies the actual set without importing it or granting earned ownership.
- **Library and menu navigation:** Title-origin Missions cancellation returns to Title; flight-origin cancellation returns to the paused field. In-flight craft switching requires another eligible craft and an authored hangar. Returning focus never resumes a flight.
- **Music library:** the first Studio opening restores focus after loading while preserving intentional focus changes; cached openings and return focus remain intact. Earlier failed correction evidence is retained.
- **Relay Rescue:** contextual cardinal controls, bounded pause panels and keyboard Help/Options/Back without accidental Resume. Fullscreen/platform metadata from P00 remains integrated.
- **Preserved Field Kit behavior:** readable menus/HUD, Theme/Plain and Large text, contextual touch controls, distinct enemy roles and travelling line impacts where authored. Closing a cut on secured ground stops a capture-stop craft until fresh input; releasing direction during a cut does not stop it. Immediate and Grid + buffer remain available. Arcade collects automatic bonuses; Tactical/manual actions depend on the authored craft and map.

## Actual public browser checks

The [root browser record](native/completion.json) used fresh in-app-browser tabs **in an existing browser profile**, not a clean profile or physical device. The [title observation](native/title.jpg) showed version 56.

Keyboard Deploy entered the installed Pressure Lines campaign. A Down cut captured **50%**, retaining **three lives / 11,720 points**. Capture-stop worked; Pause/Resume retained the stopped state. Reload → Continue restored **50%, three lives, 11,720 points and 2:25 remaining**, still paused.

Keyboard navigation reached Settings and Studio. First-open focus landed on **Close studio**; Escape returned to **Music library & playlists**. Game Data → Library prepared all five backup files. First Escape closed File names; second returned to Saves & recovery. **No public backup downloads were requested in this check.**

Public Team play started Relay Yard. Escape paused; keyboard Options selected **Show both** after explicitly opening the native select. The earlier ArrowDown/Enter attempt left Auto unchanged and remains recorded. Options Escape kept the game paused. Resume displayed cardinal pads below an unobscured arena; the final state was paused. Team artwork parity remains P08 work.

Team also needs the shared Plain/Large preference bridge and actor-size/state review. Existing pursuit/interception behaviors and three completed source missions do not establish that the requested enemy speed, challenge and enjoyment are satisfactory; difficulty tuning remains open acceptance.

These observations do **not** certify disconnected-network behavior, audible media, real gamepads/physical touch, phones or Safari. Earlier source-layout observations and P00 offline evidence retain their own identities.

## Source, frozen files and earned progress

Exact source passed **all six gates, 4,110 tests across 368 files and the build**. Preflight separately passed **69 production checks**, not 69 extra unique tests. Frozen qualification and complete original-artifact verification passed; hosted extraction checked **650 ZIP members / 649 manifest entries**.

Earlier actual source keyboard play completed Pressure Lines on Standard / Immediate; the game runtime is unchanged at final v0.56:

| Mission | Captured | Lives left | Score | Medal |
| --- | ---: | ---: | ---: | --- |
| Orchard Crossing | 69.3% | 2 | 16,250 | Bronze |
| Courtyard Exits | 75.7% | 2 | 17,500 | Silver |
| Night Crossfire | 81.5% | 2 | 18,980 | Bronze |

Campaign completion showed 3/3 and all three Collection pictures. Capture-stop, line impacts, losses, freeze and extra-life pickups were observed; failed routes remain retained. Pale legacy objectives in victory/Collection are an explicit P08 presentation gap.

A separate actual source-origin five-file download containing the **earlier single earned Orchard picture** passed the checker on Node 20 and Node 22, including its score/progress record. This is neither a public-download proof nor a backup/restore proof for the later three-win profile. Custom originals, fresh-origin restore, missing-media recovery and offline audio/video round trips remain open.

## Content and next priorities

| Target | Recorded progress and remaining work |
| --- | --- |
| 29 map families / 116 pictures | Historical delivered cohort: 15 / 60; another 3 / 12 are source candidates. Remaining beyond delivered content: **14 families / 56 pictures**, including candidates until qualified. |
| 12 victory stories | One released example; **11 remain**, plus broader media/replay/recovery qualification. |
| 40 reserve illustrations | **40 selected source originals**, ten per theme, with provenance/catalog. Generation is complete; use-specific adoption remains. They are not extra maps or animation sets. |
| 56 complete character sets | Body cohorts exist; complete states/rotors and both detail treatments remain. A completed-set count cannot be inferred from bodies. |
| 24 finished tracks | A 24-track source candidate still needs full listening, mix, transfer and offline qualification. |
| Authoring | **13 AI skills** are included; independent creation → install → play → recovery examples remain P17 acceptance. |

The approved sequence remains **P01 loading/cancel/retry**, then **P02 audio**, **P03 mode entry/Back**, **P04 creation/pack round trips** and **P05 shared presentation**. P06–P10 cover content installation, endings/rewards, map-art parity (P08-A), action feedback (P08-B), fair encounters and richer Team encounters.

P11–P15 retain **132 new Solo missions**: four twelve-mission FPV campaigns, four twelve-mission DroneAid campaigns, and twelve each for Ukrainian culture, Retro and spend management. Each needs independent qualification; Team compatibility is authored explicitly. P16–P18 complete supporting screens/saves, guides/AI workflows and full regression/public/offline acceptance. Physical-device and iPhone/macOS/Steam/Steam Deck distribution checks remain separate; online multiplayer is later work.
