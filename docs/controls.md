# Keyboard and touch preferences

Open **Settings → Keyboard controls** in solo play. Choose Arrows + WASD, Left hand or Right hand, or choose Change beside an action and press its new key. The assignment takes effect only after validation. Each key belongs to one action; the file format supports 1–4 aliases per action, while the capture UI replaces that action's aliases with one key. Remapping Pause retains Escape as an additional fallback.

Escape or Tab cancels capture. Tab keeps normal focus navigation. Clicking another settings control, closing the dialog, losing focus or choosing Cancel also keeps the old mapping. Modifier combinations, text composition and native navigation/activation/system keys cannot be captured. Restore default keys returns to the standard preset.

| Action | Standard | Left hand | Right hand |
|---|---|---|---|
| Move | Arrows + WASD | WASD | IJKL |
| Ability | E | E | O |
| Supply | R | R | U |
| Boost | Either Shift | Left Shift | Right Shift |
| Hangar | G | F | H |
| Stop | X | X | M |
| Pause | Escape/P | Escape/Q | Escape/P |

Bindings use physical `KeyboardEvent.code` positions, with a legacy `key` fallback when code is unavailable. A KeyW label refers to the W position on a US keyboard, even when another layout types a different character there. On-screen action hints, hangar captions, direction tooltips, help and the arena accessibility description reflect the current map. The short action hint shows its first alias; help and tooltips include other aliases.

Keyboard movement and boost remain held controls. Tap steering affects the on-screen direction/boost controls: tap to latch, tap again or Stop to release. Its explicit choice now persists across reloads and portable player backups. The initial `tapSteering:null` preference uses the device's coarse-pointer default; true/false records a player's explicit override. Old profiles migrate additively without discarding earned progress.

Keyboard presets/remaps and the tap override travel with player-library and complete-backup files. A practice preview or a second non-writing game tab keeps changes in its session and reports that persistence is unavailable; export that session before closing if it should be retained. Imported preferences clear held input before adoption. Replay files store normalized game commands, so playback does not depend on the viewer's keyboard map.

Couch play retains its separate two-player keyboard layout. Standard controller buttons remain fixed in this iteration. Arbitrary controller remapping, OS-level key labels and physical assistive-device certification are not implemented by these keyboard settings.

## Runtime boundary

`game/key-bindings.mjs` owns bounded validation, presets, labels, physical-key classification and an optional pure held-key state helper. `game/ui/input.mjs` combines the active map with pointer/controller input; releasing a held key works even after focus moves to an editor or modifiers change. `game/ui/key-settings.mjs` owns capture UI and uses callbacks for persistence. `game/library.mjs` validates and migrates preferences.

Do not put bindings into map rules or alter simulation outcomes for an input preference. The tests reconstruct identical gameplay checkpoints from equivalent commands under default and remapped controls in both steering policies. Run `npm test` and `npm run lint`, then verify capture, cancellation, active play, reload and saved-library transfer through the real UI.

This follows the practical value of presets plus custom mappings described in [Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/allow-controls-to-be-remapped-reconfigured/). That recommendation does not substitute for testing with players who use assistive devices.
