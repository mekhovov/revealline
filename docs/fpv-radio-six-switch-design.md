# Full FPV SIM control with six radio switches

Status: implemented locally, with 439 automated checks passing. Adoption remains explicit; physical-radio acceptance of the new layout is pending. See [delivery and coverage report](fpv-radio-six-switch-delivery.md). The HTML board is an interactive illustration, disconnected from the SIM.
Date: 2026-10-20.

## 1. Decision

Use six direct controls, with a different, clearly labeled meaning for a few controls while paused. The Flight switch combines the existing Arm behavior with opening the command menu when switched OFF.

This is possible because the current radio runtime already freezes the SIM on Arm OFF. Opening the menu completes that behavior. Camera, restart and other less frequent actions belong in the radio-accessible menu.

The primary layout requires neither a modifier switch nor double taps, timed button combinations, a three-position switch or transmitter-side logical switches. It works with six ordinary maintained toggles. Momentary controls are convenient for one-shot actions but are optional.

| Physical control | Flying | Paused menu |
| --- | --- | --- |
| 1 · Flight | ON requests Arm/Resume. OFF immediately pauses and opens the command menu. | ON can request return to flight from the resume-ready root only. It cannot arm behind another dialog. |
| 2 · Fire | ON fires; OFF stops. Existing weapon timing/ammo rules apply. | A fresh OFF → ON → OFF selects the highlighted item. |
| 3 · Weapon | Fresh OFF → ON switches between the two equipped weapons. | A fresh OFF → ON → OFF goes back/cancels. |
| 4 · Reload | Fresh OFF → ON starts reload. | Cycles the view while keeping flight paused. |
| 5 · Payload | Fresh OFF → ON drops a bomb, places a remote charge or arms the drone charge, according to the equipped payload. | Opens Retry confirmation; it cannot restart immediately. |
| 6 · Detonate | Fresh OFF → ON detonates deployed remote charges or an already armed drone charge. | Opens Settings; no detonation command. |
| Navigation stick | Normal flight controls. | Move the highlight or edit the selected setting. |

Every one-shot switch must return OFF before another activation. Keeping Reload, Payload or Detonate ON never repeats it. Moving a switch OFF never deploys or detonates anything.

Use the player's observed switch names/positions in prompts. “Switch 1–6” are explanatory roles, not assumed SA–SF hardware identities.

### Why this layout

- Arm and Fire stay familiar.
- Reload and weapon selection remain immediately available during combat.
- Deploy and Detonate remain separate, predictable actions.
- All six controls are useful; frequent combat actions do not require pausing.
- Menu reuse provides Confirm and Back without consuming additional switches.
- Sticks never become menu controls during active flight.

## 2. Menu experience

The Flight switch OFF freezes the attempt at its accepted state and opens a compact **Radio menu**. Show “PAUSED · Sticks navigate” and persistent legends using the configured switch names:

**Move stick · Fire switch: Select · Weapon switch: Back · Flight switch: Return to flight**

Use six large, stable category tiles, with Resume always separately visible:

| Category | Actions |
| --- | --- |
| Weapons | Equipped weapon, reload, ammunition information, loadout change with its existing new-attempt explanation |
| Payload | Payload status, deploy/arm/detonate, cancel pending command, service supplies |
| View & HUD | FPV/Chase, chase distance, front props, health/ammo, stick monitor, guidance, widget visibility |
| Flight | Self-level/Acro using existing attempt rules, aircraft/rates, service-pad guidance, target/encounter guidance, recovery tools already supported by the activity |
| Run | Retry same seed, New run, activity, difficulty/population, level/world selector and downloads, saved session, recordings/playback |
| Settings | Radio setup, controls, sound, graphics, accessibility, language, in-app collections and Studio entry |

Use a card grid as the default; cardinal stick navigation is easier to scan than many small sectors. An optional four- or six-sector command wheel may use the same action model later. Returning the stick to centre only clears movement; it never commits an action automatically.

