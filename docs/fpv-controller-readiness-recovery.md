# Controller ambiguity pauses before input is cleared

The shared FPV gamepad adapter previously cleared readiness and retained throttle when two mapped action buttons conflicted, but did not emit Pause. Both production hosts consume adapter actions before advancing flight; without that action, they could continue stepping with the newly neutral input. The authoring session already guarded readiness separately, so its existing scenario did not expose the production gap.

An active controller now emits Pause when simultaneous action buttons or an overlapping action handoff invalidate its pending command. It never interprets the ambiguous input as Arm, Reset or Camera. Held/released buttons cannot resume flight: after the host opens its pause menu, input must return to neutral and receive a new deliberate Arm press/release. Disarmed ambiguity remains inactive. No physics, mappings, saved profiles, proof formats or package limits change.

## Verification

Three functional checks exercise the actual shared adapter: all ten pairs of mapped action buttons after retained throttle exceeds 50%; an overlapping Camera-to-Reset handoff in active and disarmed states; and active disconnect/reconnect with a held Arm button. The first two checks failed against the previous adapter because Pause was absent, then passed after the correction. Every chord clears input, emits only Pause, stays paused through release and requires a new explicit Arm edge.

The existing eight regional input/lifecycle scenarios also pass, including keyboard parity, blur/visibility, controller pickup/reconnection, touch cancellation, stale replacement, closing during preparation and menu/editing ownership. Scoped JavaScript lint and whitespace checks pass. These are simulated controller signals through production adapters, not physical hardware acceptance. The frozen c2e18 UI package remains unchanged and is qualified separately.
