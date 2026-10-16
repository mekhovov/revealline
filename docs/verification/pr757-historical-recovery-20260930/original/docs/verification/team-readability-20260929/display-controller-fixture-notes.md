# Display Settings controller fixture correction

The original b5ab06e1 fixture performed a native synthetic Options click immediately after joining the modeled controller. Couch intentionally calls controllerConfirmGuard.observe for the joining Confirm edge; release starts the1250ms compatibility echo window. A join does not activate a target, leaving tailTarget null, so the immediate click is consumed before the shell Options handler. Instrumented observation: defaultPrevented=true, panel hidden=true, focus race-start, duel ready at fake time1049.9999999999998. This is not async picture latency or focus restoration failure.

Correction changes only the Options activation to focus the actual Options control and issue a fresh modeled South press/release. It retains every original editor, stored-value, focus, Ready-state and checkpoint assertion. No runtime change or arbitrary delay.

Evidence (Node22.22.2):
- display-original-controller-red.tap: original source selected test0/1.
- display-original-controller-observed-red.tap: instrumented equivalent button-click selected test0/1 with prevented event evidence.
- display-preferences-host-final.tap: corrected complete file9/9, zero skipped/cancelled. Command: node --test game/test/display-preferences-host.test.mjs.

Scoped ESLint, Prettier check and git diff --check passed. Hardware controller and mixed native/controller input policy remain separate qualification; this fixture correction does not claim those certified.
