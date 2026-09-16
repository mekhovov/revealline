# P03 source-browser observations — 16 September 2026

These are the root reviewer's observations of actual CUA browser actions in this task, not an independently recorded automated browser suite. The temporary page served the working source at HEAD `beb0140eff7315b63269ee78ded07155de3e7084`, including the measured fpv25 source-stage production and strict Team binding. It was not v0.59.0 or a public release. `admission-receipt.json`, the admitted original hashes and the final HTTP audit define the actual served bytes.

## Observed journeys

1. **Solo settings:** keyboard navigation from Start opened Settings. Escape returned to the originating Settings action. Master/audio controls, the paused soundtrack and the native focus ring were visible.
2. **Actual Solo win:** a Down command on First Signal produced a cut and a real win at 50% recorded coverage, three lives, 7,820 points and about 17.92 seconds. No state was injected. Results focused Next; keyboard View picture showed the whole original while retaining the actual coverage result.
3. **Collection:** Results → Main menu → Collection exposed the earned First Signal card. Opening and closing its nested picture viewer restored that exact card. Collection → Flight records showed the actual score. Saves & loads was keyboard-reachable; closing Library restored Flight records, then closing Collection restored its title-menu origin. No backup round-trip was performed in this pass.
4. **Team entry:** the keyboard mode link loaded Relay Yard, visibly prepared its exact picture and required Start together as a separate action. Start and immediate Pause left both players on safe ground with three reserves and 0.0% coverage.
5. **Team reading:** Help → Read controls focused the reading region, enabled Done reading and displayed the keyboard scrolling instructions. Arrow keys scrolled the region. Escape ended reading and focused Read controls; another Escape closed Help and focused its summary; another focused Resume. None of these Back actions resumed the game. Explicit Resume focused the arena and allowed its clock to advance.
6. **Team Options:** keyboard activation exposed text, palette, ornaments, touch, reduced-effects and shared master controls. The note stated that this chapter currently uses visual feedback. Native Space/Down/Enter changed Theme font to Plain. Escape closed Options and retained pause.
7. **Team departure:** keyboard Versus opened a confirmation with Stay initially focused. Stay retained the paused attempt and restored the Versus link. A second explicit confirmation discarded only this test attempt and reached the Versus lobby.
8. **Versus Help:** keyboard Help → Read controls focused the reading region. Escape ended reading; another Escape returned to the How to play action in the lobby. The same sequence worked from a paused round without resuming it.
9. **Shared preference:** Versus Options showed Plain selected after the Team change. Shared master remained muted at 0.65. This verifies the observed preference handoff, not audible output.
10. **Versus setup:** native keyboard selection changed the round duration to 30 seconds. Start focused the first board. Escape paused both boards. Help, reading and Back did not consume the paused clock; explicit Resume returned at 0:25 after the earlier five seconds of play.
11. **Actual Versus timeout:** the round ended as a draw with both players at 0.0%, three lives and zero points. Results focused Next round. View both boards and Return to results were keyboard-accessible. Next showed picture preparation and Cancel, then started a new round with both original boards. Slow/cancel/error branches remain covered separately by the retained host tests; this native pass exercised successful preparation.
12. **Versus departure:** leaving an active paused match required an explicit confirmation; its default was Stay. Confirming the disposable test attempt returned to the Solo title.
13. **Solo live-cut pause:** a short Down command followed by Escape paused First Signal at 0:06. Mission brief → Read → Back returned to the pause actions with the same clock. Explicit Resume focused the live exposed line. A later title visit had Start rather than Continue; this observation alone was not used as proof of a preserved live continuation.
14. **Chapter and setup:** keyboard chapter selection installed Pressure Lines and restored focus to its selected card when ready. All visible flight setup fields were reachable, including native selection of Grid + buffer. Deploy opened Orchard Crossing with the direction-only Arcade control description and capture-stop instructions.
15. **Actual continuation:** Down, Right and Escape paused Orchard Crossing at 2:48. Main menu exposed Continue · Orchard Crossing. Explicit Continue resumed the live line at 2:47; it did not require a second Resume action. A later Pause showed two lives and the line-caught explanation. The exact off-center queued-turn state is not observable through this DOM and is covered by separate simulation/input tests.

## Responsive observations

The normal browser viewport was 1280×720 with DPR 2. Overrides were 390×844 and 844×390; these are desktop-browser viewport tests, not phone or Steam Deck certification.

- Team reader at 390×844: pause panel top/bottom 12/832; reader 509.38/830.10, client height 321 and scroll height 841. Enabled Done was 408.79–452.79 and the hint 460.79–501.38. The active reading unit fit within the panel.
- After two Down presses, Team reader scrollTop was 96. At 844×390, panel 12–378, reader 227.69–375.88 (client 148, scroll height 486), Done 147.39–191.39 and hint 199.39–219.69. Focus and reading state survived resize; the paused clock remained 0:00.
- Versus reading at 844×390 kept Done, the instruction and focused scroll region visible. Both full race arenas were visible together in the same landscape viewport. Plain text and distinct yellow/cyan player labels were readable in the inspected view; this does not close the complete actor-scale audit.

## Evidence boundaries and unfinished checks

- Screenshots at key states were emitted and visually inspected in the CUA conversation. No local screenshot artifacts were produced. The browser's `content.export()` operation returned unsupported. This Markdown is a reviewer observation log, not raw image evidence or a replacement for retained public-release captures.
- A read-only `document.hasFocus()` query was unsupported by the browser facade. Creating a hidden about:blank tab did not trigger an observable focus-loss event. Neither is a passed or failed product focus-return test.
- The computer-use tool denied access to the Codex native app for safety reasons. No alternate OS automation was used. Native foreground-switch verification remains open; automated Team inactivity regressions are separate evidence.
- No physical controller, physical touch, audible listening, browser offline recovery, public deployment, full Studio journey or full P03 acceptance is claimed.
- The final Solo console inspection returned no captured error/warning entries. The HTTP inventory audit is separate and must account for every request, including source-only missing build-info and favicon requests.
- The temporary tab was closed, viewport reset, browser hidden, and owned server PID 76119 terminated after inspection. User tabs and working files were not changed by cleanup.

## Release status

These observations support the scoped cross-mode navigation changes. P03 remains **In progress** until its complete required input and public-release gates pass. A feature release must retain this distinction, the failed development attempts, and the physical-device and native-focus limitations.
