# Round 21 source browser checks

Working v0.11.0, checked 12 September 2026. Source QA used its own CLI server at `http://127.0.0.1:8818/`; the workspace server on 8767 and fourteen frozen releases were left unchanged. These observations identify a working source, not a frozen or publicly deployed artifact.

## Solo encounter and persistence

Installed Sentinel Relay through Library & saves → Expansion packs. Selected its campaign normally. The ready card derives its 75% quota, two required objectives and eight-new-cell opening requirement from the level. Its four worlds and seven starting classes are selectable. An initial unfocused timing attempt only moved around the safe border; it is not a recorded winning route.

Imported the public-API replay-backed phase prefixes described in `.cache/round-21/browser/manifest.json`. They were constructed from the existing legal input proof and fully reverified before import; no game state or win flags were injected. Each import uses the normal visible Save JSON control and returns a paused flight.

| Prefix          | Live visible cue after Resume                                             |
| --------------- | ------------------------------------------------------------------------- |
| Shield warning  | 1 / 2, LANE WARNING; patterned horizontal lane, row 2                     |
| Transition      | 2 / 2, SHIELD OPENING; next attack described as vertical                  |
| Stage 2 warning | LANE WARNING; patterned column 20                                         |
| Stage 2 active  | LANE ACTIVE; solid column 20                                              |
| Stage 2 open    | CORE OPEN; lane gone, core brackets open, current-cut requirement visible |

[Warning](screenshots/immediate-stage2-warning.jpg), [active stripe](screenshots/immediate-stage2-active.jpg), [opening](screenshots/immediate-stage2-open.jpg). Cues were read through the UI and screenshots captured while simulation was running, then paused. These are discrete observations, not a frame-by-frame animation or audio audit.

- **Immediate timed release:** loaded the verified live cut 24 ticks before its ordinary finish, resumed and pressed visible Left. Won at 100%, three lives, 16,640 points, gold, about 15 seconds. The full picture, score and first/final chapter appearances were awarded. All seven newly unlocked appearance names appeared. [Result](screenshots/ordinary-release-result.jpg), [picture](screenshots/ordinary-picture.jpg).
- **Grid isolation:** enabled Reduced effects, loaded the verified isolation route 20 ticks before completion, resumed and pressed Right. Won at 100%, three lives, 16,640 points, about 34 seconds. The HUD identified an isolation finish; it did not show another new-appearance message. [Result](screenshots/isolation-result.jpg).
- Collection retained one Sentinel picture and the campaign's completed achievements/appearance tiers. Its best picture result remained gold; two exact setup score records were kept.
- **Missed opening:** loaded the Grid prefix at the last tick of the first opening. Resume advanced into the next visible warning. Paused, used Save & pause, reloaded and used Load saved flight. The phase text remained exactly `2 / 2 · LANE WARNING · 1.8s` with the same zero/eight cut instruction.
- Normal player-library export after reload contained one picture, two scores, no optional seals. Export: 2,321 bytes, SHA256 `49a71ebcb95022dd975bc66083a5a924032bab851241547cfcd324e3976708be`. No v3 optional mastery is claimed.
- Source browser error/warning log was empty at this checkpoint.

The screenshot initially taken before the layout correction showed the extra encounter card pushing controls below the visible board. The fix reserves board height for encounter text while retaining panel width, so controls do not wrap more. At 1280 × 720, the board was 400 × 300 and the phase card and controls were visible together. Desktop D-pad targets remain smaller than touch targets; they are not described as 44px.

## Authoring and embedded viewports

Loaded Sentinel Relay from the actual playground example button. Changed the open phase from 480 to 600 ticks and applied it. A missing shield-reference edit was rejected, retaining the valid 600-tick map. Undo restored 480. Explicit ordinary conversion removed the sentinel and descriptor, changed to level v1, retained both objectives and artwork; Undo restored the exact encounter. These were UI edits, not direct object mutations.

Selected the retro world and Grid + buffer, launched the real practice frame, and observed the encounter HUD. Export map as expansion produced a pack-v3/core-v3 file with `masteries: []`, retro presentation and the exact original encounter descriptor. A browser check found the old export callback promised copyable JSON but did not populate its field; all three playground export actions now retain their matching JSON in the opened details panel. Retested the expansion export successfully.

The exported pack was 7,541 bytes, SHA256 `9d63244f35358eb089ccdd25a6bb8eccd37fdd7b98c9a5e4a4f9adf886b2655a`. CLI `inspect-goals` accepted its structure and references, reported `level-v2-f5ae56564ac522a9` and no goal. This inspection was not presented as a new solvability proof.

