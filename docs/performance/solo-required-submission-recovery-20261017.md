# Required board-draw recovery

A source control demonstrates a preparation ownership defect: after detached preparation, `FieldScene.prepareBoard` waits for a visible Phaser submission. If `painter.draw` throws in that owned paused frame, the previous catch clears submission bookkeeping but leaves preparation pending and rethrows. The pinned Phaser 4.2.1 RAF callback schedules its successor only after the callback returns, so that throw also stops the frame loop. This is distinct from the previously retained Pressure Lines and equipment Start timeouts; neither older failure recorded this cause.

The correction rejects the exact pending preparation with the original error only while its run, ticket, painter generation, artwork, foreground and callback still belong to the paused attempt. The frame callback returns so the existing preparation error UI can settle. A same-run paused hold prevents a persistent board fault from retrying itself on later frames; input and UI polling continue. Cancel and context restoration retain that inactive hold. A fresh explicit preparation clears it only after its asynchronous painter work succeeds and installs the next submission callback. Run replacement, active state and scene retirement also retire the hold. This does not introduce a deadline, automatic retry or recovery for unrelated active-play errors or errors in Phaser's later renderer callback.

Abort listeners use a separate wrapper so an AbortSignal Event cannot become the rejection reason. The two production `prepareBoard` call sites await sequentially under one Resume ticket; public cancellation aborts the prior controller synchronously before replacement. Successful POST_RENDER removes its listener synchronously. Retired callbacks cannot reject or clear a replacement.

The controls use the exact callback-before-reschedule function extracted from the pinned vendor file. They seed its callback queue once, then prove persistent-error recovery and explicit Retry without reviving the loop manually. They also cover failed asynchronous Retry, context restoration, unchanged checkpoint, live input, cancellation/replacement, actual painter retirement and preserved ordinary/reentrant throws. These are source and modeled-host checks, not native raster or performance qualification.

| Complete check                                                 | Result                             |
| -------------------------------------------------------------- | ---------------------------------- |
| Current equipment host, before this change                     | 7/7, 43.0 s                        |
| Current capture differential host, before this change          | 16/16, 286.7 s                     |
| Render submission file with four new controls                  | 12/12                              |
| Preparation layout host with cancellation/replacement coverage | 6/6                                |
| Practice render-failure host with a required dirty frame       | 4/4, including its parent/subtests |

The first two current-source checks do not explain the older timeouts. The original submission control fails before the runtime correction with the exact injected error escaping the pinned RAF callback. All retained checks have scoped source inventories. Raw outputs are under `.cache/solo-followup/solo-start-current-audit/` and `.cache/solo-followup/required-submission-recovery/`.

The initial three-file recovery check retained two practice assertion failures and their failed parent: both probes armed a renderer on an unchanged paused display, where no draw occurred. The same complete file failed identically on the unchanged runtime. Its correction requests a dirty board with the existing public resize event before the armed frame; the practice case also requires exactly one draw. The complete corrected file passes on both the unchanged and corrected runtime. Original checkpoint, held Confirm, native Return, storage isolation and exact ordinary-error assertions remain intact. The failed parent receipt is retained; successful file results are reported separately rather than relabeled as one passing aggregate.
