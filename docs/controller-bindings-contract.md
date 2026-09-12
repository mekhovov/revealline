# Controller preferences contract

The working source after frozen v0.5.0 now adopts this contract in the solo router, Settings editor and player library. The proposed next release is v0.6.0; this guide does not claim that release is frozen or its browser/device acceptance is complete. Frozen v0.5.0 retains its original controls. [The bindings module](../game/controller-bindings.mjs) validates settings, returns canonical copies, supplies configured labels and defines stick hysteresis.

## Canonical document

```json
{
  "version": "xonix-controllerbindings.v1",
  "mapping": "standard",
  "glyphFamily": "generic",
  "flight": {
    "buttons": {
      "up": 12,
      "down": 13,
      "left": 14,
      "right": 15,
      "ability": 0,
      "pickup": 2,
      "boost": 5,
      "hangar": 3,
      "stop": 1,
      "pause": 9
    },
    "stick": {
      "enabled": true,
      "xAxis": 0,
      "yAxis": 1,
      "invertX": false,
      "invertY": false
    }
  },
  "menu": {
    "buttons": {
      "up": 12,
      "down": 13,
      "left": 14,
      "right": 15,
      "confirm": 0,
      "back": 1,
      "menu": 9
    },
    "stick": {
      "enabled": true,
      "xAxis": 0,
      "yAxis": 1,
      "invertX": false,
      "invertY": false
    }
  },
  "deadZone": {
    "press": 0.35,
    "release": 0.35
  }
}
```

Every field shown is required in a supplied document. At the bindings API, `null` and `undefined` alone mean the existing default layout; an empty or partial object is invalid. The player library retains explicit `null` and migrates an omitted preference to null, but rejects an explicit `undefined`. Missing fields inside a supplied document never receive defaults. JSON strings must be parsed by the importing boundary before calling the bindings API.

The configuration boundary accepts only plain own data, with ordinary or null prototypes. It rejects inherited custom prototypes, getters, setters, `toJSON` functions, hidden fields, symbol keys, prototype-pollution keys, cycles, nonfinite numbers and unknown properties. The bounded copy allows 8 KiB, 128 nodes, depth four, no array items and strings up to 64 characters. Resolved copies have fixed field order, ordinary object prototypes, normalized numeric zero and independently owned nested objects. The exported default and action/glyph metadata are immutable.

| Field                            | Allowed values and meaning                                                                                      |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `version`                        | Exactly `xonix-controllerbindings.v1`. Unknown versions reject the whole document.                              |
| `mapping`                        | Exactly `standard`; no inferred device mapping.                                                                 |
| `glyphFamily`                    | `generic`, `xbox`, or `playstation`, chosen by the player. Changes labels only.                                 |
| Context `buttons`                | One integer index from 0 through 15 for each named action. Complete unique maps within each context.            |
| `stick.enabled`                  | Boolean; false selects button-only directions in that context.                                                  |
| `stick.xAxis`, `stick.yAxis`     | Distinct integer indices 0 through 3. Left stick is 0/1, right stick 2/3; swapped/custom pairs remain explicit. |
| `stick.invertX`, `stick.invertY` | Booleans, independent per context.                                                                              |
| `deadZone.press`                 | Finite magnitude from 0.10 through 0.60 inclusive.                                                              |
| `deadZone.release`               | Finite magnitude from 0.02 through `press` inclusive.                                                           |

The flight and menu maps can reuse the same physical button because only one context receives an input sample. Within a context, duplicate assignments reject the entire candidate, including duplicates between movement and other actions. This prevents an Ability remap from simultaneously moving the craft or altering menu Confirm. A deliberate two-button swap is submitted as one complete candidate. A single-action capture does not silently swap or unbind another action.

System/home index 16 is reserved by this product contract. It may be described in a capture message, but cannot carry a required action. This is a conservative host-interaction choice, not a claim that every browser blocks that button. Additional buttons, paddles, chords, analog button tuning, haptics and nonstandard layouts are outside v1. Movement remains hold-to-move and Boost remains hold-to-boost; toggle properties are rejected until their latch/reset behavior is implemented and versioned.

## API

```js
import {
  resolveControllerBindings,
  validateControllerBindings,
  replaceControllerButtonBinding,
  controllerActionForButton,
  controllerBindingLabels,
  controllerButtonLabel,
  controllerStickLabel,
  sampleControllerStick,
} from '../controller-bindings.mjs';

const original = resolveControllerBindings(null);
const candidate = replaceControllerButtonBinding(original, 'flight', 'ability', 4);
const result = validateControllerBindings(candidate); // { valid: true, errors: [] }
const labels = controllerBindingLabels(candidate);
// labels.flight.ability === 'Left shoulder'
// labels.menu.confirm === 'South'
controllerActionForButton(candidate, 'flight', 4); // 'ability'
controllerActionForButton(candidate, 'menu', 4); // null
controllerButtonLabel(0, 'playstation'); // 'Cross (×)'
controllerStickLabel(candidate, 'flight'); // 'Left stick'
```

`resolveControllerBindings(source)` throws `TypeError` for invalid documents and returns a fresh complete copy for valid ones. `validateControllerBindings(source)` returns `{ valid, errors }` without changing the candidate. `replaceControllerButtonBinding(source, context, action, index)` returns a newly validated document or throws while leaving the old object intact. Contexts are exactly `flight` and `menu`.

`controllerBindingLabels(source)` returns `{ flight: { action: label, ... }, menu: { action: label, ... } }` for the button assignments. `controllerStickLabel(source, context)` describes analog selection/inversions separately. All labels are plain text for `textContent`; the family is not detected from hardware names. An unsupported family passed directly to `controllerButtonLabel` falls back to generic presentation; the same unsupported family inside a configuration document is an error. Unknown button indices return `Unknown button` in the label helper and `null` in the action lookup.