### Navigation details

- Prefer the measured, fully self-centering gimbal for menu navigation: normally the right gimbal for Mode 2 and left for Mode 1. Derive this from the saved stick layout and calibration, not a device name.
- Keep the existing calibrated roll/pitch navigation plus yaw hold-and-centre Confirm/Back as an alternative compatibility mode. It is mutually exclusive with the self-centering-gimbal mode: yaw must never both move focus and confirm from the same sample.
- Do not repurpose the non-centering throttle for scrolling. Reload opens View, Payload opens Retry confirmation, and Detonate opens Settings. Navigation uses the verified self-centering gimbal; provisional Select/Back can operate the guided bootstrap before axes are verified.
- Buttons, tabs, toggles and lists have visible focus. Sliders and numeric values enter edit mode on Select; stick left/right adjusts, Select commits, Back restores the previous value.
- Provide coarse/fine numeric steps on screen rather than requiring a held modifier.
- Text/search fields get an in-app character keyboard, recent searches, presets and clear/reset actions. No compulsory physical keyboard for names or in-app search.
- Long lists support held directional repeat with an initial delay; destructive confirmation never repeats.
- Retry, abandon attempt, reset calibration, delete and import replacement use a separate confirmation screen with Cancel initially focused.

### Returning to flight

1. Return to the menu root or choose Resume.
2. Show the existing readiness checks as a short checklist and stick-position ghosts.
3. From the resume-ready root, a fresh Flight OFF → ON requests resume. A nested menu, unfinished edit, capture or confirmation consumes this transition without arming and explains how to return.
4. A new attempt requires low throttle and centred flight axes. Resuming the same paused attempt uses its saved stick-position pickup, so navigation cannot cause an aircraft jump.
5. Failed readiness remains paused. Matching the sticks later does not silently resume: the pilot makes another deliberate OFF → ON transition.
6. Fire and the four one-shot controls must each be observed OFF after flight ownership resumes before their next activation can act. The menu-confirm gesture cannot also fire.

If paused by a mouse, focus loss or another device while Flight is already ON, show “Flight switch OFF, then ON” once the root is ready. Do not treat the existing ON state as a new request.

## 3. Payloads and ammo

Payload action labels always name the equipped operation: **Drop bomb**, **Place charge**, **Arm drone charge**. Detonate stays separate and displays a reason when unavailable.

- No deployed/armed charge: Detonate does nothing and reports that state.
- Deploy/arm and Detonate arriving in the same input sample cannot cause an immediate explosion. Resolve deploy/arm at most once, suppress Detonate, then require its OFF state and a later fresh activation.
- Arming a drone charge displays a persistent armed indicator and an optional sound cue. Detonation remains a separate action.
- No actions are inferred from running out of ammo. Dry-fire feedback points to Reload or supplies.
- Existing Balanced/Arcade/Tactical rules remain authoritative; this control scheme does not grant supplies or change cooldowns.
- A menu-selected live action is staged as one visible UI operation, separate from queued simulation commands. It is not executed by closing the menu or arming. After explicit resume and fresh-input pickup, Fire acts as **Execute [named operation]** once; then must return OFF again before ordinary firing is enabled. Revalidate the operation at resume and execution. A direct Weapon/Reload/Payload/Detonate activation first cancels the staged operation, then performs its own action, so a later Fire cannot unexpectedly detonate. The operation can be cancelled from the menu and is cleared by input loss, profile changes, attempt changes and invalid target/state. This is the slower, single-control alternative, not the default six-switch combat path.
- Service-pad and target navigation are selectable menu actions. Interacting with a pad still follows the normal low-throttle, speed, weapons-release and accepted-time rules.

## 4. Setup that fits the hardware

Offer **Full radio · six switches** as a layout choice alongside the existing custom bindings.

