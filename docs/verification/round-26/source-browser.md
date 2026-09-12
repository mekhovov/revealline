# Round 26 source browser checks

Recorded 12 September 2026 against the working v0.16.0 source UI. These are software-driven browser interactions with the actual game, its visible controls, and its first-party Playground and Controller Lab diagnostics. They are not human playtesting, physical controller or touchscreen tests, a native-device certification, or a frozen-release check. This report combines the browser operator’s observed journeys with the saved artifacts linked below; it does not infer successful browser actions from unit tests.

The source changed during these checks. Earlier failures and their captures remain available. The final course-entry save-hold correction was independently read-reviewed after the backup journey below; its final browser recheck, source gates, candidate checks and frozen-release checks were still pending when this report was written.

## Playable lessons

All three lessons completed through normal game input in Immediate steering. The compact Grid + buffer journey completed the first two lessons, recorded an initially mistimed third attempt, and then completed the third lesson after an actual retry. Values below are the displayed HUD values; the rounded time labels are not exact simulation durations.

| Steering / lesson                            | Revealed | Lives | HUD time | Score  | Observed outcome                                         |
| -------------------------------------------- | -------- | ----- | -------- | ------ | -------------------------------------------------------- |
| Immediate / Close a line                     | 52.2%    | 3     | 0:03     | 8,160  | Lesson complete; Next lesson offered                     |
| Immediate / Find the empty side              | 27.2%    | 3     | 0:08     | 4,750  | Lesson complete; relay 1/1                               |
| Immediate / Bring the picture home           | 76.1%    | 3     | 0:08     | 12,400 | Lesson complete; relay 1/1                               |
| Grid / Close a line, compact preview         | 52.2%    | 3     | 0:03     | 8,160  | Lesson complete; Next lesson offered                     |
| Grid / Find the empty side, compact preview  | 27.2%    | 3     | 0:08     | 4,750  | Lesson complete; relay 1/1                               |
| Grid / Bring the picture home, first attempt | 0.0%     | 2     | 0:06     | 0      | Self-crossing reported; this was not a lesson completion |
| Grid / Bring the picture home, retry         | 74.7%    | 3     | 0:30     | 12,180 | Lesson complete; relay 1/1                               |

Evidence: [Immediate lesson 1](../../../.cache/round-26/browser/lesson-1-immediate.txt), [lesson 2](../../../.cache/round-26/browser/lesson-2-immediate.txt), [lesson 3](../../../.cache/round-26/browser/lesson-3-immediate.txt); [Grid lesson 1](../../../.cache/round-26/browser/lesson-1-grid-compact.txt), [lesson 2](../../../.cache/round-26/browser/lesson-2-grid-compact.txt), [initial third attempt](../../../.cache/round-26/browser/lesson-3-grid-compact-initial-self-cross.txt), [third-lesson retry](../../../.cache/round-26/browser/lesson-3-grid-compact-retry.txt).

Ending the embedded course produced the inert “First Flight ended” state with instructions to use the parent page’s game link. It retained the completed picture and disabled the course selector/exit controls; it did not navigate the iframe into an ordinary award-bearing game. See [embedded course end](../../../.cache/round-26/browser/embedded-course-ended.txt). The older geometry JSON embedded in that text snapshot is a retained diagnostic capture, not a fresh measurement of the ended screen.

## Retained real flight and course isolation

The pre-entry normal-game profile contained one picture, one score and no mastery records. Its saved Relay Orchard flight was reconstructed at tick 163 with three lives, zero score and zero coverage; the recorded authoritative checkpoint was `41370d0fba3f49a6`. The [pre-entry evidence](../../../.cache/round-26/browser/before-course-evidence.json) identifies that setup and the exported files. The normal page initially reported the earlier v0.15.0 development build while the round’s implementation was being prepared; this is historical setup evidence, not a claim that the finished course shipped in that version.

The entry journey retained the real flight before opening the course. The normal profile export stayed byte-identical to its pre-entry export. The course isolation comparison deliberately starts with the **post-entry** backup, after the authorized retention operation, rather than claiming that entry itself performed no save:

