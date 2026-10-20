# Radio setup — automatic saving and manual mapping

## Delivered

- Complete stick mappings save automatically after 250 ms of editing inactivity and on closing setup. Guided calibration saves after its final measured stick position; switch setup cannot postpone it.
- Completed individual switch captures and partial six-switch layouts save immediately. Assignments still reject duplicate/overlapping channels. A complete stick profile and Flight assignment are required before activating the six-switch runtime.
- Removed the direction-verification checkbox, profile Verify/Save buttons, suggested-switch confirmation checkbox and the separate Use six-switch layout button. Done/Close only exit setup.
- Manual setup places the form beside the existing live two-stick visualization. Each control has a physical-direction prompt, live value/movement meter, Map this movement and Reverse. Channel/range/centre/dead-zone fields are inside optional details.
- Map this movement records a stable indicated endpoint and stable opposite endpoint, derives direction/range and saves the resulting complete valid profile. Other controls must stay still. Centre refinement and travel recording remain available.
- Incomplete edits are retained as bounded per-device drafts. Invalid drafts do not replace the usable saved calibration. Leaving an incomplete edit restores the last usable runtime calibration, with existing fresh-arm rules intact.
- Autosave may replace only its own preceding entry within this setup session. Original/imported profiles remain retained; dragging or stepping a setting does not add a new entry on every save.
- Unavailable browser storage reports session-only operation. Practice remains optional and never fires weapons. No changes to runtime arming, switch-edge, pause or reconnect policy.

## Inspection and limits

Browser inspection used the existing local Worlds entry and connected RaspberryPi Pico. A valid dead-zone edit persisted across closing/reopening without Save; the original active 0.02 value was restored. The manual view shows live sticks, values, compact cards and automatic-save feedback. No checkbox/Save gate is present. Syntax and whitespace checks pass.

Both Academy and Worlds packages were rebuilt under unchanged policies; see the receipt. No automated test suite was added or run. Physical full-range capture, six-switch assignment persistence, interrupted captures and real-phone ergonomics remain explicit hardware/qualification checks. The old tests that assert manual confirmation/Save UI need revised expectations during qualification; no fresh regression-pass claim is made.

## Releases integration

Separate follow-up from frozen #1799 (`8c063f1fb09a3f9736209324db272a8c0aca60e0`). Canonical changes are radio-guide.mjs, radio-setup.mjs, radio-profile.mjs and existing style.css. No new runtime module/file slots and no generated fullscreen/reaction module edits are required. Preserve current-main/core-SIM ownership when reconciling the parent overhaul.

## Evidence

- [Source hashes and inspection scope](evidence/fpv-combat/radio-autosave-delivery.json)
- [Manual setup capture](evidence/fpv-combat/radio-autosave-manual.png)
- [Academy/Worlds package measurement](evidence/fpv-combat/radio-autosave-package-measurement.json)
