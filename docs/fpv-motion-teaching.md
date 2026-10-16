# FPV motion teaching and peripheral flight aids

## Player-facing change

Lesson examples now continuously show both ends of each control. Throttle rises
and falls; pitch and roll show opposing tilts; yaw shows both turning directions
against a moving ground reference. Example sticks show the actual full-travel
commands applied to a separate, unscored flight simulation at 0.2× teaching speed.
A visible reminder says to use small corrections in real flight. Manual input
uses normal speed and is never visually amplified.

A deliberate key press, touch gesture or calibrated radio movement takes over
without a separate mode/source menu. Resting radio throttle and small jitter do
not steal the example. Manual control stays selected until **Replay example**.
**Pause preview**, **Reset controls**, and **Replay example** remain explicit;
Escape pauses the preview and returns directional keys to menu navigation.
The real lesson stays paused and cannot arm while the expanded guide owns input.
Blur, disconnection, stalls and nested menus stop preview controls; reconnection
never resumes them automatically. Reduced-motion preferences start paused and
allow one example cycle only after an explicit Play action.

The rear-follow schematic preserves the complete flight quaternion, including
inversion. In the lab, one-metre ground tiles move according to measured position,
not independently integrated velocity. The ground turns relative to the rear
camera when the heading changes. True height controls drone/ground separation
with bounded camera framing; a metre label explains that framing.

Four visible props have independent normalized motor-demand cues and tick-based
phases. These are an **illustrative command mix, not measured RPM or simulated
ESC output**: the existing flight integrator has no motor-level physics. With the
props-in convention, front-left/rear-right turn clockwise viewed from above,
and the other diagonal turns counterclockwise. Nose-down demand raises the rear
pair, right-bank demand raises the left pair, and right-yaw demand raises the
counterclockwise pair. Repeated paused frames do not animate. Reduced motion
keeps the demand cue but freezes decorative propeller rotation.

The default flight display uses a small transparent schematic in one lower
corner and compact input gimbals in the other. Touch controls retain larger
interactive targets. The live lesson overlay keeps the short objective,
progress and **Explain**; full instruction stays in the paused guide. Off,
Compact and Learning preferences remain available in both simulator hosts.

## References and boundaries

[Betaflight's mixer documentation](https://betaflight.com/docs/wiki/guides/current/Mixer)
explains combining throttle, pitch, roll and yaw contributions and distinguishes
the two motor rotation signs. The
[Motors tab guide](https://betaflight.com/docs/wiki/app/motors-tab) documents
props-in/props-out configuration. This interface deliberately uses one stated
illustrative convention; it does not claim to reproduce a particular aircraft's
PID controller, motor characteristics or firmware.

No flight integrator, scoring rule, recorded-command format, challenge ID or
reward contract changes. No new runtime dependency or asset file. Existing
package caps and public deployment gates remain unchanged. Additional unit
coverage stays in R7; functional evidence for this increment is recorded in the
delivery log and accompanying receipts. Physical radio, novice-player and
sustained hardware performance acceptance require separate observation.
