# Round 22 source browser verification

Checked working v0.12.0 on 12 September 2026 through the real UI at the isolated source server on port 8821. The workspace server on 8767 and all frozen releases were unchanged. This is browser software verification, not physical-controller, phone, accessibility-assistive-technology or public-host certification.

## Controller reading

Controller Lab offered 18 practice choices, including canonical Sentinel Relay and the local long-briefing fixture, The patient route. The latter uses ordinary first-map geometry, a 45% quota and a 2,839-character original briefing. It grants no progress and is not installed as an expansion.

At its reported 320×640 iframe size, joined the virtual pad through physical South, navigated from Start to Read details, entered and returned without launching. Controller navigation then opened Mission brief and its reader. Repeated visible Down pulses reached the final paragraph and the `End of details` hint; the clock remained zero. This exposed a half-width mobile briefing. The final CSS makes the briefing span the flight deck. A seven-second held Down gesture subsequently reached the end in the full-width panel. [Corrected long briefing](screenshots/compact-reader-fixed.jpg).

Changed menu Confirm to physical Right shoulder / 5, Back to West / 2 and retained Menu / 9. Set menu axes to 2/3 with inverted vertical direction, retaining flight axes 0/1. The UI showed the remapped labels. Confirm, Back and Menu each returned from the reader to Read mission brief; holding exit gestures for 900–1,000ms did not start or resume. Scope remained ready and time stayed 0:00. Holding Confirm to enter also did not immediately exit.

Editing/applying stick draft values in the parent Lab cancelled reading through its focus transition before subsequent navigation. That attempt therefore does **not** verify stick scrolling within an active reader. Actual-router automated tests cover the remapped/inverted stick path. Keyboard Home/PageDown relinquished controller reading while retaining native focus on the text; disconnect ended reading without launching.

An actual pointer click on Done initially ended reading but lost its return focus because pointerdown disabled the button before click. The final implementation registers that specific exit button and preserves its normal click. Retested fresh frames: Done returned to Read details at 320×640, 844×390 and 844×501. A separate Sentinel full-brief test returned to Read mission brief. Other pointer/keyboard cancellation behavior remains separately tested.

## Layout checks and corrections

All dimensions below are the actual game iframe's reported CSS viewport, not assumed outer-browser resize requests. The outer viewport override did not consistently apply and was reset. Desktop preview was displayed at 70% scale; other listed frames at 100%.

| Game viewport | Observation                                                                                                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 320×640       | Full-width briefing, visible final paragraph and facts after held scrolling; ready title, 45% instruction and Start remain readable. Below-board controls can require page scrolling.  |
| 390×844       | Full-width briefing and two-column loadout; native text scrolling remains available.                                                                                                   |
| 844×390       | Ready title, instruction, reading controls and Start fit with the landscape controls.                                                                                                  |
| 844×501       | Initial ordinary board shrank excessively. Final minimum width prevents collapse; title, instruction and Start remain reachable, with outer-overlay/page scrolling for excess content. |
| 1280×720      | Full briefing and ordinary ready card remain usable in the desktop composition.                                                                                                        |

The ordinary board now has a 320px minimum above the short-landscape breakpoint, capped to its available column. Overlay text has a 90px minimum; controls and fonts were not reduced. Some long encounter cards require scrolling the outer overlay to expose the whole Start button. This is explicitly different from claiming every action is simultaneously visible at every size.

Final screenshots: [320×640](screenshots/overlay-compact-final.jpg), [844×390](screenshots/overlay-landscape-final.jpg), [844×501](screenshots/short-window-final.jpg). Earlier screenshots are retained as diagnosis, not final-layout evidence.

## Actual play and rewards

Used the main solo UI with Tap steering. A preliminary short keyboard press stopped on release and did not establish a live-cut preservation case; its later touch-driven clear produced 50.0%, 7,820 points, three lives and 0:28. Result reading retained the score. View picture hid the overlay and its reader controls, exposing the complete picture and Results action. [Picture view](screenshots/picture-after-reading.jpg).

Then tested genuine touch-driven live cuts in both steering policies. After about one second of Down movement, entering Read mission brief paused the run. The clock and three lives remained unchanged during reading. Done did not resume; explicit Resume followed by Down continued the line to a successful 0:03, 8,160-point clear with three lives. The Immediate HUD explicitly showed `LIVE LINE / EXPOSED` before reading and completed at 52.2%. [Paused live cut](screenshots/immediate-live-cut-paused.jpg). These are real UI attempts, without imported saves or direct simulation-state access.

Sentinel Relay was loaded in Lab with Fiber relay and Grid + buffer. Its ready text retained the 75% quota, two required relays and eight-new-cell opening/isolation condition. Both reading surfaces worked, with the correct Done return focus. [Encounter reader](screenshots/sentinel-reader.jpg). This source check does not claim a new boss win; deterministic routes and preserved replay compatibility are covered by the full source gates and prior frozen release evidence.

Frozen-candidate and offline observations, if completed, are recorded separately so they cannot be confused with these live-source checks.