1. Keep the verified stick calibration.
2. Explain the six roles using a radio diagram.
3. Capture one physical switch at a time through all relevant positions, then back to rest.
4. Recognize a single held button, inverted button, mutually exclusive position buttons, or an unused analog axis.
5. Group all observed aliases of one physical switch so the same switch cannot accidentally become both Fire and Detonate.
6. Ask whether it is maintained or spring-returning; measured behavior can suggest a choice but should not falsely claim to know the physical mechanism.
7. Run a short practice: pause, select/back, resume, fire, switch, reload, deploy, detonate. Demonstrate fresh activation using harmless practice feedback.
8. Explicitly adopt the independently stored control layout. Allow Undo to the previous layout without recalibrating sticks. Flight and Fire are required; absent optional roles remain accessible through the menu.

Only an explicit layout adoption changes the active action routing; the old optional Pause/Reset/Camera calibration fields remain intact. Keep previous layouts and the v1–v5 profile readers. Never silently rewrite a saved working radio profile.

### Variants

- **Five switches:** Flight, Fire, Weapon, Payload, Detonate; Reload through the menu, with optional automatic empty-magazine reload if separately enabled.
- **Four switches:** Flight, Fire, Weapon, Payload; Reload and Detonate through explicit menu command staging.
- **Three-position hardware:** optional direct weapon or camera selection after all positions are observed and validated. Extra positions enhance the six-switch layout; they are not required.
- **Separate Arm and Menu preference:** an advanced alternate layout may use Shift for Reload/Detonate. Keep the direct six-switch preset as the default; modifier behavior is not needed for ordinary play.

If a switch produces no USB signal, the wizard names that problem and shows the raw input view. Radio-side channel/mixer assignment may be necessary; the SIM cannot manufacture an absent input. Avoid requiring EdgeTX Advanced mode for the normal preset.

### Setup navigation and initial bootstrap

For an already configured radio, the last verified mapping navigates setup outside active capture. Capture owns only the requested control; a known, uninvolved Back control remains available. If Back itself is being captured, use the bounded capture timeout or the visible Cancel action; the switch being measured cannot also cancel its own capture.

For an uncalibrated device, use a sequential first-connect bootstrap before presenting normal menus:

1. Deliberate repeated movement nominates one device. Show its identity and require a second movement/rest cycle on that same device. Simultaneous activity from another device cancels nomination; ask the player to move only the intended radio or disconnect the other device.
2. Ask the pilot to choose Select and Back switches, one at a time. Observe two complete stable activation/return cycles for each, using the existing raw capture/alias logic. Each completed measurement advances automatically. No prior calibrated axis or menu click is required.
3. Use those provisional digital controls to advance/repeat/cancel the four-axis guided measurements. A bounded inactivity timeout returns an unfinished capture to its preceding prompt without adopting data.
4. Once draft sticks are checked, enable full draft navigation and assign the remaining roles. The provisional Select and Back become the proposed Fire and Weapon controls; they remain editable.

Flight remains inhibited until verified save. Cancelling returns to device discovery or the previous valid profile. No raw axis drives gameplay or generic menu navigation before calibration. Unsupported or ambiguous USB reports get a visible diagnosis; no device samples are merged.

## 5. Coverage and compatibility

The same action vocabulary must work in Worlds, Academy and Studio previews, across native/downloaded/regional maps and both physics backends. Activity choice changes action availability, not the meaning of Flight, Fire or menu navigation.

- Original courses keep objectives and recordings; unused combat actions report unavailable.
- Results and death screens offer Retry, New run, Change level and Settings through the same navigator.
- Active playback gets a presentation-only radio owner. Flight OFF opens its playback menu, and Play/Resume controls playback without arming an aircraft or emitting combat commands. Existing playback controls, including seeking and speed where supported, and exit must be radio accessible. This does not promise a new seek engine for combat recordings.
- Studio needs focusable object lists, tool modes, transform/numeric editors, add/remove/duplicate, undo/redo, validation and saved-project selection. A virtual cursor is an optional precision tool for canvas-only interactions; it must have an object-list alternative. Mark remaining canvas-only tools as coverage failures rather than claiming full Studio support from menu navigation alone.
- Catalogue downloads, installed content and recordings use in-app lists.
- Native file pickers, browser permissions and true fullscreen are browser/OS boundaries. Browser Gamepad polling does not itself supply trusted activation for these APIs. Keep the current fill-window fallback, in-app collections and imports already available on the site; clearly identify the occasional host gesture needed for external files or browser permissions. A browser-only design cannot guarantee radio control over arbitrary OS dialogs.

