# Native FPV simulator presentation

World Studio and the original Academy now share the main game's FPV / LINE
identity, field-kit palette, pixel headings, readable EN/UK body text, menu icons
and opt-in interface sounds. This is a presentation and navigation increment;
the fixed-step flight models and existing proof formats remain unchanged.

## Player experience

World Studio opens on the main game's illustrated FPV hangar with **Start flying**,
**Choose a world** and **Set up your radio**. The four destinations are **Fly**,
**My playlists**, **Workshop** and **Library**. The catalogue presents a world shelf
and one selected world's challenges, retaining search, filters, demonstrations,
free flight and playlist actions. All 60 challenges remain available.

Settings are available before entering a flight. They use the same live controls
as the flight settings, so radio selection, mode, camera, appearance and display
preferences cannot diverge between duplicate forms. Plain typography and reduced
menu motion are available. Settings changes remain paused; the drone does not
arm when a radio switch changes while a settings surface is open.

Flight views prioritize the scene, objective, instruments and live sticks.
Secondary camera and display controls are grouped under **Flight options**.
Fullscreen retains radio setup, pause, explicit resume and exit. Result panels
provide **Fly again**, **Next flight** where applicable, and **Back to lobby**,
alongside the existing proof and replay actions. Focus returns to the selected
world after leaving a flight; switching lobby sections resets their scroll.

The Academy uses the same visual treatment with a compact flight toolbar,
labelled mode/source controls, an options drawer, persisted stick visualization,
and grouped flight-guide, notebook, workshop and offline tools. Its standalone
package does not advertise a World Studio page that it does not contain.

## Shared assets and implementation

| Source in the main game                                 | Simulator use                                  |
| ------------------------------------------------------- | ---------------------------------------------- |
| `game/ui/field-kit-tokens.css`                          | Shared palette and interface tokens            |
| `game/ui/native-menu-icons.mjs`                         | Same pixel menu icons, through `data-sim-icon` |
| `game/ui/art/identity/fpv-line/wordmark.png`            | World Studio identity                          |
| `game/ui/art/menu-scenes/fpv.webp` and portrait variant | Responsive lobby artwork                       |
| Exo 2 and Departure Mono local WOFF2 files              | Readable text and pixel headings               |
| `game/audio/effects/{focus,confirm,cancel}.wav`         | Same focus, confirmation and cancel cues       |

`sim-presentation.mjs` is the common adapter for both simulator hosts. It owns
icon decoration, reference-counted local font registration and menu sound
lifecycle. Audio starts only after player opt-in and a trusted interaction;
pause/resume is idempotent and disposal releases its resources. Remembered audio
preferences still respect browser gesture requirements. Existing world ambience
and flight audio remain on the existing runtime audio path.

To retain the Academy's 64-file limit, the two fonts and three short cues are
embedded byte-for-byte in the adapter. Their upstream paths, hashes and licenses
are recorded. Run `node scripts/refresh-fpv-presentation-assets.mjs --check` to
verify identity, or run without `--check` after an intentional upstream asset
change. Both source archives include the required font license texts.

`world-renderer.mjs` supplies the optional GLTFLoader and TransformControls to the
existing renderer. The Academy no longer includes World-only loaders and editing
dependencies. The shared renderer, radio calibration, fullscreen helper, scoring,
recordings and existing import/editor components continue to provide behavior;
this change does not replace them with a new engine.

## Verification and delivery

The accompanying `fpv-native-sim-ui-verification.json` records functional browser
checks, source/runtime package closure checks and exact playtest build identities.
Checks cover EN/UK desktop/mobile layouts, radio and keyboard flight, settings,
playlists, results, replay, creator edits, actual gizmo dragging, GLB imports,
fullscreen nesting, offline fonts/artwork/audio and the Stadium integration.
The Stadium playtest retains all 88 demonstration records byte-for-byte.

Radio checks use controlled Gamepad API fixtures. They do not constitute new
physical-radio calibration acceptance. Result-button checks use a short authoring
fixture and do not claim medal calibration. No new unit coverage was added;
that remains in final qualification as requested. These are development playtests,
not release-qualified packages or measured hardware performance results.

The original package limits remain 64 files / 8 MiB for Academy and 96 files /
16 MiB for World Studio. Runtime and editable source closures are checked.
Publication remains subject to exact-head protected checks, stack requirements
and the separately tracked public site-size repair in `fpv-continuous-delivery.md`.
