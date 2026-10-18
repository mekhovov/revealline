# Shared demo human and physical-device checks

Status: **not performed**. Automated browser, simulated input, and narrow-layout results are recorded separately in [the evidence index](README.md). Do not mark these checks complete from those receipts.

Record reviewer, date, device/controller, browser/version, mode, source ID, observed behavior, and any recording or issue reference for each check.

| Check               | Procedure and expected result                                                                                                                                                                                                                                                       | Result  |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Goal comprehension  | An unfamiliar player watches each of Solo, Snake Solo, SIM, and Survival. Without coaching, ask what the goal is and which observed action helps achieve it. Record their own explanation.                                                                                          | Pending |
| Practice discovery  | Ask that player to take control, pause, return to watching, and leave the demo. They should find these actions and understand that practice earns no progress.                                                                                                                      | Pending |
| Physical controller | With a real controller and current custom bindings, enter current-mode and mixed demos from each native page. Held controls and drift must not take over; fresh input after neutral should do so once. Confirm, pause, and return must not also activate the underlying game.       | Pending |
| SIM radio/throttle  | With the intended radio and saved calibration, watch a SIM performance, take over, pause, lose foreground, and resume. Verify neutral/pickup and arming behavior, including safe throttle handoff. Saved tuning must remain unchanged.                                              | Pending |
| Mobile touch        | On a physical narrow-screen device, operate shared toolbar, Details, directional/native practice controls, fullscreen, Back, and ordinary Ready launch. Check touch targets, scrolling, orientation changes, and focus/visibility restoration.                                      | Pending |
| Audible behavior    | Listen through at least one full rotation, explicit music play/pause, demo pause, hidden/foreground return, and engine transitions. Verify intended music continues independently, game sounds follow their setting, and audio does not duplicate or continue from a retired scene. | Pending |

For each unfamiliar-player result, retain the observed answer rather than only a pass/fail judgment. Record defects against a specific mode/source and distinguish inability to find a control from an incorrect game explanation.

Public deployment remains separate from this review.
