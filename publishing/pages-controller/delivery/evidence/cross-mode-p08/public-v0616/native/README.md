# v0.61.6 delegated public native evidence

Route: https://mekhovov.github.io/revealline/releases/v0.61.6/site/game/couch/

Public version V0.61.6 was observed on the Solo landing page. Coordinator-provided release identity: source `4fd8e2dac4fdc851d0d2bf0b21e77162d9d405c9`, tree `d16edac0127fc96139445ae2365cc74499f80921`, publisher `159fe22a533048b6d22468a158f4c7cc7c527212`, deployment `6524513496`. Complete deployed-byte verification is the coordinator's separate evidence; this packet does not independently prove source SHA.

## Result

Seven primary layout cases were exercised with keyboard input, live DOM measurements and browser screenshots. Both boards preserve their intrinsic aspect ratio, stay centered inside their arenas and fit entirely in the viewport. `geometry-check.json` checks the actual observations, including both desktop retries. Canvas geometry:

| Map/text | Viewport | Each board CSS size |
|---|---|---|
| Wide Standard | 1280×720 | 618×309 |
| Wide Standard | 390×844 | 364×182 |
| Wide Standard | 844×390 | 400×200 |
| Wide Large | 390×844 | 364×182 |
| Wide Large | 844×390 | 400×200 |
| Classic Large | 844×390 | 296.9375×222.703125 |
| Classic Large | 390×844 | 364×273 |

Six mobile-size visual cases pass bounded full-board/focus-outline/HUD review. The desktop DOM geometry passes; desktop screenshot acceptance remains **inconclusive**: ordinary capture returned1258×720 despite1280×720 DOM, clipping the last9px of the second board; full-page and explicit1280×720 clip returned half-scale content with a right-edge band. These provider anomalies are retained in01,02,11 and must not be reported as a game clipping defect or clean desktop visual pass.

## Navigation and ordinary play

All public interactions used keyboard: Start, both players' movement, Pause, Settings tabs/selects, Back, explicit Resume, new-match confirmation, native map selection, lobby return and mode links. P1 and P2 continued moving independently after short direction taps. Live cut trails were observed; P1 suffered an ordinary loss (2lives, respawning/recovery caption) while P2 retained3lives. Both boards still fit.

Settings → Large → Escape restored the actual `race-options` opener and left the round paused at0:42. Return on Resume was required. Resizes and these menu transitions preserved the round. Deliberate New match discarded only the test attempt before selecting First Signal's4:3 map.

Direct Versus → Solo returned to Home with Start focused. A separate Home → Missions → expanded Mode → Couch Versus journey generated its return token. After a real Start/Pause and visible Solo action plus departure confirmation, the game restored Missions, the expanded Mode region, selected First Signal, and exact `shell-versus` opener focus. No BFCache claim: loading screen was observed on return.

Initial public preparation visibly announced loading and offered Cancel picture loading. The final public appearance was restored to Standard text. Browser viewport override was reset.

## Scope limits

No physical touch/controller, audio listening, offline, full match victory, all-content, BFCache, no-ResizeObserver fallback, or64-logical actor cap acceptance is claimed. Optional Always-touch layout was not exercised. Font readability and all-mode P08 remain separate qualification. No source, release, remote, solo progress or save manipulation was performed; only ordinary disposable Couch rounds and global text-size preference were used.

`observations.json` contains raw live DOM geometry, navigation AX state and screenshot references. Screenshot files are actualJPEG. `manifest.json` pins every packet file except itself. Failed capture attempts remain unchanged.
