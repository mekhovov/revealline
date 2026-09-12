# Solo controller Boost

Implemented in the **v0.13.0 working source**. The latest frozen release remains v0.12.0, whose controller Boost still uses Hold. This guide describes source behavior and software checks; browser, physical-controller and native-device verification are separate evidence.

Open **Settings → Solo controller Boost** and choose **Hold** or **Toggle**. This select is separate from **Edit controller settings** and its button-map draft. A native selection applies immediately; controller navigation previews until Confirm, while Back cancels. Choosing Hold resets this option. Restoring the binding draft's defaults changes its mappings, not this separate setting. Editing pauses an active flight, and resuming remains a separate action.

**Hold is the default:** keep the configured flight Boost button pressed. **Toggle:** press that button once to turn controller Boost on, release it, then press again to turn it off. Holding one press across many frames causes one change. During a joined, running flight, the cue reads **Controller Boost on · [mapped label] to turn off**, or the corresponding off/on text. Elsewhere it shows status without an action instruction, since the same button can have a menu role. The cue uses the applied layout's label and appears only in Toggle mode. It describes requested input; terrain, grace or lack of direction can still prevent boosted movement.

This applies to solo play, Playground's solo preview and Controller practice. It works with both steering policies and existing classes. Direction still requires a hold. Couch keeps its separate Hold controls; Replay Theater plays recorded inputs.

## Stops, recovery and mixed inputs

Stop, pause, menu/hangar/reader entry, successful mode or binding adoption, attempt replacement, import/restore, controller loss and page/native lifecycle interruption clear the toggle. Returning to flight never restores it. Release mapped controls and enabled movement sticks before a fresh Boost press; the first joining gesture cannot also activate Boost.

Losing a life, absorbing a contact with a shield and Impact redeployment also clear Toggle Boost. Presses made while recovering do not queue a toggle for the return. A later eligible neutral sample and new press are required. Successfully closing a line or reaching safe ground does not switch it off.

Keyboard and touch Boost remain independent. A second controller press switches off only the controller contribution; a held keyboard Boost key or existing touch latch can still request Boost. The visible Boost button's pressed state combines all sources. Deliberate global Stop and lifecycle clears retain their existing all-input behavior. Default Hold behavior during recovery remains unchanged.

## Save and transfer the preference

The strict library member is `preferences.controllerBoostMode`, accepting only `hold` or `toggle`. Older accepted libraries that omit it normalize to Hold in an owned copy. Explicit null, undefined, malformed strings, other types and extra latch fields reject before adoption. The library remains `xonix-library.v2`, with its existing v1 migration; the separate `xonix-controllerbindings.v1` document is unchanged.

The normal saved setting persists on this device. Practice, secondary tabs and unavailable storage can keep a valid selection in memory; the status says **Session only**. Export the player library or a complete backup to retain it. Imports and Undo adopt the validated resulting mode and clear live input. Successful merge writes use the actual returned preference, so an unrelated stale audio edit cannot silently reset a newer mode.

Transfer is **forward into a compatible newer reader**. Frozen v0.12 and other strict older readers reject a new export containing `controllerBoostMode`, even when it is Hold. Keep their original collection or backup for returning to those releases. Do not strip fields or rewrite an older release's storage to imply backward compatibility. See [controller preference migration](controller-preference-migration.md) and [complete backups](full-backup.md).

Only the mode is saved; the active toggle is never serialized. A saved flight contains its replay/setup, not this preference. Restoring it uses the current profile's mode with released input, not its recording's last Boost value. Core, map, class, replay, session and mastery identities remain unchanged for equal canonical command streams.

## Integration and verification

[`controller-boost.mjs`](../game/controller-boost.mjs) owns the strict enum. The [router](../game/ui/controller-router.mjs) exposes `setBoostMode`, `boostState` and `cancelToggleBoost`, with `sample({toggleBoostEligible})` supplied from actual run state. It still reads hardware once per sample. The cancellation method is a Hold no-op; in Toggle it disarms only Boost, retaining controller ownership, other action edges and menu navigation.

The [host helper](../game/ui/controller-boost-host.mjs) cancels a running→respawning transition before the next fixed tick. It replaces only the remaining frame's controller contribution with `input.localBoostActive()`. It does not repoll input, erase local holds, drop elapsed time, insert a recorded release or rewrite the command that caused recovery. The input adapter's `onClear` callback uses the same narrow cancellation, never recursively calling `input.clear()` or `clearInput()`.

Run the relevant suites:

```sh
node --test game/test/controller-boost*.test.mjs game/test/controller-router*.test.mjs game/test/ui-input.test.mjs
```

The 27 focused recovery cases exercise real router→input→core behavior: both steering policies, three recovery causes, a legal 0.1-second recovery ending inside a 0.25-second frame, mixed local sources, exact command recording and unchanged Hold checkpoints. Other suites cover settings callbacks, strict migration, source preservation, merges, full backups and Undo. These are subsets of the eventual source gates, not extra totals or physical-device evidence.

Use [Controller practice](controller-practice.md) for the visible Settings/join/Boost/Stop/recovery/reader journey. Its **Release all · buttons + sticks** releases physical inputs; ordinary release alone leaves a live Toggle on. A parent control may separately blur and pause the game, which clears the toggle. Record that focus change rather than attributing it to release semantics.
