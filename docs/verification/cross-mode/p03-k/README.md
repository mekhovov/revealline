# P03-K — deliberate training lesson selection

Source candidate based on `f61a249277944a5fdd50cf7d545cbb18dbd0eaf8`. P03 remains implementing. This is an internal work package, not an independently accepted phase or public release.

The visible First Flight lesson selector now uses the existing fresh-attempt decision. Releasing movement still retains direction during a cut. Choosing another lesson pauses the current attempt and restores the displayed active lesson while Stay or Prepare is chosen. Stay, Escape and controller Back retain the exact run and queued turn; Prepare explicitly discards only the practice attempt, opens the new lesson at Ready and focuses Start. No profile, suspended-flight or achievement data is written. Choosing the same lesson is inert. Clearly named Skip and Return remain direct when no decision is open; they cannot bypass an open decision. This does not change course recipes, collision, scoring, historical recordings, normal save loading or Restart.

## Verification

- [Exact source and test execution](execution.json): seven complete files, **106/106** on Node 22.22.2 and **106/106** on Node 20.19.5, with zero failure, skip or cancellation. Source hashes remained unchanged across both processes. These overlapping suite counts are not added to prior navigation totals.
- The new 13 host tests exercise real course and simulation behavior under modeled DOM/Phaser boundaries: both steering policies, live cuts, a queued grid turn, Stay/Escape/simulated controller Back, repeated choice, explicit Prepare, held Enter, same-option no-op, Ready and invalid choices, Skip/Return ownership and page-departure invalidation. Existing course entry/view/pause, starting-setup, mission-replacement and mode-return tests also pass.
- [Native receipt](native-root-verification.json): 13 desktop keyboard observations with two visually inspected screenshots. The route starts at the real title, uses Workshop → How to play → Learn by playing, then actual Start/Down/Pause, native lesson selection, Stay/Escape, Prepare, fresh Start, Skip and Return. Actual paused selector Tab order is retained. No app state or storage was injected.
- Runtime source was HTTP-verified against the held app and the separately reviewed compact-dialog CSS. Native source base is the exact commit above; this is not the integrated J Restart source or the public deployment.
- Lint, formatting and whitespace checks passed. [Artifact inventory](inventory.json) records exact copied bytes and hashes.

The [initial focused run](initial-node22.log) passed 12/13. Its one failure attempted to read a nonexistent test-harness `location.assigned` array. The successor installs a spy at the actual `location.assign` browser boundary, verifies no departure while the decision owns the course, and verifies the real Return URL after cancellation. The [focused successor](focused-node22.log) passes 13/13. No runtime deadline, assertion about retained state or production behavior was weakened.

## Evidence limits and remaining integration

Native input used Immediate turning; Grid/queued-cut preservation is host-test evidence. The native flight was paused before its displayed clock reached one second; no exact native checkpoint or cut geometry is claimed. Snapshot and DOM reads are sequential. Boot transitions are annotated. No physical controller, phone/touch, short-landscape, zoom, screen-reader, public or full-phase acceptance is claimed. Scrolling to course controls can leave the document scrolled when Ready receives focus; responsive full-arena presentation remains in P05/P18.

Integrate with J Restart and mode-departure work using hunk review, then qualify the final composed source. The original workspace and published versions remain unchanged.

## Maintainer prompt and research

“Start each First Flight lesson through the ordinary game UI. Begin a cut in both steering modes, queue an off-center turn, then choose a different lesson. Verify that Stay, Escape and controller Back retain the exact checkpoint and actual selector focus without writing player data. Prepare must adopt the named lesson once, paused at tick zero, with Start focused. A held confirmation cannot start it. Test same and invalid options, a second choice while the decision is open, explicit Skip/Return and page-departure invalidation. Report native keyboard and physical-device evidence separately.”

The selection keeps native select interaction and distinguishes choosing from replacing an attempt. This follows the explicit choice and cancellation behavior described by [W3C's combobox guidance](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) and consistent digital navigation in [Xbox guideline 112](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/112). These sources inform the interaction; they do not establish conformance or reference-game parity.