## 6. Implementation contracts

### Existing foundations and actual gaps

The current v5 radio profile supports nine independent action bindings: Arm, Pause, Reset, Camera, Fire, Weapon, Reload, Payload and Detonate. Each occupied axis/button must be unique. The six-switch design uses six of those existing action identities; it does not weaken duplicate detection.

The implementation now adds an independent six-role store and context routing, setup adoption/undo/practice, and a raw-device bootstrap. Host/menu/playback reachability and hardware behavior require their own checks; setup tests alone do not qualify all SIM surfaces. Legacy behavior remains available without adoption.

Primary source files: `radio-profile.mjs`, `radio-runtime.mjs`, `radio-session.mjs`, `radio-setup.mjs`, `input.mjs`, `world-app.mjs`, plus the Academy host and shared menu/Studio adapters.

### State and event ownership

Use one sampled device state and one explicit owner:

`Unknown/unverified device → Setup → Menu / Resume-ready → Flight → Results`

Known-device reconnection returns to paused Menu/Resume-ready with the saved calibration and layout preserved. It never auto-arms or forces unnecessary recalibration.

Playback is a separate presentation state. Capture is exclusive within Setup.

- Flight OFF/focus loss/disconnect takes precedence over Fire, reload or ordnance from the same sample.
- Freeze accepted simulation before menu controls can navigate.
- Read all switch states from the same sample; debounce discrete transitions and retain hysteresis for axis switches.
- Consume each one-shot event once, at the accepted simulation boundary. Cancellation/rejected steps do not lose or duplicate it.
- Clear queued gameplay intents, held-fire eligibility, menu confirmation and repeat state on ownership changes. A single visible staged UI operation may survive only the explicit Menu→Resume→Flight path described above; it is not yet a simulation command.
- Menu entry requires centred navigation axes and released action controls. Resumed flight requires saved-position pickup, which can include non-neutral throttle/axes, plus released action controls. Inactive owners cannot observe an input as a command.
- Every profile/control-layout change is atomic, validated and rollback-capable.
- Keep input presentation configuration separate from gameplay proof identities. Record resulting normalized commands through existing encounter/replay paths.
- Retain exact device matching and calibrated axes. Browser index or transmitter name alone is not identity.

Prefer a separate versioned `RadioControlLayout.v1` preference referencing the saved calibration/profile, rather than adding contextual UI fields to historical calibration documents. Alias/position grouping can live in this new validated layout. Old profiles without it retain their old behavior.

## 7. Delivery phases and acceptance

### Phase A — Core six-switch flow

Adoptable preset, minimal setup navigation and escape using the last verified mapping, OFF→pause menu, Fire Select, Weapon Back, View/Retry/Settings shortcuts, explicit return/pickup, practice diagram and legacy-profile rollback. Native and Railway Valley on both physics backends.

Exit: a pilot can launch, fly, fire, reload, switch weapon, deploy, detonate, pause, resume and retry using six ordinary toggles.

### Phase B — Full application reachability

Uncalibrated-device bootstrap, complete setup/capture coverage, playback owner, radio-friendly numeric/text editors, selector downloads, settings, service guidance, results/recovery and complete Studio input coverage.

Exit: a feature-by-feature navigation checklist has no unexplained in-app keyboard dependency. Browser/OS boundaries are documented separately.

### Phase C — Hardware and regression qualification