The constants `CONTROLLER_BINDINGS_VERSION`, `DEFAULT_CONTROLLER_BINDINGS`, `CONTROLLER_GLYPH_FAMILIES`, `CONTROLLER_BINDING_ACTIONS`, `CONTROLLER_ACTION_LABELS` and `CONTROLLER_DIRECTION_PRIORITY` expose the schema's fixed metadata. Direction priority remains up, right, down, left when more than one digital direction is pressed.

## Exact threshold and release behavior

```js
const settings = resolveControllerBindings();
settings.deadZone = { press: 0.35, release: 0.27 };

let active = false; // State belongs to the caller, separately per pad/context.
const next = sampleControllerStick(settings, 'flight', axes, active);
active = next.active;
// next === { x: normalizedX, y: normalizedY, active: boolean, direction: cardinalOrNull }
```

The helper reads only the configured axes, clamps finite values to −1…1 and treats missing/nonfinite values as zero. It applies inversion, then uses the larger absolute axis magnitude. A neutral stick activates only **above** `press`. An active stick remains active only **above** `release`; equality releases it. With the default equal thresholds, both states use the current router's exact strict `> 0.35` comparison. This intentionally differs from the earlier plan's proposal to enable a lower release threshold immediately.

With press 0.35 and release 0.27, the sequence `0.34 → 0.36 → 0.30 → 0.27 → 0.30` produces `neutral → active → active → neutral → neutral`. Passing `priorActive: false` resets that history. There is no internal state or time dependency. Disabling the stick always produces `active: false` and `direction: null`; normalized x/y remain available for a future calibration preview.

Once active, the stronger axis chooses the cardinal direction. Exact magnitude ties favor vertical, preserving the current router. This is magnitude hysteresis, not a sticky cardinal direction or diagonal filter. Configured digital directions take precedence in the adopted router; this stick-only helper does not arbitrate buttons. The helper does not read hardware, emit commands, detect edges, repeat menu actions, persist settings or alter any simulation rule.

## Adopted editor, router and library

Open **Settings → Edit controller settings**. The complete draft includes both button maps, per-context stick enable/axis/inversion controls, glyph family and press/release thresholds. Current controls remain active while editing. Temporary duplicate assignments may exist in the draft so a two-button swap is possible; **Apply controller settings** validates the entire candidate before adoption. **Cancel draft** discards it. **Restore defaults in draft** changes only the draft until Apply. The editor uses explicit selects, checkboxes and sliders; it does not listen for a physical-button capture or automatically calibrate a device.

Successful adoption updates the saved preference, compiled router mapping and visible prompts, then clears cached flight input and navigation edits. If saving is unavailable or the page is practice/session-only, the valid setting remains usable in that session and the UI identifies the persistence limitation. A fresh neutral sample is required before the new mapping can act. Invalid data leaves the previous mapping and stored collection intact. A draft whose source changes is discarded; import and Undo refresh the editor from the adopted library.

The [router adoption guide](controller-router-bindings.md) specifies the exact reset and threshold behavior. Its neutral gate covers both contexts' mapped buttons and enabled sticks plus fixed physical join indices 0, 1, 2, 3 and 9. Neutral uses the release threshold, even immediately after resetting hysteresis. Joining remains independent of remapped Confirm. The router compiles settings once at adoption and reads one device snapshot per sample.

The [preference migration guide](controller-preference-migration.md) covers omitted-only `preferences.controllerBindings: null`, owned validation, canonical whole-preference merging, backups and earlier-release copying. Portable libraries remain `xonix-library.v1`. New exports containing this field are not accepted by older frozen strict readers, including when the field is null; transfer forward into a compatible newer release rather than altering an old release's channel.

Normalized replay commands, physics and score identities remain unchanged. The [Controller practice lab](controller-practice.md) exercises the actual solo UI through a separate bounded virtual-input bridge. Its v2 snapshot carries four finite axes and up to sixteen boolean buttons. Both snapshot and status envelopes require a per-load `session` of exactly 32 lowercase hexadecimal characters matching the iframe's `controller-session` query; an old load's session cannot advance the new load's sequence counters. That transport is distinct from the v1 settings document. It is a simulated control source, not evidence of connected hardware or native calibration.

Couch ownership/menu integration, Replay Theater navigation, toggle controls, physical-button capture and host-dependent pickers/audio/export activation remain separate work. Polling a pad and calling DOM handlers cannot create trusted user activation. Physical controllers and native/browser targets require separate acceptance evidence.

## Verification and sources

Run the relevant suites with `mise exec node@22.22.2 -- node --test game/test/controller-*.test.mjs game/test/ui-input.test.mjs`. Contract tests cover defaults, flight/menu separation, exact stick boundaries, remap collisions, complete-schema validation, accessor/plain-data rejection, owned copies, glyph invariance, inversion and disabled analog input. Router, editor and library suites additionally cover atomic adoption, neutral gates, drafts, persistence failure, complete backups and previous-release transfer. Use [the layout prompts](../authoring/prompts/round-16-controller-layouts.md) for actual UI journeys and record their outcomes separately. Test counts alone are not browser or physical-device evidence.

The standard indices, normalized axes and separation of a browser mapping from a device identifier follow the [W3C Gamepad Working Draft, standard mapping](https://www.w3.org/TR/gamepad/#remapping), checked 12 September 2026. Remapping, updated input prompts, analog alternatives and hold alternatives are informed by [Xbox Accessibility Guideline 107](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/107), checked the same day. The bounded ranges, system-button reservation, context separation and compatibility choices above are this project's design decisions; neither source certifies them or measures a connected device.
