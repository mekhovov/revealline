# Round 23 source browser checks

Checked 12 September 2026 at isolated source port 8824. These observations use the actual solo game and Controller Lab through their visible controls in one desktop browser. The Lab's virtual controller sends physical button indices through its existing transport; it does not certify physical hardware. The persistent workspace server on 8767 and player release data were untouched.

## Input and lifecycle

- In Lab, changing Solo controller Boost to Toggle reported **Session only**. A fresh ordinary solo page still showed default Hold. In Hold gesture mode, holding button 5 for 900 ms toggled once; release kept Boost on. Another fresh held press turned it off once. The controller-specific cue and aggregate Boost button agreed.
- Native Stop, Menu pause, full-brief reading, hangar entry and disconnect each cleared the toggle. Leaving a reader or hangar did not resume flight. Reconnecting and consuming the first face-button join gesture left scope **paused**; only an explicit later Menu press resumed, with Boost off.
- Remapped flight Boost from right shoulder / 5 to left shoulder / 4. Old button 5 no longer toggled. Button 4 did, including a 900 ms hold, and the cue named Left shoulder. A real Grid + buffer First Signal cut completed at **52.2%, three lives, 8,160 points and 0:06**; the terminal state cleared Boost and awarded no campaign progress in Practice.
- A separate actual Immediate boosted First Signal cut completed at **50.0%, three lives, 7,820 points and 3:06** after the earlier stationary lifecycle work. This is its observed result, not the Grid result or a speed benchmark. Its terminal cue was off.
- With Tap steering enabled, the visible Boost button activated the local latch. A controller press turned its separate contribution on; a second controller press turned that contribution off while the aggregate button remained pressed. Native Stop cleared both. Keyboard-hold composition is covered by the real input/recovery unit harness, not claimed as a sustained browser keyboard gesture here.
- In both Immediate and Grid + buffer, a real 600 ms Down cut followed by a 600 ms Up reversal crossed the existing trail. Lives changed from three to two, the UI reported “Your line crossed itself. Choose a new route.” and Controller Boost turned off. The Grid run then disconnected, rejoined while still paused and resumed explicitly. Shield, impact and a recovery ending within the same render frame are exercised by the legal simulation/input tests; they are not presented as manual browser cases.

## Save and import

The ordinary solo page saved Toggle with **Saved on this device** and retained it after reload. Exported a complete player library and a full backup through Library & saves, reading only the displayed JSON. The originals are retained locally at `.cache/round-23/browser/toggle-library.json` and `toggle-backup.json`.

After deliberately selecting Hold, importing that player library restored Toggle; **Undo last library import** restored Hold. Importing the complete backup separately restored Toggle; its own complete-backup Undo restored Hold. These were normal UI import paths, not storage writes or hidden runtime calls. No QA scores or campaign pictures existed in these exported profiles.

## Layout correction and limits

The initial desktop screenshot placed the new cue below the controls, beyond the visible frame. Moved its normal-flow element immediately after the flight-status line, before encounter/appearance notices and controls. No simulation behavior changed. The final screenshots were captured after that correction:

| Requested and reported game viewport | Evidence | Observation |
| --- | --- | --- |
| 320 × 640 | [Compact](screenshots/compact-boost-cue.jpg) | Complete board, cue and main controls visible in the scrolled game view. Cue wraps safely and remains separate from controls. |
| 390 × 844 | [Phone](screenshots/phone-boost-cue.jpg) | Cue and controls readable below the board; the desktop screenshot crops part of the taller outer preview. |
| 844 × 390 | [Landscape](screenshots/landscape-boost-cue.jpg) | Board, cue and side controls visible together in the scrolled game view. |
| 844 × 501 | [Short window](screenshots/short-window-boost-cue.jpg) | Cue and controls readable; showing them requires vertical scrolling that crops the board's top. |
| 1280 × 720 | [Desktop](screenshots/desktop-boost-cue-final.jpg) | Cue visible at 70% preview display scale; this capture is scrolled and does not establish a whole-board/no-scroll fit. |

The Lab reports actual iframe dimensions, independently of its display scale. The cue was brought into view through an ordinary click, which may scroll the frame. These are layout observations in one browser, not physical phone, touch-comfort or safe-area certification. The earlier [remapped Grid screenshot](screenshots/grid-remapped-boost-on.jpg) is deliberately preserved as pre-correction evidence.

Error and warning logs were empty for both solo and Lab after these checks. The first full source run separately found two historical whole-profile assertions affected by the newly added default preference; their original fixtures remain untouched and the explicit owned-comparison corrections are described in [initial gate evidence](source-gates-initial.md). Final gates and frozen-artifact checks are separate records.

## Final cue-context correction

Independent review found that the off cue still offered a flight-button action in menus, where the same physical button could mean Confirm or Back. The final helper shows the action instruction only for a joined controller in running flight; elsewhere Toggle retains a plain “Controller Boost off” status. A new unit case covers this change. Browser recheck confirmed status-only text in unjoined Ready, joined Ready and Pause, the mapped instruction in flight, and Boost off after another real Grid trail collision. Logs remained empty. The 1,405-test pass preceding this correction is preserved as intermediate evidence; final validation includes the extra case. The earlier screenshots above show layout and active-flight text, which this correction does not change.
