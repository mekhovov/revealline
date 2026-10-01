# Rear-view teaching and live controls lab

The lesson guide, World Studio and Academy now share a drone diagram viewed
from behind its starting heading. Amber identifies the front; cyan identifies
measured movement. Perspective, motor struts and body depth make forward/back
pitch distinct from left/right bank. Right roll lowers the right side from this
reference. The diagram uses the actual quaternion, including inverted Acro;
centring a stick never invents levelling. Yaw can turn the nose toward the viewer
because the reference camera stays fixed. The starting-heading marker explains
that change. The actual FPV/chase renderer already uses −Z forward and a chase
camera behind the aircraft; its orientation and flight physics were not changed.

## Try controls before flying

Open any school lesson and select **Try controls**. The radio-shaped panel pairs
labelled gimbals with the shared diagram. Choose Keyboard, Touch / D-pad, or
Radio / controller. The radio path uses the existing calibrated and verified
profile, including Mode 1–4, even when the paused lesson uses keyboard input.
Unknown or unverified devices need the existing radio setup first.

- Keyboard: W/S pitch, A/D roll, Q/E yaw, arrows up/down adjust throttle. Shift
  makes smaller adjustments. Throttle stays set when its keys are released.
- Touch: drag either gimbal or hold the labelled direction buttons.
- Radio/controller: move the calibrated sticks; the preview needs no arm switch.
- Stop, Reset and Escape provide explicit control. Blur, a stall, device loss,
  nested setup and leaving the guide stop the preview. Reconnect never resumes it.

The preview owns a separate instance of the unchanged Gentle flight integrator.
It cannot arm the lesson, advance its timer, write its recording or award progress.
Its real attitude, thrust and measured motion update the diagram. **Example**
uses hollow dots and a bounded scripted command sequence; **Try controls** uses
solid input dots. Neither is a scored demonstration. Installed lesson recordings
remain available through Watch demonstration. Closing the explanation still
requires the real flight's existing throttle and arming checks.

Keyboard flight now continues when a flight HUD button has focus. Form inputs,
menus, paused flight and the lesson preview retain separate input ownership.
Both flight hosts show larger gimbals with the current layout's directional
labels. Off/Compact/Learning drone assistance and stick display preferences stay
available. Legacy green coach/setup surfaces now use the shared navy, amber and
cyan game palette; Ukrainian and English labels remain supported.

## Menus and fullscreen

Keyboard Tab/arrows, Enter and Escape operate paused menus. Standard controllers
join with a fresh A press/release; D-pad or the left stick moves focus, A confirms
and B goes back. A calibrated radio joins by holding yaw right for 0.65 seconds
and returning to centre. Roll/pitch then navigate; yaw right/left held and returned
to centre confirms/goes back. The UI rounds the instruction to 0.7 seconds.
Throttle, arm and fire switches never select menu items. Context changes require
neutral input; a held action cannot cross a modal or reconnect. Radio axes belong
to calibration while setup is open; controller capture also suppresses navigation.

Selects, sliders, checkboxes and disclosures support the same controller path.
Text authoring, file pickers and operating-system dialogs still require their
native input methods; a four-axis radio is not a text-entry device. Active flight
and an actively controlled lesson preview disable the menu input adapter.

Fullscreen is available in the lobby, school, creator, library, playlists,
settings, radio setup and flight in World Studio, and Academy's screens/dialogs.
The document root includes nested dialogs. Returning to a lobby preserves the
fullscreen session. Entry/exit pauses flight; it never resumes or arms it.
If native fullscreen is rejected or unsupported, the explicit **Full window**
fallback keeps an exit control and labels the actual mode.

## Verification, 2 October 2026

Actual browser functional fixtures use the production components and controlled
input events. Their checked receipts are committed separately from this narrative:

- [Live lab, 15 checks](evidence/fpv-controls-lab-browser-20261002.json): keyboard,
  touch gimbal/D-pad, normalized radio, Mode 1–4, Acro persistence, isolated host,
  blur/disconnect/reconnect, held-key exit barrier and disposal.
- [World Studio host, 7 checks](evidence/fpv-controls-host-browser-20261002.json):
  keyboard takeoff, control after a HUD button takes focus, pause and unchanged
  host state while using the lab. The final takeoff check reached 0.502 m after 109 ticks.
- [Menus, 19 checks](evidence/fpv-controls-menu-browser-20261002.json): real DOM
  navigation and fields, standard gamepad, calibrated radio, release/hold gates,
  context changes, calibration ownership and disconnect handling.
- [Rear diagram, 15 browser checks](evidence/fpv-controls-rear-browser-20261002.json):
  pitch/roll signs, yaw, inversion, heading reference, simulation signs, world
  drift and disposal. The earlier [geometry receipt](evidence/fpv-controls-rear-20261001.json)
  records the numerical projection checks.

The rebuilt player package launched at the existing reviewed-player URL.
Desktop and 390×844 mobile layouts were inspected; the narrow lesson stacks
into one column without horizontal overflow. EN/UK, school/Workshop/settings
fullscreen, Academy fullscreen and its nested radio setup, keyboard Escape
return (nested dialog first, root fullscreen exit), and the larger labelled sticks
were exercised. Both SIM hosts had no
browser console errors during these checks. The source Academy check is separate
from the packaged World Studio check. All 14 Acro recordings completed and
replayed again with zero contacts and full health.

These checks do not establish physical TX15 acceptance, novice-player acceptance,
touchscreen hardware behavior, acoustic quality or sustained device performance.
Additional unit coverage remains in R7. The main game's opt-in TX15 full-menu
preset is an independent change, not a new FPV flight mapping.

## Research and remaining work

The [updated delivery plan](fpv-reviewed-delivery-plan.md#player-feedback-revision--controls-lab-and-rear-reference)
records the priority and estimates. [Xbox navigation guidance](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/112)
informed directional focus and predictable back behavior. [EdgeTX joystick settings](https://manual.edgetx.org/color-radios/model-settings/model-setup/usb-joystick)
support keeping hardware mapping explicit and calibrated. [Liftoff's mentor](https://www.liftoff-game.com/news/virtual-mentor-reveal)
is an onboarding reference. [Fullscreen API guidance](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen)
informed the user-activation fallback. None establishes physical acceptance of
this implementation. Remaining art, original demonstrations, targeted practice
and human/device qualification remain in the delivery log.

Frozen source `183690e94f5035fbcdd2c03c6001930c039aa182` passed all three package
admissions, committed-input verification, two byte-identical builds and ZIP-member
validation. The [package receipt](evidence/fpv-controls-package-20261002.json)
records Academy at 62 runtime files / 3,376,652 bytes and World Studio at 94 runtime
files / 12,579,377 bytes; source inventories remain 64 and 96 respectively. Package
limits and physics identities are unchanged. This artifact admission is not a
release-readiness or public-deployment assertion.
