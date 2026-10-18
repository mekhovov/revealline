# SIM completion plan — current priorities

Reviewed 18 October 2026 against main
`bbd56e6fcd8f20113ccb168660d5e05d0781e1e3`. This is the current execution
index for the accepted rates, aircraft and Setup Workbench plans. Older dated
receipts retain their original source and test scope. This review does not reopen
unrelated world-expansion or demonstration-authoring projects.

## Completion rule

Finish reproducible software defects and their release checks first. Record
implementation, automated qualification, interactive checks and publication
separately. Never mark a physical measurement or an unavailable device as passed
because a software test passed. The user has made missing radios, flight logs
and pilot feedback nonblocking; those remain explicit later qualification work.

## Delivered and retained

| Accepted area            | Current status and evidence                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rates and transfer       | Legacy plus Actual, Betaflight, Quick, KISS and Raceflight; versioned throttle, named profiles, per-setup assignments, CLI/preset review and native transfer. [Completion record](fpv-tuning-completion-plan.md).                                                                                                                                                                                       |
| Aircraft                 | Thirteen civilian catalog presets, component accounting, individual numerical configurations, dimensions and visualizations, editable battery/camera payloads, starter or retained rates. [Original twelve](fpv-aircraft-presets.md), [Mobula8 addition and source limits](fpv-civilian-kits.md).                                                                                                       |
| Practice and recording   | Aircraft-aware Academy, World, learning and Regional practice; unrestricted flight, bounded recent clips, recovery, persistent segmented archives and bounded ghosts. Storage failure does not stop flying. [Implementation](fpv-aircraft-completion.md), [archives](fpv-aircraft-archives.md).                                                                                                         |
| Optional endurance       | Depletion remains off by default. Explicit battery/timed challenges preserve ordinary continuous practice. [Battery](fpv-aircraft-endurance.md), [challenges](fpv-aircraft-challenges.md).                                                                                                                                                                                                              |
| Workbench                | Basic/Expert views of one draft, search, visual rates/throttle/camera controls, shared-profile ownership, undo, import review, calibration/test return and complete setup saves. [Workbench record](fpv-setup-workbench.md).                                                                                                                                                                            |
| Controller tools         | Independent reusable-tune storage; frozen manual A/B conditions; isolated simulation-bench worker with physics-step metrics; bounded one-gain assistant with separate validation and explicit application. These assess the SIM model.                                                                                                                                                                  |
| Flight regression repair | Regional headings, dense collision frames, pause/prefetch coordination, exact terrain recovery and paused-browser-stall recovery corrected. Learning reference demos cannot silently take over selected-aircraft practice. [Flight audit](fpv-all-aircraft-flight-audit.md), PRs [1577](https://github.com/mekhovov/revealline/pull/1577) and [1580](https://github.com/mekhovov/revealline/pull/1580). |

The final `4f68b924ee74` public flight check exercised all thirteen aircraft in
Acro and Self-level: 26 brief keyboard takeoff/steering flights. The automated
audit includes 5,616 startup combinations and 728 short flight/configuration
checks. Mass, rates and PID changes alter actual solver behavior across hosts.
These counts are not completed missions or measured real-aircraft fidelity.
PR #1580 finished with 1,175 flight tests and 1,756 broader checks passing,
successful builds/uploads and exact-source GitHub Pages verification.

## Immediate work

| Priority | Item                                                                                             | State                                          | Acceptance                                                                                                                                                                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P1       | Avoid empty session archives when browsing aircraft, changing maps or restarting without flying. | Implemented; focused and browser checks passed | No persistent archive before accepted flight progress; restored checkpoint origins handled correctly; short flown sessions can still be finished and verified; quota failures cannot affect motion.                                                          |
| P2       | Correct workbench status after a saved setup becomes the active flight.                          | Implemented; focused and browser checks passed | Dirty/invalid edits say Draft; a different frozen attempt says Saved for next flight; the matching current attempt says Used by this flight, including after Apply & restart.                                                                                |
| P2       | Complete direct rate-curve inspection.                                                           | Implemented; focused and browser checks passed | Pointer/touch inspection has a selected-stick marker and saved/draft readout; existing numeric/slider controls remain keyboard-accessible alternatives. No rate evaluator or flight-control change.                                                          |
| P1       | Qualify and publish these corrections.                                                           | Ready for hosted checks and publication        | Focused regressions fail on old behavior and pass on the correction; independent review; actual UI flows; exact-main hosted checks and normal Pages publication. Preserve physics constants, timing, historical identities and unrelated local changes.      |
| P2       | Actual browser-zoom accessibility observation.                                                   | Open, tool/platform dependent                  | Verify 200% browser zoom through the browser's actual controls, reach numeric fields and actions without obscured focus, then restore zoom. Prior 640 × 360 CSS viewport evidence is retained but is not browser-zoom evidence.                              |
| P3       | Remove ten temporary live-test archives from 18 October, 05:13–05:50 UTC.                        | Awaiting the existing deletion confirmation    | Delete only the ten identified test archives, preserve the six older archives and all settings, then verify the list. Irreversible browser deletion requires action-time confirmation. Do not delete anything automatically to create a passing quota check. |

The archive defect was identified from the previous live-test result: preparing
practice allocated an empty manifest before the first accepted simulation tick.
Cycling sixteen unflown sessions could consume every archive slot. The fix must
prevent new empty entries, not silently remove existing records or raise limits.

Successful archive refresh now reports completion in English/Ukrainian instead
of retaining “Preparing…”. Reopening the workbench clears an obsolete save-success
notice while preserving errors and import information.

The workbench defect is a sticky saved-state flag taking precedence over the
current flight's immutable configuration. Fix the status derivation rather than
changing or restarting the active flight to make the label agree.

## Current correction evidence

- Archive controls, actual Academy/Regional sessions, storage and replay checks:
  **35/35 passed**. An unsealed one-tick flight still finishes and independently
  verifies from reset. Recovered history retains checkpoint-only verification.
- Draft/header, curve inspection, libraries, hosts, bench and assistant checks:
  **213/213 passed**. The new workflow/cursor regressions fail against the old
  source for the intended behavior. Independent review found no blocking issue.
- Isolated browser served the exact main revision above with only the three
  corrected modules overlaid. Preparing a Meteor75 Test draft kept the existing
  archive count unchanged and displayed Ready to archive when flight begins. A
  subsequent 7.16-second session finished and independently verified from reset.
- Browser rate-graph inspection changed the selected stick position without
  changing configuration. The exact keyboard field at 50% showed saved Roll
  145.7°/s and draft Roll 184.0°/s after an explicit 600→800°/s maximum-rate edit.
  The active setup header correctly reported Used by this flight after restart.
- Browser zoom remains unverified: the selected browser automation exposes no
  actual page-zoom control. Existing narrow-viewport checks remain separate.
- Full hosted integration and public delivery are tracked independently below;
  these local results do not claim a deployed release. No stored archive was deleted.

## Later qualification and promotion

| Priority | Remaining item                                                                      | Required evidence / disposition                                                                                                                                                                                                                                 |
| -------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2       | Measured propulsion, motor transients, inertia, directional drag and electrical fit | Identified motor/propeller/ESC/voltage/flow conditions and sufficient bench or flight observations. Current coefficients retain their estimate labels. Partial static points cannot establish a complete dynamic map. Continue when suitable data is available. |
| P2       | Physical radio, touch and experienced-pilot comparisons                             | Actual devices and repeated documented maneuvers. Deferred by the user; simulator input fixtures and keyboard tests do not substitute.                                                                                                                          |
| P2       | Wider architectures, low-end hardware and iOS runtime                               | Run replay, lifecycle, storage, contact and capacity checks on the real targets. Existing browser and Electron receipts apply only to their recorded environments.                                                                                              |
| P3       | Measured propwash and ground effect                                                 | A qualified base aircraft plus effect-specific measurements; no arbitrary coefficients or generic realism controls to close this row.                                                                                                                           |
| P3       | Scored Advanced classes and broader default promotion                               | Close the relevant physical/platform/comparison gates before promotion. Verified practice archives remain unscored. Preserve historical competition rules.                                                                                                      |

The broader source-kit catalog and spreadsheet are not represented as fully
implemented. The existing civilian-source record explicitly excludes
military-specific configurations and preserves unresolved component/weight
ambiguities for other civilian candidates. This continuation does not derive
military operational models or invent specifications to fill those rows.

## Review cadence and scope control

Update each row after implementation, qualification and publication. Reopen work
for a demonstrated defect or failed acceptance criterion, not merely because a
previous review ended. Keep the original failed observations with the successful
regression evidence. Once the immediate software rows are closed, unavailable
measurements and action-time deletion approval remain honestly open; they are not
a reason to create unrequested features or repeat already-passed tests.

The shared checkout contains unrelated unfinished demo work. Local free space is
below the existing 3 GiB heavy-work floor. Use small focused edits and hosted full
builds; preserve unrelated sources, generated files, archives and player storage.
