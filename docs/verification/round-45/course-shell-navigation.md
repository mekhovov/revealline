# P1.14 — usable training menus

Source correction after the retained public v0.34 observation. This is not a frozen or public release receipt.

First Flight exposed Settings while excluding it from keyboard/controller traversal. It also exposed campaign destinations that its isolated session could not use. Active training now shares its visible header and lesson panel with nonmodal navigation. Modal focus remains confined. Campaign-only menu actions are hidden, and Back to lesson restores the current ready, paused or result screen without resuming. Ended embedded courses hide the shell and retain their terminal reader. The Pause icon appears only while there is an active, unpaused flight to pause.

The real host regression suites pass **62/62 on Node 22** across course/ordinary menus, both turn modes, continuation and device-control visibility. The **ten changed course cases pass on Node 20**; twelve unrelated cases were explicitly filtered in that focused run. Modeled Gamepad and DOM boundaries are identified in the tests. An initial test incorrectly assumed the model implements native modal Tab; another omitted a released pad frame after switching from keyboard. Their failed logs remain retained. Corrections use actual supported menu-arrow events and observe neutral input; production neutral gates are unchanged.

Actual source browser observations at 1280×720: Tab from Start lesson through the course controls reaches Settings; Enter opens its dialog. Native menu Tab/Shift+Tab and Back to lesson return to the same ready state. A real first-lesson win reaches 52.2%, 8,160 points and three retained lives at 0:03; header Settings and Back to lesson remain usable after the result. This is non-awarding training, not a campaign reward. The final source reload separately verifies no inactive Pause icon, Settings and unchanged ready return. Console warning/error logs are empty.

The screenshot and initial browser win predate the final lesson-panel composite inclusion/contextual Pause change. Final reload observations cover that final presentation; the 62-test gate covers the complete final source. Neither these checks nor desktop screenshots qualify physical controllers, phones or every player menu. P1.14 remains open at that larger scope. No simulation, campaign, save/replay schema or historical release is changed.

Follow the [device contract](../../device-controls.md#training-navigation) and the [shared release workflow](../../feature-delivery-workflow.md) when integrating and publishing this correction.
