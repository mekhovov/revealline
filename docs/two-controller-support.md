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

## Regular Solo radio support

Regular Solo now exposes **Settings → Controls → Radios and custom joysticks — Solo** for raw devices such as the RadioMaster TX15. Standard gamepads retain their existing bindings, aliases and Solo Boost Hold/Toggle behavior. Capture and verify the radio channels, save/apply the profile, then release mapped controls before flying. Unmapped throttle and switches do not prevent neutral detection. Unmapped gameplay actions retain keyboard support and partially mapped radios retain Auto touch controls on touch-capable devices. Hangar and Stop remain available through the existing keyboard/touch controls; the radio recipe covers movement, Ability, Supply, Boost and Pause.

Solo uses `revealline.solo-radio-profiles.v1`, a separate store of the same bounded channel-recipe schema. Profiles do not automatically apply after reload/reconnection: select the saved recipe, verify, and apply it again. Entering capture suppresses radio navigation; focus loss, closing settings or changing context cancels unfinished capture. The router retains its normal release, disconnect and Boost reset behavior.

This is separate from the optional civilian FPV simulator's four-axis calibration, full-range throttle and arming flow. Test that source from its own checkout; it is not included in this branch's distribution.

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
- All iOS and desktop platform tests: **40 passed**. The iOS JavaScript bridge also builds successfully with Node 22.22.2. These are source/build checks, not native device runs. Full Xcode and its simulator are unavailable on this laptop.
- Scoped ESLint, formatting and `git diff --check` passed. Localization check passed for English/Ukrainian (10,922 messages, 8,556 references).
- Local browser: inspected Settings → Controls, reachable scrolling, labels, disabled empty-device actions and English/Ukrainian switching. Two identical Sony DualSense controllers connected over USB were detected and deliberately joined separate seats. Both player HUDs reported Controller. The user subsequently confirmed that both PS5 controllers work. Disconnect/rejoin, other transports and device types remain separate qualification checks.
- Full release build **passed** after restoring omitted sparse-checkout inputs: version `0.142.4`, 1,775 files, source revision `f1dc76c3119a608a9c8dbdcdd3bb688cc0dc8fb6`. Archive SHA-256: `f13feff05be22d38912fd2b6d34cb851f1a8abe2eb0dce2f22394e0c190bd7b0`. Archive digest and all three packaged controller modules were verified. The generated ZIP was removed afterward to recover disk space; the loose playable distribution remains.
- Desktop native staging **passed**, including complete inventory/hash verification: 1,775 files, 741,852,156 bytes; source/staged manifest SHA-256 `54e731be96ea4f54fa84e3052ea2c2139e7fe8c48f67a1a7d6ade987c9214b45`. The temporary stage was removed afterward for space. This does not qualify an Electron installer or native runtime.
- iOS native staging is **blocked** by existing `game/assets/field-kit/sprites/review.html`: the native HTML policy requires one explicit head. The bridge builds, but no complete iOS bundle/device qualification is claimed.
- `scripts/two-controller-browser-fixture.mjs` serves a local distribution unchanged unless a couch URL explicitly includes `fixture=two-pads`. HTTP checks verified that opt-in isolation; its simulated controls are a manual acceptance aid, not physical-device evidence.

### Solo / TX15 follow-up

- Raw-radio adapter and mapping UI added for regular Solo. The controller regression cohort passed **712 tests**; **22** existing Solo shared-settings/touch/controller host tests passed. A new real Solo host test passed through raw-axis capture, separate persistence, actual craft movement and pause on disconnect. Four focused adapter tests cover hysteresis, remapped standard bindings, Confirm probes, release/reconnect and storage isolation.
- Scoped lint, formatting, localization (10,928 messages / 8,573 references) and the optional FPV compatibility script passed. The full distribution recorded above predates this Solo extension; the extension is being tested from source.
- Physical TX15 USB detection confirmed in regular Solo and the optional FPV setup: eight axes and 24 buttons. The user subsequently confirmed FPV flight, arm/disarm and reset, regular Solo right-stick movement, and shared-stick Team movement. These are local source-browser USB results, not packaged/native or other-transport qualification.

