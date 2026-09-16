# P03 Couch Help reading evidence

This is a scoped candidate record, not a release or phase acceptance. Base: `03d12fb5bfd6315a2d6f71720b3e4987549ae69d`. First source: `6c36d7326492543e55d6a2f3170bae8f443b7216`, tree `e1e4185a2029df81fbb59a63039ea0fbe52ebc93`.

## First source qualification

The six complete shared/Couch files pass 186/186 on Node 22.22.2. The complete Solo reading host passes 7/7 separately. The same seven complete files pass 193/193 on Node 20.19.5 after the source commit. All counts exclude skips and cancellations. The recorded 754 materialized inputs match the committed source byte-for-byte; these are recorded inputs, not a claim that every file executed.

Preserved [predecessor logs](predecessor/) include the initial sparse-worktree failures: missing animation module, prepared Team PNGs, motion presets, and the Solo audio fixture. The files were hydrated from the exact base, retaining original bytes. No production deadline or test expectation was weakened. Partial failed runs are not added to passing counts.

The 12 new Couch cases cover three keyboard exits in paused Help for each mode, pointer/touch Done and cancellation, controller/keyboard changes, idle polling, Help closure, stale Done and terminal cleanup. Versus compares both authoritative checkpoints. Team compares paused HUD/progress and the real painter's command stream; it does not expose a new simulation-state API. The shared reader has additional explicit-surface lifecycle coverage. Existing Solo host checks retain unchanged save/checkpoint assertions.

## Native observations of the first source

The local HTTP server served immutable Git blobs from `6c36d732`; it did not inject application or game state. The browser used the real HTML, modules and assets. Original accessibility output, read-only DOM measurements and screenshots are retained in the task's tool transcript. The following table is a transcribed summary, not an exported raw screenshot archive.

| Journey                                              | Actual viewport / DPR | Observed result                                                                                                                                          |
| ---------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Team lobby keyboard Read, Down, Enter/Space/Escape   | 1280×720 / 2          | Correct keyboard copy; Down moved text by 48 CSS pixels; each exit returned to `coop-help-read`, disabled Done and kept the lobby.                       |
| Team pointer Read → Done                             | 1280×720 / 2          | “Scroll to read · Done reading returns”; click returned to Read. Both buttons measured 44 CSS pixels high.                                               |
| Team active reader portrait                          | 390×844 / 1           | Done and hint visible; text client height 321, scroll height 787.                                                                                        |
| **Team active reader portrait → short landscape**    | **844×390 / 1**       | **Failure:** focus stayed `coop-help-reading`, but toolbar top became 388.06 and text top 488.66 CSS pixels. The controls/text moved below the viewport. |
| Versus lobby keyboard Read, Down, Enter/Space/Escape | 844×390 / 1           | Correct keyboard copy; Down moved text 48 CSS pixels; all exits returned to Read and disabled Done.                                                      |
| Versus pointer Read → Done                           | 844×390 / 1           | Correct pointer copy and Read return; 44-pixel buttons.                                                                                                  |
| Versus portrait reading                              | 390×844 / 1           | Toolbar, hint and scrollable text visible; text client height 437, scroll height 892.                                                                    |
| Versus Large/Plain landscape reading                 | 844×390 / 1           | Toolbar and hint visible; 47-pixel buttons; text client height 201, scroll height 601.                                                                   |

Text settings were applied with native select controls through the browser tool after a keyboard sequence left their values unchanged and a label locator failed. Those attempts are not counted as keyboard-only setting changes. The native reader journeys themselves used keyboard and pointer actions. They do not qualify physical touch/controllers, native paused checkpoints, all settings, zoom, full gameplay, public bytes or offline operation.

The Team rotation failure is retained as a blocker for the composed P03 journey. Existing P05 source `657ac7b5` changes the Versus shell only and cannot repair the Team reader. A subsequent opt-in shared-reader correction must be verified on a distinct source; it must keep Done/hint visible while the text remains scrollable, retain the focused region and pause ownership, and preserve all callers that do not opt in.
