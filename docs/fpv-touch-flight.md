# Flight mode choice and touch control — 2 October 2026

## Player behavior

Every installed level keeps the selected Self-level or Acro mode. Changing mode
starts a fresh paused attempt. Personal recordings keep their recorded mode;
changing the selector leaves that recording. Demonstrations and section practice
use an exact matching-mode proof, or clearly fall back to a new attempt.

The 16 authored Acro skill courses also open in Self-level, as explicitly
unscored practice. Their original manoeuvre objectives stay intact; practice
cannot create a recording, recovery record, medal or completion award. Ordinary
lessons record the actual completed mode. School copy explains that camera and
response settings restore on exit while the chosen mode persists.

Touch controls in Academy, World Studio and the learning lab pick up at the
contact position. Initial contact produces no rotation or throttle jump.
Releasing rotation recentres it; throttle stays set until another relative drag.
Each thumb owns its own pointer. Cancellation, focus loss and layout changes
pause and clear controls; resuming is deliberate.

Precise touch response is the default: a small spatial dead zone and a gradual
curve make small corrections easier while preserving full travel. Direct keeps
linear response. The choice is shared between both SIM hosts and adds no temporal
smoothing. It does not change flight physics, radio calibration or recorded
commands. The paused touch display shows cleared input rather than stale thrust.

Handheld controls use larger, quiet thumb areas near the bottom edges, short axis
labels and a retained-throttle readout. The center stays available for flying.
Touch areas are 136px at 390×844, approximately 120px at 844×390, and 128px at
1280×800. Menus remain reachable and scroll within the screen.

## Research applied

- [Apple game controls](https://developer.apple.com/design/human-interface-guidelines/game-controls/):
  comfortable touch targets and controls that preserve the view of gameplay.
- [Xbox input guidance](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/107):
  adjustable analog response and multiple input methods.
- [W3C Pointer Events](https://www.w3.org/TR/pointerevents/): per-pointer ownership,
  capture and cancellation; touch-action is established before a gesture.
- [WebKit safe areas](https://webkit.org/blog/7929/designing-websites-for-iphone-x/):
  retain safe-area insets around edge controls.
- [VelociDrone mobile manual](https://www.velocidrone.com/mobile_manual): touch
  and flight-mode choices are useful, while a physical radio remains better
  suited to precise racing. This is not a measurement of this simulator.

## Functional qualification

The maintained browser fixture is prepared with
`node scripts/prepare-fpv-touch-flight-verification.mjs --out dist/fpv-touch-flight-verification-NAME`.
It freezes dependencies, exercises the real input adapter with DOM PointerEvents,
and mounts the actual World host with isolated storage, controlled animation
callbacks and a renderer stub. Synthetic pointer capture has an explicit
ownership shim. Separate actual-player checks exercise real pointer capture and
responsive presentation. Receipts are under `docs/evidence/fpv-touch-*`.

Additional unit coverage remains deferred to H/R7. Responsive browser evidence
does not establish physical iPhone, Steam Deck, native-app, radio or novice-player
acceptance, nor sustained GPU performance. Alternate-mode demonstrations are not
invented; unavailable examples remain unavailable.

## Delivery order

This user-prioritized usability increment precedes the planned C2 meadow art
pass. Publish it independently on current main once verified. Native stack957
has fully merged; create another stack only if a later PR depends on this one.
Continue the art/environment plan after the usability increment is published.
