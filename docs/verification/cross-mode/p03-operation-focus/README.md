# P03 completed-operation focus correction

Night Shift chapter selection and Library Fieldcraft installation disabled their focused buttons and left focus on BODY after completing. The correction keeps a disposable focus lease for the initiating control and restores it only if no newer focus, dialog or foreground decision has taken ownership. Explicit Library Cancel captures its own fresh intent before abort; it does not resurrect an automatic lease retired by navigation.

The base is `3acce1941116d18f9e86dcfa26dea463433cd3b2` / tree `d85af7e5d33100575317078aeba8df57d74fe2d5`. Three production modules change: the new operation-focus helper and its chapter/Library adapters. App, core, saves and schemas are unchanged. [The maintenance contract](../../../operation-focus.md) describes same-dialog ownership and the disconnected-row limitation.

## Source and tests

Final held 04 is `5c148a996220a0b8ee0379ff8599f42d01aad23176e38f6b4a090160ed2df27f`. Root and Dewey independently reviewed its source. Final verification `733dc7fd2f9407d66557f9bf07b6ca10c9abddb9c5d013c9c0b2470a3007d818` records **188/188** on each Node 22.22.2 and Node 20.19.5, in seven complete files, with zero failures, skips or cancellations. All 280 materialized game inputs remain unchanged (15,533,081 bytes). Lint, formatting and whitespace checks pass. The complete files are coop-host, title-operation-status-host, operation-focus-host, mission-picker, mission-replacement-host, library-launch-host and modal-navigation.

The new 27-case host file uses actual app/Library/pack handlers with a finite native-disable event model. It covers completion/error, actual three-Tab Cancel, newer focus followed by BODY, true window blur, hidden/return, pagehide, close/reopen, another dialog, body keyboard intent and reentrant cleanup. Fresh Cancel restoration refuses a foreign-root opener; background, root close, newer cleanup focus and detached durable commits retain their authority. These 27 are included in 188; earlier counts are not added.

Two fixture-only corrections retain approved current behavior: three exact fixed Solo Team links cover header, Title and Missions; Title asserts its named Start action and induces a real download error through explicit Missions chapter selection. Their separate 76-per-runtime receipt is historical input, not additional final coverage.

## Native observations

Root exercised exact three-module overlays over base 3acce. Complete six-path HTTP verification before and after agrees with the source; root also independently checked all three module bodies. Final held 04 has **nine desktop keyboard observations and three original PNGs**, at 1309×1348 on one origin:

- Event 3: three Tabs reach actual Cancel operation; keyboard activation restores Install fieldcraft.
- Event 5: during a new install, deliberate Tab chooses Paste pack JSON; successful completion keeps summary focus.
- Event 7: ordinary Library completion restores the connected Install fieldcraft button.
- Event 9: Night Shift completes with its selected current chapter button focused.

Only the original 15,204-byte Fieldcraft JSON HTTP response waits six seconds. Other files are exact base Git blobs or the three pinned modules; no game state or game-clock fixture is injected. Final native receipt is `1845b0e97446070e1099aa23db441d8fb8225bf73eb076b7b444ab36098f42ea`.

The first candidate's four events/two PNGs show both completion failures. Its chapter screenshot and initial label prematurely suggest success; event 3 corrects them. Captured descendant element blur had been mistaken for losing window focus. The successor filters the actual Window target and models that event path.

Held 03’s 14 events/four PNGs preserve ordinary completion and no-steal positives **plus the later explicit Cancel failure** at 13–14. Event 4 reached Settings without changing it. Events 10–11 reached Close Library, not operation Cancel; 12 corrects their intent labels. The earlier 12-event receipt remains byte-exact and superseded. Its first 12 event bytes are explicitly reconstructed from the final 14 records only after matching the already recorded 65,676-byte size and SHA256. Final held 04 fixes the separately reproduced Cancel failure with a fresh same-dialog intent captured from the actual focused Cancel control.

## Preserved diagnostics and evidence layout

[evidence.json](evidence.json) maps every exact decoded member of [evidence.zip](evidence.zip) to its original local source and SHA256. Logs, receipts, event records and images are not normalized. Original relative paths inside historical receipts remain provenance; the ZIP mapping supplies retained locations. All 20 pinned inputs of the prior combined diagnostic are retained. Runtime paths named by those historical input inventories remain their exact Git/source authority, not duplicate full source or asset trees in this ZIP.

The original 34-file combined Node22 run remains **737/740**, with three obsolete expectations; Node20 did not run. The first corrective 182 pair passed source tests but failed native completion. Held 03’s 182 pair then passed source tests and ordinary native checks, but failed the later real Cancel journey. The strengthened three-Tab test reproduces 26/27 on held 03 and 27/27 on held 04. Other fixture/model errors, the explicitly interrupted partial run and exact predecessor source bodies remain preserved. Final qualification is the held 04 **188-per-runtime pair and nine scoped native observations**, without adding previous counts.

The correction covers connected initiating chapter/Install controls. Library refresh can remove row controls such as Remove from device; the helper refuses disconnected targets and adds no resulting-row fallback. This package does not close every Library focus journey, P03, P05/P08, responsive/zoom, physical input, full hosted, public or offline acceptance. The final composed source requires the 35-file union (original 34 plus operation-focus-host), followed by its separate delivery gates.
