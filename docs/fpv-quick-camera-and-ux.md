# Direct camera access and the next SIM usability pass

14 October 2026. The camera and paused Flight setup increments are implemented. The remaining recommendations are tracked below.

## Implemented

Both World Studio and Academy now offer a compact `View: FPV / Chase / Overview` button beside Pause. Click/tap to cycle; V cycles while a flight owns input. Standard-mapped controllers use R3 (press/release the right stick). Pause offers three explicit view choices without entering Settings. The existing keyboard, D-pad and calibrated-radio menu navigation can reach those choices. Steam Deck requires its browser to expose a standard Gamepad layout; arbitrary HID devices still use calibrated radio support and menu navigation, not guessed button numbers.

Camera changes are presentation-only. They retain throttle, rotation input, arming, recorded commands and simulation progression. Selecting a view while paused leaves flight paused. Shortcut handling excludes text fields, dialogs, modifier combinations, repeat, hidden documents and lost focus. The R3 action preserves controller pickup and cannot retrigger simply because it was held during a blocked scope or reconnect. Existing settings and lesson camera recommendations remain authoritative. No new package files, physics or asset budgets.

Controls share one component and existing host lifecycle. Labels update only when their value/language/availability changes. The HUD action uses a 44px minimum target, safe-area toolbar positioning and no menu-panel textures. Detailed camera tilt/FOV settings remain in Display. Fullscreen continues to use the existing native/full-window fallback.

## Research and recommended order

These are product recommendations inferred from the linked references, not claims of exhaustive competitor testing.

| Priority | Recommended increment | Benefit and boundary |
|---|---|---|
| P1 | A small paused **Flight setup** group: flight mode, view, active input and radio setup | The camera issue is one example of important actions buried in categories. Keep safe changes one level deep, while sensitivity, calibration and renderer detail remain advanced. Mode/input changes must explicitly pause and preserve recordings' mode identity. |
| P1 | Contextual button hints and remappable non-flight actions | Show the active device's controls for Arm, Retry, Pause and View. Offer learn-a-switch for spare radio channels, validating conflicts and requiring a fresh release after focus/reconnect. Keep current yaw menu fallback for radios without spare channels. |
| P1 | A single **Retry / Practise this section / Watch example** flow | Make the existing replay and section tools easier to find, with a preview thumbnail and retained camera/input settings. Separate practice from scored attempts; never silently restart or arm. |
| P2 | **Fly now**, **Learn**, and **Explore worlds** as the primary entry choices | Put the last played map and saved input first. The Library should offer Download → Fly with clear progress and retry, while Workshop and backups remain secondary. Build on the existing shared chooser instead of another competing menu. |
| P2 | Device-aware, adjustable HUD presets | Preserve the central flight view. Let players adjust stick size/opacity and hide assistance without hiding Pause or current objective. Keep touch hit areas large even when graphics are quiet. Validate phone landscape and handheld layouts, not only desktop screenshots. |
| P2 | A focused **Watch → Try → Repeat** lesson loop | Bring slow recorded examples, objective success feedback and targeted practice together. Keep example sticks distinguishable from live input and never turn a visual suggestion into accepted completion. |
| P3 | Camera comfort presets and a small personal-best comparison | Offer explicit beginner/racing camera tilt/FOV presets and optional compatible ghosts. Avoid silent automatic changes to controls, physics or competitive conditions. Explain which settings affect the recording/ghost match. |

