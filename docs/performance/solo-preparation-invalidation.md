# Start preparation invalidation

The public Demo → Play from beginning → Start route exposed a preparation race in the **14ac29e2 production artifact**. At the failed acceptance guard, the run was unchanged at tick 0, painter generation stayed 3, painter revision stayed 10, and there was no abort or lost canvas. An asynchronous `theme-host.accept` notification changed the scene revision from 2 to 3. The resulting `AbortError` was incorrectly shown as unavailable original media.

The original failed counter report and both instrumented diagnostics remain unchanged. All nine counter windows and the original recording’s strict replay passed separately; the final new-flight Start failed. These debugger observations are excluded from timing, power and device qualification. The first diagnostic observed no HTTP error responses; the attribution comes from the captured guard and invalidation stack, not from transport counts.

Commit `2990a7d01` retries preparation only while the original run, painter generation, backdrop and actors remain owned. A changed scene revision requires another `painter.prepare` and a fresh visible Phaser submission. Changed painter revision, cancellation, loss of focus, open dialog and lost canvas still prevent acceptance. Intentional cancellation no longer publishes a missing-media error. Simulation rules and accepted appearance are unchanged.

The final regression fixture completes the browser stylesheet-load boundary and verifies that the real theme owner actually invalidates the scene. Against the exact previous app bytes it fails because no second preparation occurs. With the fix, **10/10 host tests pass** in 30.265 seconds: theme refresh, cancellation before submission, explicit Resume, visible submission, context recovery, retained display and covered Demo behavior. Checkpoints remain unchanged during preparation and interruption. Scoped syntax, lint and formatting checks pass.

Earlier attempts were fixture failures: the minimal DOM did not complete stylesheet loading, so the theme was never accepted; one diagnostic attempted an active export; another lacked viewport globals. They are retained and excluded from regression proof. The final before/after runs use identical test bytes.

This is Node host correctness evidence. The independent source-preview public handoff and a newly built production handoff remain separate observations. It does not turn the failed 14ac production handoff into a pass or establish physical-device performance.

[Machine-readable proof](solo-preparation-invalidation.json) records source and raw-report hashes, commands, captured guard values, exact before/after results and all earlier attempts. Raw evidence is retained under `.cache/solo-followup/prepared-board-invalidation-01/` and `.cache/solo-followup/demo-handoff-14ac29e2/`.
