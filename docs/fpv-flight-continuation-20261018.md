# Flight continuation and rendered acceptance — 18 October 2026

This record supplements the source-bound automated [sustained qualification](fpv-sustained-flight-qualification.json). It separates public failure observations, local corrections and acceptance from publication. It does not claim physical-radio or real-aircraft validation.

## Public reproduction

On public source `20555cda6bd44a0736aa829e64c52e455b4e770c`, a normal keyboard-driven Meteor75 draft in World learning's **Lift and land** practice took off, responded to yaw/pitch/roll, descended, landed and took off again. It also contacted the 10 m ceiling; this was not a continuous free-air hover.

After a deliberate pause, explicit Resume displayed zero throttle instead of the prior airborne setting. Restoring throttle through the normal W-key ramp took long enough for the aircraft to hit the floor and flip. The session eventually reached 5:44.60, with a durable checkpoint at 5:40. The sixteen-entry archive store was full; that did not prevent flight or checkpoint writes. This failed attempt is not a twelve-minute rendered qualification.

## Corrections and automated regression evidence

- Explicit keyboard Pause/Resume retains the last accepted throttle for that same flight, while clearing all held axes. Safety interruptions, source changes, resets and new attempts still clear input. Pending worker steps keep a premature Resume paused with a clear message; a later explicit click uses whichever input actually committed. No delayed automatic arm is scheduled.
- Actual browser zoom review found that incomplete camera text such as `4` could clamp its paired vertical-FOV slider to 40 even while the exact field was invalid. The slider and preview now retain the last valid value while the unfinished text remains editable.
- An unexpected archive database close invalidates its cached handle so a later operation can reopen it. Writes with uncertain outcomes are not automatically replayed. This resilience correction does not explain the separate missing-inventory observation or qualify retention.

The original six pause/resume host scenarios fail against the old source and pass with the fix. Additional held-worker and repeated-shortcut regressions cover review findings. The complete Academy/World UI suites pass **158/158**, with no skips. Their first full run exposed a test-only locale leak in the new English-text assertion; saving/restoring the test locale corrected it before the clean rerun. EN/UK camera negative controls fail against the old behavior. All thirteen archive-store checks pass, including failed-write durable-prefix preservation and explicit disposal.

## Actual browser zoom

A separate native Chrome Guest window exposed its own toolbar's **Zoom: 200%** state. English and Ukrainian workbench camera search, exact keyboard numeric editing, revert and reachable focus/actions were exercised. Basic remained selected when searching unavailable Legacy PID controls. The numeric field was visibly unobscured; this is actual browser zoom, not a CSS viewport substitute. Zoom was restored to **100%** and only the temporary Guest window was closed.

A valid numeric 86 / stale-range observation from native accessibility output was not reproduced in the unit checks; it is distinct from the confirmed invalid-text bug. Final browser DOM verification is recorded separately below. This single-desktop check does not qualify mobile keyboards, physical touch devices or every zoom/layout combination.

## Local rendered flight

The localhost source preview serves tracked assets directly and missing sparse assets from the base Git tree. It is a source-runtime check, not a generated-package, production-CSP or offline-installation check. Its first loaded host contains the initial pause fix; later pending-worker and database-close corrections require a subsequent reload and are not retroactively attributed to this run.

With Meteor75 in World learning, the visible Pause button and P shortcut both resumed at 50% throttle with roll/pitch/yaw neutral. The aircraft remained responsive to ordinary keyboard corrections, descent, physical contacts and re-takeoff. The session reached **14:20.30** despite the failed archive connection; the recent clip was **12:00.00–14:20.30** and the last durable checkpoint **14:20.00**. Its observed ground/ceiling intervals are not counted as measured airborne time.

After reloading final source `5978a00ed7`, Academy Meteor75 resumed explicitly after the visible Pause button and repeated P shortcuts. A gentle descent remained upright. Camera DOM reads showed valid exact/range values **86/86** and then unfinished exact/range values **4/86**, confirming that invalid text retains the last valid slider value.

Cetus X and Protos were explicitly selected into unsaved Academy drafts. Each took off with ordinary keyboard throttle, responded to yaw/pitch/roll and retained usable control after deliberate pause/resume. Their short checks included ceiling contact and are not full-course or factory-controller qualification. Protos displayed its inferred mass and unsupported stock hold/Angle behavior before testing. All draft edits were reverted without saving the player library.