[Embedded viewport readouts](editor-viewports.json) cover 320×640, 390×844, 844×390, 1024×768, 1280×720 and 1065×912. Each preview was freshly loaded after sizing to avoid measuring a retained scroll position. All showed a complete board, visible launch action and no horizontal overflow. The 320×640 case needs vertical scrolling for some controls; the other five reported all actions visible. Touch-oriented fixtures reported at least 44×44 controls; desktop 1280×720 reported 34×28. These are same-browser CSS fixtures, not physical phone tests.

## Couch play

Selected the installed encounter and Grid + buffer, enabled Tap controls and used Focus boards. Both boards showed independent ready instructions. The first approximate timed pointer sequence lost two lives without capturing the relay, exposing why the warning rhythm matters. No winning result is attributed to that attempt.

A fresh round then used only visible player-one direction/Stop controls, ordinary wall-clock delays and the visible phase text to choose a rest period and core opening. It captured the relay and **won from a fresh board** at 100%, three lives and 16,640 points. No saved prefix or direct state access was used for this couch win. The untouched second board remained at 0% with three lives and its own stage-1 active stripe; both stopped together at the round result. The winner's cue identified core release, while the other board explicitly identified its frozen state. [Couch result](screenshots/couch-encounter-finish.jpg). Error/warning log: empty. This is a controlled browser input sequence, not human or physical-controller certification.

## Replay Theater

Imported the standalone v4 recording made by public simulation/recording APIs from the unchanged ordinary Scout proof. The full summary and checkpoint were checked before import. Theater accepted it, showed the initial encounter cue and played all 1,792 ticks at 2× to the final matching checkpoint `74178fe96a758d82`, with no progress awards. The terminal cue identified the released core. [Playback result](screenshots/replay-encounter-complete.jpg). The v4 file is 8,625 bytes, SHA256 `883d6f99aba0a1e1cafc9dcfd97a59aa175be02a78f8f328636834aba66d79b9`.

Loading the legacy Fieldcraft example afterward verified successfully and hid and emptied the encounter cue. The theater error/warning log remained empty. All linked source screenshots were visually reviewed; result screenshots include a scrolled viewport, while the separate picture screenshot shows the complete arena. Additional compact-screen observations and final candidate/frozen checks are recorded separately as they are completed. No public-host, physical device, audio-listening or retention claim is made by these source checks.

## Short-window correction and exact preview sizes

A static review found a breakpoint defect in the first encounter layout: at 844×500 the board was calculated as 285px high, but at 844×501 the next height budget reduced it to only 31px. The final CSS gives encounter boards a practical minimum width (320px above the short-landscape breakpoint, 200px within it), constrained by the available column. Small windows can scroll vertically instead of collapsing the board.

Added a real Playground custom-size form with whole-number dimensions from 240 through 2560 CSS pixels. Requested and actual iframe dimensions appear together. The browser's outer viewport override did not consistently reach this QA tab, so it was reset; those requests are not recorded as successful viewport measurements. The following observations use the actual embedded game and its visible measurement readouts.

[Additional viewport records](breakpoint-viewports.json) show fresh solo ready boards at 844×500, 844×501, 844×520, 1101×501 and 681×501. Actual iframe dimensions matched every request. The last four retained a 320×240 board and a visible launch button with no horizontal overflow. Some below-board controls require vertical scrolling; the 1101px desktop case retains its smaller 34×28 direction buttons. A width of 239 was rejected and retained the previous 681×501 frame. [Preview at the boundary](screenshots/preview-844x501.jpg).

Resizing a paused live encounter preserved its exact phase/countdown text. The existing inner scroll position was also retained, so that paused observation needed scrolling back to see the whole board; it is not a claim that resizing resets page position. Preset selection remains available and synchronizes the numeric fields.

Couch mode uses installed maps rather than the editor's solo configuration. Selected its installed Sentinel map explicitly, then used Focus boards. At 320×640 both independent cues and actions were present, with vertical scrolling needed for the lower board; controls measured at least 45×44 and no horizontal overflow occurred. At 844×390 both boards and all actions fit, with at least 44×44 controls. [Landscape couch preview](screenshots/couch-preview-844x390.jpg). Changing mode or focus paused the round; resizing did not run the clock. The editor's error/warning log was empty. These remain same-browser layout observations, not physical phone or controller certification.