- [Entry-retained backup](../../../.cache/round-26/browser/entry-retained.backup.json) and [after-course backup](../../../.cache/round-26/browser/after-course.backup.json) are both 6,070 bytes, with SHA-256 `8de5d4c83889ddf6cd3f91447d28980a9890df552db678083136db19997db005`.
- Their `library`, `packs` and `session` values are exactly equal, as recorded in [course-preservation.json](../../../.cache/round-26/browser/course-preservation.json). This is evidence for this tested visit; it is not an assertion about every storage or failure condition.
- [Before-course profile](../../../.cache/round-26/browser/before-course.player-library.json) and [entry-retained profile](../../../.cache/round-26/browser/entry-retained.player-library.json) are both 1,625 bytes with SHA-256 `fc146747c3b3d3fd2527b5900bd17b48381b000e94ce315eabb5b46f47e2e00a`.

On returning to the ordinary game, Load restored the retained flight paused at tick 163. Explicit Resume followed by Down advanced the actual flight to 52.2% revealed, relay 1/1 and score 8,660; the later paused HUD showed approximately 0:05 and three lives. This was a continuation of the retained flight, not a course award. See [resumed-flight snapshot](../../../.cache/round-26/browser/retained-flight-resumed.txt).

An independent final read review subsequently found that successful entry cleared `courseEntryHold` immediately before navigation. Page exit could consequently perform a second ordinary autosave after the checked retention write. The app now keeps that hold through navigation and its blur/pagehide callbacks; only explicit resume or a new attempt releases it. The code correction is present, but the backup/browser observations above predate its final recheck. They must not be presented as a browser test of that correction.

## Simulated controller journey

The Controller Lab exercised the real embedded course with a software pad. The operator observed a first-lesson win at 52.2% with three lives. Keeping Confirm held through Next left the second lesson at Ready, 0:00, zero score and zero coverage, with a release-controls prompt. The saved [held-Confirm snapshot](../../../.cache/round-26/browser/controller-held-next.txt) records that boundary and the first lesson’s completed-this-visit label.

The same journey changed the menu mapping to Confirm = physical East/button 1, Back = South/button 0, and Menu/resume = View or select/button 8. In flight, Right shoulder/button 5 switched controller Boost on; East/Stop switched it off. These are operator-observed actions with the configured mappings, not a claim that the Lab’s static default-layout caption changes its physical button numbers.

Read details entered the existing Mission details reader. Both Back and Confirm return paths were exercised without resuming: the HUD remained paused at 0:22. The saved [reader snapshot](../../../.cache/round-26/browser/controller-remap-reader.txt) shows Mission details focused, and the [return snapshot](../../../.cache/round-26/browser/controller-remap-reader-return.txt) shows Read details focused with “Reading ended.” Both show Controller Boost off. These snapshots also retain an earlier controller-disconnection caption while the Lab reports a joined, ready pad; they are not evidence that every status caption was fresh at capture time.

Two direct pointer clicks on Settings in the paused, active-course Lab did not open the dialog, with no errors observed for those attempts. Keyboard Enter on Settings did open it. Read review found no newly added interception of that button: the Settings click handler remains direct, while the preview bridge exchanges controller snapshots. The pointer anomaly remains unexplained; it is not attributed to the bridge, declared harmless, or counted as a successful pointer journey. No blanket clean-console claim is made for every source page.

## Layout measurements and fixes

Measurements came from the visible **Capture geometry** action in the Playground, not private iframe state inspection. They describe actual child CSS pixels and report requested size, actual viewport, display scale, scroll position and pointer media. The captured browser reported fine pointer/hover and DPR 2; resizing did not establish coarse input, touch comfort, zoom behavior or hardware safe areas. All rows below had eleven targets at least 44×44, no target/arena rectangle overlaps, and no horizontal page overflow. Rectangle checks do not prove absence of pointer occlusion or glyph clipping.

The [initial compact capture](../../../.cache/round-26/browser/initial-compact-geometry.json) and [screenshot](../../../.cache/round-26/browser/initial-compact.jpg) exposed a real problem: the full course panel sat between the board and controls. At 320×640, the board occupied y175–385 while the flight group began around y826, leaving every flight action offscreen. The panel was moved below the controls; one concise task remained above the board. Course-only board-height reserves then addressed the landscape board cutoff and desktop controls below the fold seen in the [intermediate matrix](../../../.cache/round-26/browser/course-geometry.json).