### Shared TX15 and mixed inputs

The tested TX15 USB layout now has explicit movement presets in Controls.
**TX15: movement — right stick up/down/left/right** applies to regular Solo or
one couch player. **Share TX15: P1 left stick, P2 right stick** deliberately
assigns two independent logical seats from one physical radio in either couch
host (Versus or Team). Centre both sticks before play, including the
non-centring left vertical stick. This left-stick movement recipe is separate
from FPV throttle calibration.

The split uses right horizontal/vertical axes 0/1 and left horizontal/vertical
axes 3/2. A physical channel cannot be assigned to both players. Each player
has independent neutral gating and mapping; disconnect removes both seats.
Reconnect requires explicit setup again. Shared assignments are session-only.
Configure each logical stick entry to add separate action switches; keyboard
and touch actions remain available with movement-only presets. Applying the
single-player preset to the physical radio ends its shared assignment.

Two separate radios can each be configured and explicitly assigned to one
player. One radio and one standard controller use the same independent-seat
path. No radio preset is applied to an unrelated device. Existing standard
controller bindings, keyboard/touch arbitration and FPV controls remain
separate.

Automated verification covers Solo right-stick isolation, shared stick
movement through the couch gameplay adapter, menu routing, channel overlap
rejection, shared disconnect, two radios and a radio/gamepad mixture.
Physical Solo and shared Team movement are user-confirmed below. Two-radio and
radio/gamepad hardware verification was explicitly skipped at the user’s request;
their automated results must not be presented as physical qualification.

Physical follow-up: the user confirmed regular Solo right-stick movement works.
During Team setup, browser inspection caught native Gamepad prototype fields
being omitted by object spread in shared snapshots. Explicit field copying
fixes this; a native-like prototype-field regression now covers it. The real
TX15 retains both independent assignments in Team. The user confirmed movement,
then requested the side-matching order recorded below.

The user confirmed both sticks independently work in Team. At their request, the default shared assignment now matches screen sides: Player 1/left uses the left stick, and Player 2/right uses the right stick. Solo continues to use the right stick. Two physical radios and a radio/gamepad mixture remain hardware qualification checks.


### Final software qualification

The real Team host is exercised through its settings and assignment UI for one
shared radio, two radios, and a radio/gamepad mixture. All three tests pass,
including disconnect pausing and per-player touch fallback. Test devices model
native Gamepad prototype fields. The existing Solo host test and shared couch
gameplay-adapter tests cover movement delivery; session tests cover independent
directions, neutral gates, menu ownership, channel-overlap rejection and reconnect.

The optional FPV compatibility script passes against the updated FPV worktree:
separate profile storage, unchanged raw channels, full throttle range, arming
and airborne pickup remain intact. All 40 desktop/iOS wrapper tests pass.
These automated checks do not claim a real two-radio, mixed-device, Bluetooth,
dongle, mobile, Steam Deck or packaged-native run. Further physical testing was
skipped on the user's instruction.

- Final expanded controller/navigation/Solo regression: **587 passed**.
- Additional real Team-host shared/two-radio/mixed-device scenarios: **3 passed**.
- Desktop/iOS wrapper regression: **40 passed**. Scoped lint and diff checks passed.
- Updated local web build: version **0.142.4**, **1,777 files**. This development
  build records no source revision in its manifest. Controller payloads were
  compared byte-for-byte with the working source and ZIP contents.
- ZIP SHA-256: `d91d0cd5bda8985dba6e064f3c0de492a9a7503dc450c68a9d19729f7e97916c`.
- Desktop stage and full inventory verification passed: **741,866,937 bytes**;
  source/stage manifest SHA-256
  `3a5230cf498b9223ac50538c1768779d7c7ea2247504737e2a899f7c31331053`.
  Temporary staging was removed after verification; the web build and ZIP remain
  in `dist/`. No packaged native runtime or new iOS device qualification is claimed.
- The earlier iOS staging blocker (missing explicit head in the sprite review
  HTML) remains outside these radio changes; the existing platform limitation
  above remains applicable.
