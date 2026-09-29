# Two controllers in Versus and Team

## Playing

Connect each controller to the operating system using USB, Bluetooth or its receiver. Open Versus or Team in a browser or host that exposes the devices through the Gamepad API. Keep the page visible and operate each controller once if it has not appeared yet. The game does not pair Bluetooth devices or install drivers.

While Ready or paused, release all mapped controls, then press a face button or Menu on a standard controller to join Player 1. Do the same on the other controller for Player 2. Joining consumes that gesture; release before choosing Start. Simultaneous joins use browser index order. Settings → Controls → Two controllers provides explicit assignment, swap, release and menu-owner controls.

Each controller drives only its assigned player. One player owns shared menus; either player's Pause button can pause and take the menu. A third unassigned controller cannot control menus or pause the game by disconnecting. A lost controller pauses play without moving its partner's seat. Rejoin deliberately and select Resume. Release held controls after focus loss, mapping changes or resume. Refreshing or changing game modes requires joining again.

Standard controls retain the existing layout: D-pad/left stick to move, South for Ability/Support, West for Supply, right shoulder for held Boost, Menu for Pause. Keyboard layouts, pointer actions and touch controls remain available. Partially mapped controllers retain Auto touch on touch-capable devices; Always/Show and Off still override it. Solo bindings and Boost Toggle are independent.

## Radios and other layouts

Select the connected device in Two controllers and choose Configure. Setup uses keyboard or touch so mapping gestures cannot operate game menus. For each gameplay or menu action:

1. Choose Button/switch, Axis/stick or Hat/D-pad axis.
2. Record its released/rest position.
3. Move only that channel to its full active position and capture it.
4. For hat diagonals, add each diagonal to its two adjacent directions.
5. Test the live preview, acknowledge verification, then Save and apply.

Axis activation/release thresholds support hysteresis and measured reversed travel. Unneeded actions can stay unmapped and use keyboard/touch. Leaving setup, changing focus or losing/replacing the device cancels capture. Saved profiles are deliberately selected and verified; device names are not unique serial numbers, and USB/Bluetooth/receiver layouts may differ.

