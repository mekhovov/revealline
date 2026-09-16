# Keyboard and touch preferences

## Current solo presentation

Settings offers **Text style → Theme font / Plain** independently of **Text size → Standard / Large**. Plain uses the device's sans-serif font for solo menus, dialogs, prompts and HUD text while retaining the dark pixel-art frame, colors and artwork. The selection is saved with the player library and portable backups; an older profile defaults to Theme font (the compatible stored `pixel` value) in memory without rewriting its stored data. A storage failure keeps the chosen font for this session and displays the existing save warning. Changing it during a paused cut never resumes or replaces that flight. Couch and separate authoring pages do not yet adopt this solo preference.

This optional alternative follows [Microsoft's text readability guidance](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/101). It does not establish full text-scaling or device accessibility certification.

Current Arcade movement uses continuous steering: tap a direction to start, release to keep moving, and tap another direction to turn. A completed cut stops at secured territory and awaits a fresh direction. Pause/Resume preserves the selected direction and queued turn; focus return never resumes automatically. On-screen steering uses Auto (touch only), Always or Off, with Left/Right placement outside the arena. The following historical binding contract remains relevant to archived and explicitly authored manual-control modes; it does not add Stop or manual class abilities to current Arcade chapters.

## D-pad clearance in short landscape

During a running flight in a landscape CSS viewport no taller than 600px, a shown D-pad reserves its full Regular (156px) or Large (192px) surface, the existing safe-area edge inset and a 12px gap beside the board. Left and Right placement use independent mirrored reserves. If actual equipment buttons are visible, their existing 160px action column receives the opposite reserve; Arcade does not acquire an empty equipment column.

The board keeps its complete aspect ratio and the existing Standard/Large header and bottom limits. The clearance changes horizontal center and maximum width, with the same rules during warning transitions. The D-pad reserve does not apply to paused flight, portrait, Off/hidden controls, Stick or Swipe. The shared running-panel correction below applies to all input methods in this landscape layout.

Verify both hands at an actual 844×390 CSS viewport, both touch sizes and text sizes, with and without visible equipment. Inspect the complete board, the four directional button centers and their hit ownership, warnings and safe-area insets. Record the measured content viewport; a named device preset or iframe size is not proof of a physical phone's touch comfort. Existing input and compact-classification tests do not measure the browser's CSS rectangles.

The running fullscreen panel also resets the inherited classic/open width cap, including when its status card is hidden. Native review at 844×390 with Large text found that Tactical retained an approximately 247px parent panel; subtracting both D-pad/equipment reserves collapsed its inner board to zero. Switching controls Off exposed the narrow parent in the same flight. The correction gives running classic/open panels the same full-viewport containing block as other running states while retaining the compiled inner-board header cap. Paused layouts stay unchanged. The failed D-pad view and Off diagnosis remain evidence of the defect; [fresh native checks](research/native-dpad-clearance/review.md) show the corrected full board with Right/Regular and Left/Large controls and visible opposite equipment. Broader warning/device checks remain open.

## Current keyboard capture

In **Settings → Controls → Keyboard controls**, choose a preset or select **Change** beside an action. While that control is listening, physical arrow keys are candidates for the binding; they must not navigate the menu. A valid assignment returns focus to the same Change action. A duplicate or reserved key leaves capture active with its validation message. Return and Space cannot become bindings or activate another action while listening.

Escape cancels capture and returns to its Change action without closing Settings. Tab cancels capture while retaining native focus traversal. After capture ends, menu arrows and native select/slider editing work normally. Remapping keeps the Ready or paused flight unchanged; it does not start or resume play. The [shared navigation contract](controller-navigation.md#keyboard-capture-ownership) explains this event boundary. This correction belongs to the unreleased v0.59.0 candidate; its final source and public gates remain in the [execution register](cross-mode-execution.md).

## Historical manual-control bindings

Open **Settings → Keyboard controls** in solo play. Choose Arrows + WASD, Left hand or Right hand, or choose Change beside an action and press its new key. The assignment takes effect only after validation. Each key belongs to one action; the file format supports 1–4 aliases per action, while the capture UI replaces that action's aliases with one key. Remapping Pause retains Escape as an additional fallback.

Escape or Tab cancels capture. Tab keeps normal focus navigation. Clicking another settings control, closing the dialog, losing focus or choosing Cancel also keeps the old mapping. Modifier combinations, text composition and native navigation/activation/system keys cannot be captured. Restore default keys returns to the standard preset.

| Action  | Standard      | Left hand  | Right hand  |
| ------- | ------------- | ---------- | ----------- |
| Move    | Arrows + WASD | WASD       | IJKL        |
| Ability | E             | E          | O           |
| Supply  | R             | R          | U           |
| Boost   | Either Shift  | Left Shift | Right Shift |
| Hangar  | G             | F          | H           |
| Stop    | X             | X          | M           |
| Pause   | Escape/P      | Escape/Q   | Escape/P    |

Bindings use physical `KeyboardEvent.code` positions, with a legacy `key` fallback when code is unavailable. A KeyW label refers to the W position on a US keyboard, even when another layout types a different character there. On-screen action hints, hangar captions, direction tooltips, help and the arena accessibility description reflect the current map. The short action hint shows its first alias; help and tooltips include other aliases.

Keyboard movement and boost remain held controls. Tap steering affects the on-screen direction/boost controls: tap to latch, tap again or Stop to release. Its explicit choice now persists across reloads and portable player backups. The initial `tapSteering:null` preference uses the device's coarse-pointer default; true/false records a player's explicit override. Old profiles migrate additively without discarding earned progress.

Keyboard presets/remaps and the tap override travel with player-library and complete-backup files. A practice preview or a second non-writing game tab keeps changes in its session and reports that persistence is unavailable; export that session before closing if it should be retained. Imported preferences clear held input before adoption. Replay files store normalized game commands, so playback does not depend on the viewer's keyboard map.

Couch play retains its separate two-player keyboard layout. Standard controller buttons remain fixed in this iteration. Arbitrary controller remapping, OS-level key labels and physical assistive-device certification are not implemented by these keyboard settings.

## Runtime boundary

`game/key-bindings.mjs` owns bounded validation, presets, labels, physical-key classification and an optional pure held-key state helper. `game/ui/input.mjs` combines the active map with pointer/controller input; releasing a held key works even after focus moves to an editor or modifiers change. `game/ui/key-settings.mjs` owns capture UI and uses callbacks for persistence. `game/library.mjs` validates and migrates preferences.

Do not put bindings into map rules or alter simulation outcomes for an input preference. The tests reconstruct identical gameplay checkpoints from equivalent commands under default and remapped controls in both steering policies. Run `npm test` and `npm run lint`, then verify capture, cancellation, active play, reload and saved-library transfer through the real UI.

This follows the practical value of presets plus custom mappings described in [Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/allow-controls-to-be-remapped-reconfigured/). That recommendation does not substitute for testing with players who use assistive devices.
