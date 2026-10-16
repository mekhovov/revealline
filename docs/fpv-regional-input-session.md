# Regional shared-input session

This increment replaces the regional review page’s custom keyboard/throttle
implementation with the same `createFlightInput` and `createFlightGamepad`
adapters used by Academy and World Studio. It remains an authoring preview,
not a catalogue-admitted player host. Terrain stays `flightReady:false` and the
session remains unscored with `playerReady:false`.

## Completed

- Production two-stick keyboard layout/gains, fine control and retained throttle;
  touch pointer capture/response/release; standard controller neutral pickup,
  D-pad/sticks, deliberate Arm/Reset/Pause and camera actions.
- Fixed 20 ms simulation ticks. A clock reversal or gap over 250 ms pauses before
  movement. Hidden/blurred pages, touch cancellation, controller loss, ambiguous
  buttons and focused setup fields release ownership and pause. Camera switching
  does not grant input or bypass arming.
- Missing required terrain starts bounded preparation automatically, while the
  committed body remains paused. Successful preparation never resumes flight.
  Controls are cleared and explicit neutral Arm is required.
- Serialized reset/replacement; cancelled preparation cannot publish a stale
  session. Disposal removes adapter/listener ownership and awaits the flight’s
  own terrain cleanup. Acro/self-level changes pause and persist across Reset.
- Existing verified source, collision and origin transactions are reused. This
  coordinator neither publishes geometry nor changes world position, momentum,
  quaternion or accepted ticks during a transition.

The review renderer and camera remain the existing authoring implementation.
No production model, World.v1/proof contract, scored recording, shared input
adapter, manifest or terrain/scenery schema is changed by this increment.

## Verification

Node v20.19.5 commands:

```sh
node authoring/fpv-worlds/regions/verify-input-session.mjs   http://127.0.0.1:9011/region.json
node --test --test-name-pattern="touch release|camera focus"   game/test/fpv-flight-ui.test.mjs
```

Nine focused session scenarios pass, including real production adapters under
modeled keyboard, touch and standard Gamepad events. They cover retained throttle,
fixed timing, blur/visibility, cancellation, simultaneous controller actions,
disconnect/reconnect, explicit recovery, mode/reset, stale replacement and disposal.
Two existing touch/focus regression checks pass unchanged (42 unrelated tests are
filtered out).

The real Canyon source-window/Three/Rapier smoke path accepts 1,397 flight ticks,
crosses one required cell boundary and uses two local frames. The final world
position is `(181506,139761,100000)` mm. Full body position, velocity, orientation,
angular rates and accepted ticks compare exactly before/after preparation. The
host remains paused afterward until a fresh neutral controller Arm. Source bytes
come from the already verified 768 m Canyon representative, not synthetic terrain.

These are functional modeled-input observations, not physical controller/radio,
mobile, browser performance, two-hour residency or release-package qualification.

## Review

Use the existing regional preview URL with a same-origin Canyon manifest. Load
region, choose Keyboard/Touch/Controller, then Arm. The keyboard now matches the
SIM default: W/S throttle, A/D yaw, arrow keys pitch/roll, Shift fine, Space
arm/pause, R reset, Esc/P pause. Expand Controls for controller mappings. After a
terrain boundary the page prepares the next verified window automatically but
requires Arm again. Choosing a source or mode pauses; touch controls are visible
only for Touch.

## Remaining

- The full production renderer/player lifecycle still needs a regional contract.
  Existing World.v1 is not stretched or rewritten to impersonate regional data.
- USB radio profile/setup/session integration and complete shared menu navigation
  are not connected to this authoring host yet; controller flight actions alone
  do not constitute full controller-only catalogue/menu access.
- Production collision/landing/damage and atomic multi-owner origin migration
  still need integration, including scenery, actors, effects and audio.
- Scenery preparation must stage all required render/collision windows before a
  single synchronous publication. Sequentially committing terrain then scenery
  would not be an atomic flight frame.
- Streaming/offline recovery, context loss, memory/frame-time/device evidence,
  package admission and public launch remain required before player availability.

## Browser observation after implementation

The desktop in-app browser loaded the actual Canyon review page and verified
production W throttle (62 ticks, 39%), Space pause, Reset returning to zero ticks
paused, actual pointer-drag touch input reaching 83%, and flight-mode changes
pausing. This is a desktop browser/pointer smoke observation, not phone touch or
physical controller qualification. Controller hardware was unavailable; the
controller evidence above remains simulated.