EdgeTX Classic exposes eight axes and 24 buttons. Choose USB Joystick on the radio; use Classic first, or configure Advanced as needed. Check actual channels in the preview rather than assuming an OS-specific channel order. Reconnect after changing radio joystick configuration. Prefer normal latched switches for actions that need a held state; a very short firmware pulse can fall between browser samples. See the official [developer mapping guide](https://manual.edgetx.org/edgetx-how-to/joystick-mapping-information-for-game-developers), [Advanced setup](https://manual.edgetx.org/edgetx-how-to/configure-advanced-joystick-with-edgetx) and [USB joystick settings](https://manual.edgetx.org/color-radios/model-settings/model-setup/usb-joystick).

Multiplayer direction mapping is separate from simulator calibration. It does not change `RadioProfile.v1`, `FlightResponseProfile.v1`, full-travel throttle, stick Mode 1–4, arming, disarming or airborne pickup. Multiplayer can use a radio alongside a standard pad, or two independently configured radios. This does not add multiplayer to the optional FPV simulator.

## Profiles and recovery

`CouchControllerProfiles.v1` uses its own `revealline.couch-controller-profiles.v1` storage key. Export/import is bounded JSON text (16 profiles, 256 KiB collection limit); imports do not silently apply mappings or claim seats. Undo restores the previous saved-profile collection, not a live mapping already applied to a device. Re-edit/apply that mapping explicitly.

Storage failures keep mappings usable for the session and offer Export/Retry. Concurrent edits in another tab stop persistence until reload rather than overwriting them. Malformed or newer stored data is preserved; export the session draft before recovery. Controller backups are separate from game-progress backups and FPV radio/response exports.

## Implementation phases and verification

1. **Baseline and contracts:** based on freshly fetched/pulled `main` at `321408a3cfd75ae230d760f39fb692503652601a`. The original user checkout remains separate. Device transport belongs to the OS/browser, per the [Gamepad specification](https://www.w3.org/TR/gamepad/).
2. **Session ownership:** one injected hardware snapshot per animation frame, two stable session seats, connection-generation tracking, neutral gates, explicit menu ownership and loss recovery in both hosts.
3. **Mapping and setup:** standard defaults plus bounded raw buttons, signed measured axes, hats, partial mappings, preview/verification and separate profile persistence. English and Ukrainian UI.
4. **Compatibility:** existing input adapters still own keyboard/touch arbitration, held Boost, per-player capture/respawn release and commands/replays. Optional FPV compatibility is checked against PR #758 at `2218f3cc21d82e23373e3324c75d27fa2fbe24a0`; no simulator files are changed.
5. **Qualification:** automated session/setup/host/input/router/Steam Deck compatibility-event tests and source-browser settings inspection. Physical hardware and packaged native qualification remain explicit release checks below.

Reproduce the optional FPV cross-check using:

```sh
node scripts/check-couch-radio-compat.mjs /path/to/checkout-containing-fpv-radio
node --test /path/to/checkout-containing-fpv-radio/game/test/fpv-radio.test.mjs
```

The cross-check verifies unchanged raw snapshots and serialized radio calibration, independent profile storage, all throttle endpoints, arming, disconnect and airborne pickup. Existing radio tests separately cover calibration, response, latched arm and reconnect behavior. This is a source compatibility test, not a merged or packaged PR #758 build.

### Hardware qualification still required

| Surface                         | Release check                                                                                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Laptop browsers / desktop host  | Two real USB pads, two Bluetooth pads, mixed transports and identical models; join, both players move/action, pause, reconnect each seat, third-pad exclusion |
| EdgeTX                          | One radio + pad, two radios; Classic and supported Advanced configurations, inverted channels, full-travel throttle untouched in simulator, latched switches  |
| Steam Deck / Steam Input        | Controller plus external pad, handheld/desktop transitions, one Confirm produces one action despite keyboard/mouse compatibility events                       |
| iOS/iPadOS Safari and WKWebView | Two OS-supported controllers, foreground/background recovery and partial-profile touch fallback                                                               |
| Android browser                 | Feature-detected Gamepad API with two OS-supported controllers; no Android native wrapper is added                                                            |

USB/Bluetooth/dongle support means the host exposes the device as a Gamepad. Unsupported hosts keep keyboard/touch working and show unavailable/setup guidance. Automated pads, ordinary desktop browser inspection, native bridge unit tests and physical transport tests are separate evidence; none substitutes for the others.

### Verification record (2026-09-29)

- Regression cohort: **706 passed**, covering both couch hosts, shell, shared touch, input policies, controller router/navigation/settings and Steam Deck-style compatibility events.
- Final focused controller session/profile/setup suite: **19 passed**, including D-pad-only controllers, two identical radios, alternate object-field ordering, invalid storage preservation and overlapping binding rejection. Setup tests also passed again after the hidden-panel polling optimization.
- Existing optional FPV radio suite at the pinned PR #758 source: **10 passed**; combined compatibility script passed.
- Selected iOS bridge/configuration/diagnostics and desktop policy tests: **23 passed**. These are source tests, not native device runs.
- Scoped ESLint, formatting and `git diff --check` passed. Localization check passed for English/Ukrainian (10,922 messages, 8,556 references).
- Local browser: inspected Settings → Controls, reachable scrolling, labels, disabled empty-device actions and English/Ukrainian switching. No physical controllers were available to qualify transports.
- Full release build **not qualified**: the initial build stopped at an omitted external-chapter authoring producer in the sparse checkout. Restoring all release inputs/output was constrained by local disk space (about 660 MiB free, existing reference distribution about 1.4 GiB). The producer source was restored; no successful full distribution or packaged-native build is claimed.
