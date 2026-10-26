# Six-switch radio controls: local delivery

Date: 20 October 2026. Workspace: `go_test_radio_fix`.

## Delivered controls

Six physical switches cover flight, weapons and the paused menu. Ordinary maintained toggles are supported; momentary switches and three-position reports can be captured too.

| Role | Flying | Paused |
| --- | --- | --- |
| Flight | ON: arm/resume; OFF: pause and menu | Resume from the main pause screen when stick pickup is ready |
| Fire | Fire | Activate and release to select |
| Weapon | Switch weapon | Activate and release to go back |
| Reload | Reload | Change view |
| Payload | Deploy or arm the selected payload | Open Retry confirmation |
| Detonate | Separate detonation command | Open Settings |

The centering gimbal navigates menus in stick modes 1–4. Resume shows current and saved stick positions. New attempts require low throttle. Switching Flight ON behind a nested menu cannot start the aircraft.

With fewer switches, assign Flight and Fire, then use **Radio actions** in pause for the remaining combat actions. A chosen action waits for a fresh Fire activation after resuming, executes once, and never also fires a shot. A further release is needed before shooting. Rejected actions stay visible and require a fresh activation; they cannot execute automatically after returning to an encounter.

## Setup and hardware presets

- OXBOT R1, RadioMaster families, Squid Stick and upstream Pico CRSFJoystick have model/connection choices. See [models, mappings and primary sources](fpv-radio-models.md).
- Saved verified calibration and switch layouts restore by exact device identity.
- New channel suggestions require checking and saving. They cannot overwrite verified sticks automatically.
- Manual mapping remains manual; selecting it suppresses automatic suggestions.
- Six-role assignment includes conflict checks, practice, explicit adoption and restoration of the previous controls.
- A radio-only bootstrap identifies one device through deliberate movements, captures Select/Back, then guides stick setup.
- Partial layouts retain menu alternatives. The previous independent action assignments remain available.

Squid Stick identifies the receiver, not its paired transmitter. Choose the receiver firmware once; changing to a transmitter with different mixers needs another check. Generic Pico identities cannot establish firmware or channel order.

## Application coverage

| Surface | Radio path |
| --- | --- |
| Worlds and Academy | Home, level selection, settings, pause, resume, view and confirmed retry |
| Advanced practice | Arena start, pause, guarded resume, reset and Back without affecting the main flight |
| Combat | Direct weapons/payload; staged alternatives; service-pad and target guidance |
| Playback | Separate presentation ownership, resume, available speed choices and exit |
| Setup | Device discovery, capture, cancellation, manual fields, practice and saved controls |
| Fields | Selects, ranges, numeric editing, text entry with Apply/Cancel |
| Worlds Studio | Object lists, coordinates, routes, undo/redo and explicit orbit/zoom controls |
| Shared Studio tools | Existing field/canvas owners; explicitly entered native preview menus; Back returns one level |

Focus loss, USB disconnect, profile changes, menu ownership changes and capture reset held-input eligibility. No menu-only action enters the flight recording or combat command queue.

Browser/OS file pickers and permission dialogs can require a host gesture. Ownerless older 2D gameplay previews retain their own controls and provide radio Back to the editor. Neither limitation is hidden as complete radio support.

## Verification

The final integrated run passed **439/439 tests**, with no failures, skips or cancellations. It covers radio profiles, six-switch setup and runtime, menu ownership, both application hosts, playback, Advanced practice and shared Studio tools. Targeted lint and whitespace checks passed. Generated presentation assets, play shell and reaction runtime match their source generators.

Evidence: [test output](evidence/fpv-combat/radio-six-switch-tests.log), [package measurements](evidence/fpv-combat/radio-six-switch-packages.json), and [local setup screenshot](evidence/fpv-combat/radio-six-switch-setup.png).

| Package | Runtime files / bytes | Source files / bytes | Input bytes / limit |
| --- | --- | --- | --- |
| Flight gym | 95 / 3,795,556 | 97 / 3,830,416 | 5,024,657 / 8,388,608 |
| FPV Academy | 145 / 12,071,848 | 147 / 12,113,799 | 13,286,411 / 13,303,808 |
| FPV Worlds | 208 / 19,271,412 | 210 / 19,321,640 | 20,463,547 / 20,971,520 |

All measured packages remain within their existing policies. Worlds uses all 210 permitted source files; Academy has 17,397 bytes of input headroom. These are working-tree candidates with synthetic commit/tree bindings, not published or release-qualified packages.

Physical testing of the new six-switch layout remains pending; previous flight/Fire confirmations do not qualify every new binding or preset. The local setup screenshot was captured without connected hardware.

## Workspace and storage

Work stayed in the isolated task workspace. Existing source changes and saved browser radio profiles were preserved. No publication or push was performed.

To allow verification writes, cleanup removed only regenerable HTTP/code/download caches, source-backed Python bytecode, generated Apple help indexes, standard cached map icons and compiled Clang modules. No project source, Git commits, player storage, art sources or installed dependency source was removed. Disk space remains low.
