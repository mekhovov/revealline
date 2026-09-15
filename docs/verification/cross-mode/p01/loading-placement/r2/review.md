# Native r2 Library candidate — focus obstruction confirmed

**r2 is not ready for acceptance.** Native Large/Plain/Reduced at844×390 exposes a focused Export game data button completely behind the sticky terminal rail. Source was the actual uncommitted r2 application on9ef7509 served by the existing game-cli; the four runtime hashes stayed unchanged throughout this owned run.

The actual native before-action dialog scrollTop was336. After the export and after explicitly refocusing Export game data, it was548. Rail bounds: y33.75–225.75. Focused button: y171.421875–218.421875 (47px). Native center hit testing returned a status SPAN rather than the button. Screenshot09 and its JSON show the hidden focused button outline. No CSS/DOM or application-state patch was used.

A dedicated non-overlapping scroll-body rewrite is not required by these measurements:164.25px remains below the rail, enough for the47px button. With an8px gap, reducing dialog scrollTop to485.671875 would place the focused button at y233.75–280.75. Root’s proposed measured scroll-padding and minimum focused-control visibility adjustment is a bounded next trial; it must preserve owner/focus and skip disabled, hidden and inside-rail elements. Native retest still determines whether it succeeds.

Status and generic Cancel/Stop were visible together during real read/verify/download phases in all four Standard/Large × portrait/landscape operation cells. Four native downloads completed (799,799,795,795bytes), with each true original retained before the next download. The operations lasted roughly140ms. Original screenshots are before/terminal; phase visibility is native DOM/geometry observation, not a claim each short state painted a captured frame.

Large terminal labels exceed the40dvh region: landscape165px content versus156px area; portrait363px versus338px. The region was named “Library operation details” in the native accessibility snapshot and Tab could leave it. One PageDown observation still showed scrollTop0, so full keyboard reading is **not passed**. No actual200% browser-zoom substitute was used.

Files05/06 are retained failed navigation attempts showing Settings/Game data, not Library or export evidence. The driver reported a completed click without opening the offscreen destination; fresh focus+Enter opened Library for07/08. Misnamed03-export-large-landscape-original.json is a duplicate of the previous download copied after that failed navigation, excluded as a new export. Actual native escape returned to Settings;15 proves reopening cleared the old rail and restored save-status.14, captured immediately after close, had no Library geometry but still showed the prior parked host, so immediate close restoration is not claimed.

The confirmed blocker ended this bounded run. Native Cancel consumption, saved-attempt count/focus, deep Packs/transfer, five-file readiness focus and actual200% zoom remain for the corrected candidate. No physical-device or release acceptance claim is made.

Owned Chrome83720 and observer84565 exited0; CDP51123 is closed. Owned server83575 was terminated after browser closure (exit143), port51122 closed. Capacity remained above512MiB projected reserve; profile/cache is excluded from evidence. No source, Git, build or release change was made by this agent.
