# FPV Flight Studio

This optional civilian practice package is separate from the arcade engine and the earlier `civilian-flight` gym. It presents the shared 50 Hz integer/quaternion model through a procedural Three.js scene. It is a simplified fictional teaching model, not a particular aircraft, configuration guide or qualification for real flight.

The twelve authored drills have separate self-level and Acro criteria. Both use manual throttle. Self-level requests a tilt and returns toward level with centred pitch/roll. Acro requests an angular rate; centring the sticks retains orientation. Neither mode holds position or altitude. The rendered millimetre positions, orientations, bounds, obstacles and goal volumes come from the exact course/model; light gates are criteria rather than additional solid obstacles.

## Play, observe and review

Choose a drill, input source and mode, then explicitly arm. The default first-person view can switch to chase or overview. Camera field of view and camera tilt affect presentation only. The active volume or directional gate is highlighted, and the coaching line displays the ordered criterion, dwell and applicable speed/tilt/heading limits. Hold progress resets if the model's criteria are no longer satisfied. Contact count and live throttle are visible.

**Watch example** uses an exact replay-verified demonstration. **Review your flight** replays recorded normalized inputs against their original model, course, mode and response. A displayed route is a sampled visualization of that replay. Neither observation path records practice completion. **Try this drill** creates a fresh practice attempt. Completion callbacks contain the original practice transcript and independently recomputed outcome; the notebook owns persistence and rewards separately.

Replay admission yields through the shared verifier at least every 200 model ticks. Closing a dialog, pausing, changing the drill/input source or disposing the app cancels pending reading and verification before playback can start. Live wins use the notebook's cooperative verification once; Next and Retry remain available while the exact completed proof is accepted independently of the next run.

Keyboard controls:

- W / S: pitch forward / back; A / D: roll left / right.
- Q / E: yaw left / right.
- Up / Down: increase / decrease manual throttle. Releasing these keys holds the current throttle value.
- Shift: smaller adjustments; P: pause.

Touch uses a clearly labelled Mode 2 diagram: yaw/throttle on the left, roll/pitch on the right. Release centres pitch, roll and yaw while preserving the selected throttle. The separate throttle slider is keyboard accessible. Device calibration, channel assignment, stick-layout illustrations and flight response are separate in **Radio & response**. Radio input is exclusive; a lost device never borrows keyboard controls.

Blur, hidden-page transitions, dialog opening, pointer cancellation, controller loss, rendering-context loss and long frame interruptions pause and neutralize local input. Pausing a radio retains its pickup requirement. A reset, changed mode, course or input source starts from the launch pad and clears the old pickup. Returning from a reading dialog does not automatically resume. A graphics-context loss requires reload; the current transcript remains exportable until then.

Without WebGL, course descriptions and controls remain readable, and simulation/replay is unavailable. The renderer respects reduced motion for cosmetic rotor movement; the actual first-person orientation remains the model's orientation. There is no camera shake or cinematic collision pause.

## Validation boundaries

`game/test/fpv-flight-ui.test.mjs` drives the actual shell with deterministic DOM boundaries and synthetic USB samples, verifying explicit arming, ownership, blur/dialog/reset, successful replay-checked practice delivery, preview isolation and cleanup. These are automated code tests, not browser-layout or physical radio evidence. Real USB compatibility, mobile ergonomics, visual comprehension and perceived flight response require the separately recorded device/human review.

The package has no live aircraft connection. Three.js is pinned locally with its license and source provenance under `vendor/`; there are no runtime CDN dependencies or generated background downloads.
