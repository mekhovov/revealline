# Controller preferences in player collections

The v0.13.0 working source uses `xonix-library.v2`, retaining its existing v1 migration, and adds `preferences.controllerBoostMode`. The earlier `preferences.controllerBindings` addition followed frozen v0.5.0, when the library format was v1. Both are input preferences: campaign, board, loadout, route, achievement, picture, score and replay identities do not change. Frozen releases remain unchanged.

An omitted `controllerBindings` in an older profile becomes `null` in the validated in-memory copy. `null` means use the runtime's standard controller defaults. Explicit configurations must be complete `xonix-controllerbindings.v1` documents accepted by the [controller bindings contract](controller-bindings-contract.md). The library retains `null` rather than serializing a copy of today's defaults.

For bindings, only omission receives this migration. An explicit `undefined`, false, string, array, partial object, unknown field/version, duplicate button assignment or invalid threshold is rejected. Accessors and prototype-pollution keys are rejected without invoking them. Reads and validation never rewrite the source profile; the normal successful save path persists a normalized copy.

## Solo Boost mode

`preferences.controllerBoostMode` accepts exactly `hold` or `toggle`. Only an absent own property in an accepted v1/v2 library receives default `hold`; explicit undefined, null, other types and malformed strings reject the candidate. It is a scalar separate from the complete binding document. No live latch, pending press or recovery state is accepted in preferences. See [Solo controller Boost](controller-boost.md).

```js
const selected = updatePreferences(library, { controllerBoostMode: 'toggle' });
const hold = updatePreferences(selected, { controllerBoostMode: 'hold' });
```

The existing per-key merge preserves a newer mode when a stale caller changes unrelated preferences; a deliberate Hold/Toggle edit takes effect. The app adopts the actual library returned by `saveLibrary`, refreshes its mode control/router and clears live input. Valid session-only edits remain in memory and exportable even if storage is unavailable. This does not change writer leases, generations, recovery journals or capacity limits.

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

Both paths normalize omitted bindings to `null` and omitted Boost mode to `hold`, preserve explicit valid preferences, keep original pack image bytes, and verify suspended-flight replays before adoption. No controller preference is added to a recorded command stream or checkpoint. Invalid preferences reject preparation before pack image decoding or destination adoption. The existing [complete-backup recovery journal and Undo](full-backup.md) still own coordinated storage writes. Import/Undo adopts mode metadata with the latch off. A standalone saved flight retains its existing session shape and restores under the current profile's controls; it cannot transport this setting or infer it from the replay's last Boost value.

Transfer is forward into a compatible newer reader. Frozen v0.12 and older strict readers reject the new `controllerBoostMode` field even when it is `hold`; older binding-era readers likewise reject a new `controllerBindings` field even when it is null. A new export is **not** a backward-compatible import for those versions. Preserve an older release's original collection or its original backup if you need to keep using it. Do not edit a portable file to claim backward compatibility or write new preferences into a frozen release's storage channel. Current earlier-release discovery supports the original v0.2.0 library channel onward; pre-library per-campaign progress is not newly migrated by this increment.

## Verification

```sh
node --test game/test/controller-boost-library.test.mjs game/test/controller-preference-library.test.mjs game/test/library.test.mjs game/test/backup.test.mjs game/test/profile-transfer.test.mjs
```

The suites cover omitted/default/configured states; owned portable and local roundtrips; strict rejection before writes; accessors without invocation; canonical and stale-write merging; old and configured complete backups; and read-only previous-release transfer. Boost fixtures pin original v0.2/v0.12 profile outputs and live-cut authority. Journal completion failures preserve exact prior bytes, and Undo restores the mode with a fresh generation. Real completed attempts and active cuts check that award records, artwork bytes and restored authoritative checkpoints survive. These are schema, storage and replay checks, not physical-controller certification or live settings-UI verification.
