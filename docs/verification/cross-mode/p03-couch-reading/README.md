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

## Resize checkpoint and second review

Source `93b053931148ae8b26b12c1675945580c9f2b939` adds an opt-in resize handler and active-hint deduplication. Its seven complete files pass 221/221 on Node 22; the shared helper alone passes 42/42 on both supported Node versions. Those scopes do not establish a 221-test Node 20 result for this checkpoint.

Native replay repairs the lobby rotation: in 844×390/DPR1, the Team toolbar is at y141.06 with 44-pixel buttons, hint at y193.06 and text at y241.66 with height148.20 and scroll height656. Focus stays `coop-help-reading`.

A real Team attempt was started and explicitly paused. Plain/Large was applied using the actual display selectors. After portrait/landscape rotation, focus and the displayed paused state/0:00 clock stayed unchanged, and the buttons measured47 pixels. **A remaining failure was observed:** the unit's bottom383.78 fits the 390-pixel layout viewport, but the pause panel clips content at376. The panel is at y12 with height366, a2-pixel border and client height362. The focused text's lower edge is partly clipped. This needs effective ancestor clipping bounds, not a viewport-only test. The screenshot and DOM geometry are original tool-transcript observations; they do not prove private native checkpoint equality.

A three-Escape sequence during a separate lobby check returned to Versus; it did not create a paused attempt. The subsequent Start → Pause journey above was performed separately. This routing attempt is retained rather than counted as successful paused navigation.

Independent source review also found that beginning a native touch pan inside the reader relinquished reading and disabled Done. Initial tests covered tapping Done, but not content scrolling before Done. A bounded opt-in native-scroll lifecycle and dedicated host cases are required; native gestures and modeled pointer cancellation remain distinct evidence. Reading-end announcements also need a single status owner, using typed reading context rather than matching English strings.

## Final scoped correction

Source `f81b14ee69531930b98a9e83dd63d69dd46401c4`, tree `2527fec49634788c7ef498bf124af28bd3c84093`, corrects ancestor visibility, native reader scrolling and duplicate ended announcements. Both Couch hosts opt in; other callers keep their previous defaults. Independent read-only integration review found no concrete blocker.

The same seven complete files pass **269/269 on Node 22.22.2 and Node 20.19.5**, without skips, cancellations or failures. Node 20 ran after the source commit. Both runs used identical recorded inputs, all 754 remained unchanged, and all match this commit's Git bytes. The [final logs and equality receipt](final/) retain the exact commands and scope. The older 221-case resize checkpoint log is preserved separately; its result is not added to the final coverage count.

The new host coverage now includes scrolling inside Help before Done and resize while paused, for both modes. Shared navigation tests cover opt-out compatibility, native default preservation, tracked versus unrelated pointer cancellation, stale ownership and one-argument non-reading callbacks. The reader tests cover client borders, separate clipping axes, nested ancestors, changed clip geometry and lifecycle invalidation. Modeled touch events remain modeled input evidence.

### Final native replay

The preview served immutable files from the final source without game-state injection. The [transport review](final/native-transport-review.json) checked all 400 recorded responses across 247 unique paths / 15,682,364 unique bytes against that commit, with zero mismatches. The stopped server script, binding and request log are archived alongside it. This checks successfully recorded local responses, not public or offline assets.

| Journey                                                                      | Actual viewport / DPR     | Observed result                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Team lobby active Help rotation                                              | 390×844 / 2 → 844×390 / 1 | Focus remains `coop-help-reading`; landscape toolbar y141.06, 44-pixel buttons, text bottom 389.85 within the 390-pixel viewport.                                                                                              |
| Team lobby text click → native scroll → Done                                 | 844×390 / 1               | Text scrolls 390 pixels while Done stays enabled and focus remains in the reader; Done restores Read and disables itself.                                                                                                      |
| Real Team Start → Pause, Plain/Large, portrait → landscape                   | 390×844 / 1 → 844×390 / 1 | Focus and displayed paused state/0:00 remain. Toolbar y138.49 with 47-pixel buttons; hint y193.49; text y227.59, height148.20, bottom 375.78 inside the pause panel's client bottom 376. The earlier clipped edge is repaired. |
| Paused Team text click → native scroll → Done; keyboard re-entry/Down/Escape | 844×390 / 1               | Native text scroll 390 retains Done; both exits restore Read, disable Done and retain displayed pause/0:00. The ended message appears only in the local Help hint.                                                             |
| Versus Large/Plain text click → native scroll → Done                         | 844×390 / 1               | Text scroll 390 retains reader focus and Done; Done returns to Read without starting a round.                                                                                                                                  |
| Versus Enter, Space and Escape exits                                         | 844×390 / 1               | Each returns to Read and disables Done; global menu status does not duplicate the local ended message.                                                                                                                         |
| Versus active Large/Plain reader rotation                                    | 390×844 / 1 → 844×390 / 1 | 47-pixel buttons; portrait unit bottom 626.96; landscape unit bottom 336.87. Focus remains in Help, no horizontal document overflow. Two Escapes then close reading/Help and return to the lobby's How to play opener.         |

Plain/Large was selected through real native selectors. The Team test attempt was intentionally discarded using its actual departure dialog before following the Versus link. A stale inspection helper initially addressed a closed tab; it was replaced with a current-tab read-only inspector. A wait for an incorrect Versus button label timed out; the actual accessibility tree identified Start round, and the keyboard journey continued from that control. Neither tooling error is counted as a product failure or successful journey.

Original accessibility output, read-only measurements and screenshots remain in the tool transcript. This table is a transcribed record, not an exported raw screenshot archive. The browser checks used keyboard and mouse/native scrolling; they do not establish physical touch, controller hardware, native private checkpoint equality, 200% zoom, every route, full-source gates, public play or offline operation. Those remain integration/release requirements. All owned preview tabs/servers were closed and the temporary viewport override reset.

### Handoff and advancement

The scoped source chain is `6c36d732` → `93b05393` → `f81b14ee`. Integrate reviewed deltas into accepted P03 after the current P02 release. Preserve the newer `c93019a3` audio test and permanent note/mutable status split; retain the Team fixture's actual presentation mount/readiness wait. Requalify the combined source and remaining P03 journeys before assigning the next version and publishing. These preparatory commits have no release version, public test URL or phase-acceptance claim.