Test paired-position USB buttons, ordinary toggles, momentary controls, axis switches, three-position reports, reversed channels and supported stick modes. Cover reconnect, held switches at startup, menu nesting, capture cancellation, long pauses, simultaneous payload/detonate, high-throttle new starts and airborne pickup.

Use existing simulated-input suites plus a physical-radio session. Verify normalized recordings are unchanged by menu-only actions and that neither menus nor setup can fire weapons.

Usability targets:

- Pilot completes the main loop after the short practice without a keyboard.
- No accidental Fire, Payload, Detonate or Retry across repeated menu transitions.
- Six-switch labels match the physical controls shown during setup.
- Menu navigation needs no rapid gestures or mandatory button chords.
- Normal flight inputs retain their existing sampling cadence.
- Measure Academy and Worlds package closure before accepting new runtime files; the current Worlds source package is already at 210 files.

No physical-radio acceptance is claimed by this document. The setup suite covers explicit adoption/undo, partial layouts, alias rejection, timeout/cancel, harmless practice, storage failure, unknown-device nomination, provisional Select/Back, complete axis calibration, and unverified model proposals. Final application coverage is reported separately.

## 8. Research and design decisions

- [EdgeTX USB Joystick](https://manual.edgetx.org/color-radios/model-settings/model-setup/usb-joystick) documents axes and per-position button reporting, including Normal and Pulse variants. Its [developer mapping guide](https://manual.edgetx.org/edgetx-how-to/joystick-mapping-information-for-game-developers) describes configurable USB reporting. Apply capability capture and alias grouping rather than assuming switch names or firmware layouts.
- [VelociDrone's manual](https://www.velocidrone.com/mobile_manual) explains raw-input diagnostics and radio-side channel assignment. Include both in setup troubleshooting.
- [Steam Input action layers](https://partner.steamgames.com/doc/features/steam_controller/action_set_layers) support context-specific action meanings, and [radial menus](https://partner.steamgames.com/doc/features/steam_controller/radial_menus) demonstrate labeled choices and explicit cancellation. Reuse these interaction principles inside the SIM; Steam is not a dependency.
- [Xbox Accessibility Guideline 107](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/107) recommends remapping, updated prompts and alternatives to simultaneous or prolonged presses. The recommended layout therefore uses direct actions and sequential menu controls.
- [Liftoff's button-setup update](https://www.liftoff-game.com/news/update-042-released) made control setup accessible from pause because shortcuts were hard to discover. Keep the radio diagram and binding editor directly in the paused menu.
- [MDN user activation](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/User_activation) explains why browser-protected operations need a host interaction. Do not promise that synthetic button clicks bypass these restrictions.

These references inform the design. They do not prove hardware compatibility or certify this implementation.

## 9. Implemented setup and model suggestions

- The six-role panel is directly below the stick guide and live preview. Legacy separate assignments stay collapsed under their own label; they are not nine extra required switches.
- Model and USB/receiver suggestions are next to device selection. They never adopt a layout automatically or replace verified calibrated axes. Applying a suggestion creates a draft and requires checking its assigned switches before explicit adoption.
- Receiver model/firmware selection is remembered per exact device. Squid and upstream CRSF mappings are separate; an unidentified Pico receiver requires an explicit choice. Unsupported or mismatched channel counts keep the suggestion unavailable and manual setup available. See [radio models and source references](fpv-radio-models.md).
- Pocket and other reduced-input radios can adopt Flight + Fire with optional roles omitted. The menu provides the remaining actions through explicit staging; capability depends on the actual USB reports, not the model name.
- Unknown-device bootstrap proves two deliberate movement/rest cycles on one device, then two complete cycles each for Select and Back. It rejects simultaneous devices, aliases, interruption and timeout. Only then does the guided axis calibration begin. Provisional controls never arm or fire.
- Practice reports contextual actions without sending flight or combat commands. Saving failures are reported as session-only; calibration and previous layout data are preserved.