[VelociDrone mobile manual](https://www.velocidrone.com/mobile_manual) exposes a direct camera toggle. Its [desktop manual](https://www.velocidrone.com/desktop_manual) documents camera shortcuts and slowed ghost playback with stick displays. These support quick view access and a more discoverable demonstration/retry flow.

[Microsoft's input guidance](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/107) supports multiple input methods and configurable controls. Its [touch-layout design guide](https://learn.microsoft.com/en-us/xbox/gdk/docs/features/common/game-streaming/building-touch-layouts/game-streaming-tak-designers-guide) separates frequent gameplay inputs from infrequent upper-screen menu actions. Its [gamepad navigation guidance](https://learn.microsoft.com/en-us/windows/uwp/ui-input/gamepad-and-remote-interactions) emphasizes predictable focus and avoiding overlapped controls. These support a compact upper-corner view action and explicit paused choices.

[Flight Division](https://flightdivision.com/) emphasizes freeflight and repeated practice with radio, gamepad or keyboard; its [school description](https://flightdivision.com/about) presents skills in a sequence. That informs entry-flow and lesson discoverability recommendations, without copying assets or claiming its exact flight behavior.

## Verification and limitations

- Actual source-browser pointer and V switching: FPV → Chase → Overview in both hosts. Pause choices change the selection while remaining paused; keyboard Enter activates a view.
- Browser viewports: 390×844 portrait, 844×390 landscape and 1280×800 handheld size; normal desktop. Camera targets measure 44px high; no measured horizontal document overflow. EN/UK labels inspected. Academy full-window fallback exercised; native iPhone fullscreen is not claimed.
- Controlled standard Gamepad adapter exercise: release emits one camera action, holding does not repeat, throttle/rotation and active arming remain unchanged; blocked/focus-return state does not replay the action. Existing calibrated-radio menu path is reused. No new physical Steam Deck, iPhone or radio acceptance claim.
- 42 existing radio/control/shared-shell checks and 81 existing flight/UI/appearance checks passed (123 total). Scoped lint, projection checks and all three package source preflights passed. Additional unit coverage remains deferred.
- Source preflight: Academy 87 files / 6,532,971 offline bytes; Worlds 122 files / 16,934,045 offline bytes. Limits unchanged. Full frozen-package admission and public deployment remain CI/publication gates while local disk space is below the stable 3 GiB floor.
- Evidence screenshots and source-preflight receipt: `docs/evidence/fpv-quick-camera-20261014/`. Browser console warning/error captures were empty for both tested hosts.


## Paused Flight setup increment — 14 October 2026

Completed: one shared Flight setup section in Worlds and Academy, immediately after Resume. Flight mode, active input, three camera choices and radio setup are available without navigating Settings categories. A pre-arm Flight setup shortcut also appears when Pause is unavailable, including when a selected controller is disconnected. It disappears during active flight. Device-specific help expands on demand; it reuses canonical keyboard/controller instructions and explains the existing radio Arm/Reset setup and menu fallback.

Mode changes retain the pause menu and start the existing disarmed attempt. Worlds input changes retain paused progression; Academy retains its existing new-attempt behavior and says so explicitly. Camera preserves the attempt. Radio setup returns keyboard focus to its paused opener. Pending controller/radio select edits are not overwritten by frame refresh; rejected changes during loading restore the real selection. Replay-disabled controls follow their canonical disabled states.

Verified in actual source browsers: both hosts, EN/UK, mode/input/camera changes, disconnected controller pre-arm access, radio open/close and focus return. Measured 390×844 portrait, 844×390 landscape and 1280×800 handheld-sized viewports across the two hosts: no horizontal document overflow, 44px minimum setup/camera targets. No physical radio/Steam Deck/iPhone acceptance claim. Existing 123 control/radio/shell/flight/appearance checks pass; scoped lint, canonical projections, diff checks and all three source preflights pass. Full frozen-package admission stays with CI because free space fluctuates below the stable 3 GiB floor. Additional unit coverage remains deferred to D6.

Remaining order:
1. P1: unify Retry / Practise section / Watch example presentation; retain proof compatibility and explicit arming.
2. P1: extend remappable non-flight actions where missing (especially View). Arm, Reset and Pause radio assignment already exist; do not replace their calibrated ownership or fresh-release rules.
3. P2: primary Fly / Learn / Explore entry and Download → Fly Library flow.
4. P2: stick size/opacity and device-aware HUD preferences.
5. P2: Watch → Try → Repeat lesson flow and targeted practice.
6. P3: camera comfort presets and compatible personal-best comparison.
