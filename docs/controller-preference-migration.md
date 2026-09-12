# Controller preferences in player collections

The working source after frozen v0.5.0 adds `preferences.controllerBindings` to the existing `xonix-library.v1` player library. This is a preference migration; campaign, board, loadout, route, achievement, picture, score and replay identities do not change. Frozen releases remain unchanged.

An omitted field in an older profile becomes `null` in the validated in-memory copy. `null` means use the runtime's standard controller defaults. Explicit configurations must be complete `xonix-controllerbindings.v1` documents accepted by the [controller bindings contract](controller-bindings-contract.md). The library retains `null` rather than serializing a copy of today's defaults.

Only omission receives this migration. An explicit `undefined`, false, string, array, partial object, unknown field/version, duplicate button assignment or invalid threshold is rejected. Accessors and prototype-pollution keys are rejected without invoking them. Reads and validation never rewrite the source profile; the normal successful save path persists a normalized copy.

## Updating a preference

```js
import { updatePreferences } from '../game/library.mjs';
import { resolveControllerBindings } from '../game/controller-bindings.mjs';

const config = resolveControllerBindings();
config.flight.buttons.ability = 4; // Unused left shoulder in the default flight map.
config.glyphFamily = 'playstation';
config.deadZone = { press: 0.45, release: 0.2 };
const candidate = updatePreferences(library, { controllerBindings: config });
// candidate and its nested config are owned copies; library/config are unchanged.
const reset = updatePreferences(candidate, { controllerBindings: null });
```

There is no new library API or storage key. `emptyLibrary`, `importLibrary`, `loadLibrary`, `validateLibrary`, `updatePreferences`, `mergeLibraries`, `saveLibrary` and `exportLibrary` use the same signatures. `DEFAULT_PREFERENCES.controllerBindings` is `null`. A normal settings patch cannot introduce unknown controller data; validation precedes profile and corruption-recovery writes.

Preference merging treats the complete controller configuration as one value. Deep canonical equality distinguishes a deliberate edit from an unchanged clone, regardless of JSON property order. An unrelated stale volume/music edit preserves a newer remap. A deliberate mapping, glyph or threshold edit adopts that editor's entire valid controller configuration; nested settings from competing edits are not combined. A deliberate `null` reset also takes effect. Hosts still need the existing writer lease, backup lock, adopted baseline and generation contract described in [library and packs](library-and-packs.md).

## Backups and previous-release transfer

Use **Export complete backup** in an older game, then import it in the newer game. On the same origin, the newer release's **Bring progress from an earlier release** workflow can prepare the same collection under the source's locks; see [collection transfer](continuity-transfer.md). The destination validates and copies the data. It never upgrades the older release's stored bytes in place.

Both paths normalize an omitted controller preference to `null`, preserve an explicit valid configuration, keep original pack image bytes, and verify suspended-flight replays before adoption. No controller preference is added to a recorded command stream or checkpoint. Invalid preferences reject preparation before pack image decoding or destination adoption. The existing [complete-backup recovery journal and Undo](full-backup.md) still own coordinated storage writes.

Transfer is forward into a compatible newer reader. Older frozen strict readers reject the new preference field even when its value is `null`; a new export is **not** a backward-compatible import for those versions. Preserve an older release's original collection or its original backup if you need to keep using it. Do not edit a portable file to claim backward compatibility or write new preferences into a frozen release's storage channel.

## Verification

```sh
node --test game/test/controller-preference-library.test.mjs game/test/library.test.mjs game/test/backup.test.mjs game/test/profile-transfer.test.mjs
```

The new focused suite covers omitted/default/configured states; owned portable and local roundtrips; strict rejection before writes; accessors without invocation; canonical and stale-write merging; old and configured complete backups; and read-only previous-release transfer. Real completed attempts and an active grid-center cut check that award records, artwork bytes and restored authoritative checkpoints survive. These are schema, storage and replay checks, not physical-controller certification or live settings-UI verification.
