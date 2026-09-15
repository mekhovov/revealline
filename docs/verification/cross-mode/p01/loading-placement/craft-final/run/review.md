# Candidate craft focus and Controller CF1 native closure

The bounded candidate-source checks passed: all four craft layout cells kept the loading label, focused Pack selector and Back fully visible and hit-test clear; Controller Apply and Cancel restored actual keyboard focus to enabled Edit, with working Tab continuation. This is localhost source 0.57.2 / production r21 evidence, not ordinary-build, frozen-release, public, physical-device or overall P01 acceptance. No source, build, Git or release changes were made by this trial.

The exact source pins in `source-closure.json` all match launch (16/16). `process-closure.json`, `close.json` and `exit.json` record closure of the owned Chrome, observer and source server; both ports are closed. All 227 foreground guards reported the exact single page visible and focused. No additional trials remain running.

## Craft geometry and painted states

`native-events.jsonl` retains immediate native status mutations separately from `post-three-frame-turn` observations. Each row below passed center plus all four interior corner hit tests, viewport and ancestor clipping checks for all three targets; active focus remained `SELECT#pack-select`. Values are top–bottom CSS pixels at the immediate mutation, not inferred screenshot measurements.

| Actual configuration | Event sequence | Loading label | Focused Pack | Back |
| --- | --- | --- | --- | --- |
| Standard portrait | 2 | 176.30–196.59 | 427.61–471.61 | 70.64–114.64 |
| Standard landscape | 4 | 141.30–161.59 | 260.03–304.03 | 57.14–101.14 |
| Large / Plain / Reduced landscape | 8 | 155.48–181.58 | 256.34–301.34 | 62.73–109.73 |
| Large / Plain / Reduced portrait | 9 | 249.27–275.36 | 576.34–621.34 | 105.62–152.62 |
| Previously selected body, Large portrait | 10 | 249.27–275.36 | 576.34–621.34 | 105.62–152.62 |

The four configurations are 390×844 portrait and 844×390 landscape, each Standard/Theme/full effects or Large/Plain/Reduced. Controls measured 44–47 px high. The return selection is an actual previously selected body, with no claim of an HTTP cache hit. Standard operations completed before their later captures; their immediate busy DOM and separate ready post-frame observations remain retained.

`07-large-landscape-completed.png` and `09-large-portrait-completed.png` actually paint **Loading craft and scene artwork…**, despite their original filenames; their paired JSONs are busy too. The separate selector-focus captures preserve the same clear targets. After actual Deploy, pause and Mission brief actions, `12-direct-brief-portrait.png` / JSON at 14:22:49.653Z show loading with Back and Read mission brief visible. `13-direct-brief-landscape.png` / JSON at 14:23:51.567Z show **ready, collapsed status** with Back clear. That landscape screenshot is not loading evidence. Return through Back to the paused game and Settings succeeded. No synthetic delay, failure, app state or release metadata was introduced.

## Controller CF1

At 844×390 Large/Plain/Reduced, `15-controller-after-apply.json` records active `BUTTON`, action `edit`, `matches(:focus)` true, exact equality to enabled Edit, full viewport visibility and center hit, with its 47 px target at y179.92–226.92. The applied status was visible. `16-controller-next-tab.json` records the next actual focused enabled `SELECT#controller-boost-mode`, visible at y328.92–373.92. Reopening Edit retained Xbox. After selecting PlayStation in the draft, native Cancel again focused the original enabled Edit (`19-controller-after-cancel.json`); reopening showed Xbox (`20-controller-reopened-cancel-proof.json`), proving the draft was not committed. Empty button IDs were not used as focus proof. The initial click which did not open Edit is retained in `actions.jsonl`; native focus plus Enter then opened it successfully. Keyboard Escape closed Settings at the end.

## Timing and evidence limits

Craft status actually cleared at **2026-09-15T14:23:19.361Z**. In the later Large-preference interval, rAF/task and timer observations were delayed even though foreground guards remained visible/focused; a 100 ms observation timer also fired late. `callback-timeline.json`, both frame-probe records and original events retain the ordering. Post-frame callbacks may observe a later viewport or screen, and are not treated as the original mutation's painted state. The delay has no established product-versus-browser/automation cause; no timing was changed to force a pass.

The guarded browser error output is empty, and retained non-observer console lines contain no errors or ResizeObserver warnings. `native-resource-timeline.json` contains 250 real buffered ResourceTiming entries with response-end fields, but the buffer was full and lacks late motion artwork entries: a complete late request timeline cannot be reconstructed. `native-resource-tree.json` is a later resource snapshot, not retroactive network timing. These limits remain explicit; the actual painted loading captures and eventual terminal observation stand independently.

Previously completed Library r3 landscape/focus/manual-scroll and clean portrait detail/Close/reopen evidence are reused unchanged from `v0571/library-rail-r3-native/run` and `v0571/library-rail-r3-foreground-preparation/run`. Library was not rerun here. Error/stale/runtime ownership cases remain source-test evidence; no new native failure branch or physical controller coverage is claimed.

The adjacent final manifest selects original actions, screenshots, measurements, passive observer/launcher source, timing records, preparation records and closure pins. It excludes the browser profile, caches and the manifest itself. Screenshot names and bytes, including misleading historical names and inconclusive attempts, are preserved.