The [final-course matrix](../../../.cache/round-26/browser/final-course-geometry.json) records the next state, including the still-failing 844×501 case. Its later correction is recorded separately and must not be retroactively read into that matrix:

| Actual viewport                      | Board top–bottom | Whole-board / controls result                                                                              |
| ------------------------------------ | ---------------- | ---------------------------------------------------------------------------------------------------------- |
| 320×640                              | 214.19–424.19    | Whole board and eight direction/action targets visible; Pause, Restart and Sound extend below the viewport |
| 390×844                              | 192.99–461.49    | Whole board and all eleven controls visible                                                                |
| 844×390                              | 131.99–346.98    | Whole board and all eleven controls visible after the course height reserve                                |
| 1280×720                             | 183.80–493.79    | Whole board and all eleven controls visible after the course height reserve                                |
| 844×501, before rail extension       | 200.59–440.59    | Whole board visible; all eleven control rectangles extend beyond the viewport                              |
| 844×501, separate final rail capture | 183.80–439.79    | Whole board and all eleven controls visible                                                                |

The last row is [short-course-rail-geometry.json](../../../.cache/round-26/browser/short-course-rail-geometry.json). It follows the course-only rail extension through 600px height; ordinary-game breakpoints were preserved. The earlier 1065×912 window measurement is available in the intermediate matrix, but was not repeated in the final matrix.

An explicit compact Start was separately checked after adding course board alignment. In [compact-launch-before-movement.json](../../../.cache/round-26/browser/compact-launch-before-movement.json), the 320×640 board occupied y133.19–343.19 and all eleven controls were inside the viewport. Later locator-based Down/Stop clicks followed by parent Capture geometry produced y−3.81–206.19, clipping about four pixels from the board’s top while all controls remained visible. Both [the first follow-up](../../../.cache/round-26/browser/compact-explicit-launch-geometry.json) and [the capture after adding a 12px scroll margin](../../../.cache/round-26/browser/compact-launch-margin-geometry.json) preserve that result. The margin did not establish a resolution. The evidence does not identify text reflow, scroll anchoring, locator scrolling or another mechanism as the cause, and does not prove that every interaction keeps the whole board visible.

## Remaining verification boundary

The successful lesson, retention and controller observations establish the specific journeys above. The [six-gate report](source-gates.md) and [landing-label follow-up](source-label-followup.md) record their own final source identities. Physical controllers, genuine coarse touch, text zoom and the two unresolved interaction observations remain outside the successful claims here.

## Subsequent final-source observations

The final navigation save-hold was rechecked through the ordinary saved-flight/Help/course entry. After one course win, Next and Skip opened the third lesson at Ready with lesson two explicitly marked skipped. Return then produced a public backup with exactly unchanged library, packs and session against the new post-entry baseline. [Comparison](../../../.cache/round-26/browser/final-entry-preservation.json): the retained ordinary run is still `36ceb7dc-1b4f-417c-9bc1-8a77f40393fe`, tick 670, checkpoint `5f9c0c634ad18460`, 52.17% coverage, saved at `2026-09-12T15:06:56.913Z`. [Baseline backup](../../../.cache/round-26/browser/final-entry-baseline.backup.json) and [post-course backup](../../../.cache/round-26/browser/final-entry-after-course.backup.json) preserve the actual exported data.

A direct course page opened Settings by pointer click successfully; its [visible dialog](../../../.cache/round-26/browser/final-direct-settings.txt) does not explain the earlier Controller Lab anomaly. [Collected source-page logs](../../../.cache/round-26/browser/source-console.json) are empty for all four recorded pages.

After an explicit Resume, Down/Stop and a 600ms settling interval, [compact-play-settled-geometry.json](../../../.cache/round-26/browser/compact-play-settled-geometry.json) still places the board at approximately −3.74–206.26px with all eleven controls visible. The earlier clipping observation remains a limitation. The [settled desktop screenshot](screenshots/first-flight-settled-view.jpg) shows the whole board and controls after ordinary Home scrolling. Other screenshots in that directory preserve full-page or intermediate scrolling states; they are visual records, not substitute viewport measurements.

[Candidate checks](candidate-browser.md) separately exercise packaged ordinary play, course completion, collection preservation and the corrected landing.