The reloaded World host downloaded the 1.1 MiB **Canyon Badlands regional preview**, version `rounded-r1`, through its normal UI. Meteor75 draft practice remained upright through descent, climb and steering; explicit P → Resume retained **50%** throttle and neutral rotation. The session reached **0:50.78**, with a durable checkpoint at **0:50.00**. Explicit **Finish current archive** succeeded, and **Verify selected archive** reported **Complete session physics verified from reset. Unscored.** This is one starting-area check and one new archive, not exhaustive Regional route coverage or a resolution of older missing inventory.

Hosted packaging/publication and acceptance on the deployed revision remain pending at this documentation checkpoint; see the [current completion plan](fpv-current-completion-plan.md).

## Final candidate catalog smoke

On rebased candidate `c7cafc72330271ed99ebf8f7b50b758beb8e7aa9`, all fifteen aircraft
were selected through the World workbench and launched in **both Self-level and
Acro** using normal keyboard throttle/yaw/pitch. The [DOM-observed receipt](fpv-rendered-catalog-20261018.json)
retains each aircraft's displayed response. These are short launch/steering
checks in Lift and land's unscored practice, not completed lessons or long routes.

The first Meteor75 Pro Self-level check used too much throttle and contacted the
10 m ceiling, becoming inverted. A fresh gentler 1600 ms ramp was observed upright
at 0.6 m, climbing at 2.5 m/s with 57% throttle. That immediate observation is
recorded separately from the later retained retry sample. Subsequent checks used
gentler ramps. The original failed sample remains in the receipt.

The local archive cap was reached during the repeated flights; flying continued.
Draft changes were reverted and the original Self-level mode restored. Switching
mode required waiting for the new paused attempt before reopening the workbench;
an early activation during that transition did not remain open. No saved tuning
library was changed. This receipt does not replace production-CSP/public checks.

## Additional current-source routes and reopen check

On source `cf13bcad9a59a387be7c31c9af8d30d74e7c1860`, the local World host also
ran two representative draft flights. The X650 check entered **Clockwise catch**
in **Circuit stadium** and reached **0:25.54**, with the checkpoint at **0:25**.
After explicit pause/resume it retained **46%** throttle, neutral rotational
input and an upright response at 17.7 m with approximately −0.1 m/s vertical
speed. Archive capacity was full and did not end the flight.

The **Cetus X** check entered level 91, **Turn and travel** in **Open meadow**,
then explicitly used **Test draft**. It reached **1:12.76**, with the checkpoint
at **1:10**. Normal keyboard input produced takeoff, steering, descent and
re-takeoff. The run included contact with the 10 m ceiling and ground; it is not
a measured continuous-airtime result. Explicit resume retained **46%** throttle
and neutral rotational input. Both checks used Self-level. Test draft starts
unscored free practice, so these checks do **not** claim completed course goals.

At **1:04.50**, Finish current archive saved the Cetus session. Verification
reported **Complete session physics verified from reset. Unscored.** Flying
continued for another 8.26 seconds after the archive finished. The saved label
was `World · 2026-10-18T18:50:32.960Z · 0:00–1:04 · finished`.

After reverting the draft and reloading the same browser tab normally, a new
unarmed aircraft draft exposed the recording panel without creating another
archive. The same saved label remained available, and verification again
reported a complete session verified from reset. The temporary draft was
reverted, its flight remained paused and the agent-created tab was closed.
No saved tuning-library edits or archive deletions were made in this check.

This is one positive same-tab reload/verification observation on the source
preview. It does not close the protected-record incident, qualify cross-context
storage or establish production/offline behavior. Opening this test tab initially
required the local password again and showed a different archive inventory from
the previous closed test tab; the browser storage-context relationship was not
observed. Do not infer native deletion or recoverability from that difference.

## Open archive-retention incident

The user authorized deleting exactly ten identified test archives while preserving six older records. The first attempted action reported a closing-database error; all sixteen entries remained in the cached list. After reload, a successful refresh exposed only a new test session. No successful ten-record cleanup or preservation of the six older archives is claimed. No further deletes were attempted. The [retention follow-up](fpv-archive-retention-followup-20261018.md) records the ownership audit and the earlier matching public negative. This remains P1.
