# Controller preferences contract

This is the isolated P1 foundation after the frozen v0.5.0 release. [The new module](../game/controller-bindings.mjs) validates controller settings, returns canonical copies, describes configured controls and defines pure stick hysteresis. The live router, settings UI and player-library schema have not adopted it in this increment. The frozen release retains its existing controls.

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

Every field shown is required in a supplied document. `null` and `undefined` alone mean the existing default layout; an empty or partial object is invalid. Missing fields inside a supplied document never receive defaults. JSON strings must be parsed by the importing boundary before calling this API.

The configuration boundary accepts only plain own data, with ordinary or null prototypes. It rejects inherited custom prototypes, getters, setters, `toJSON` functions, hidden fields, symbol keys, prototype-pollution keys, cycles, nonfinite numbers and unknown properties. The bounded copy allows 8 KiB, 128 nodes, depth four, no array items and strings up to 64 characters. Resolved copies have fixed field order, ordinary object prototypes, normalized numeric zero and independently owned nested objects. The exported default and action/glyph metadata are immutable.

| Field | Allowed values and meaning |
| --- | --- |
| `version` | Exactly `xonix-controllerbindings.v1`. Unknown versions reject the whole document. |
| `mapping` | Exactly `standard`; no inferred device mapping. |
| `glyphFamily` | `generic`, `xbox`, or `playstation`, chosen by the player. Changes labels only. |
| Context `buttons` | One integer index from 0 through 15 for each named action. Complete unique maps within each context. |
| `stick.enabled` | Boolean; false selects button-only directions in that context. |
| `stick.xAxis`, `stick.yAxis` | Distinct integer indices 0 through 3. Left stick is 0/1, right stick 2/3; swapped/custom pairs remain explicit. |
| `stick.invertX`, `stick.invertY` | Booleans, independent per context. |
| `deadZone.press` | Finite magnitude from 0.10 through 0.60 inclusive. |
| `deadZone.release` | Finite magnitude from 0.02 through `press` inclusive. |

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

Once active, the stronger axis chooses the cardinal direction. Exact magnitude ties favor vertical, preserving the current router. This is magnitude hysteresis, not a sticky cardinal direction or diagonal filter. Digital directions still take precedence in the future router integration; this stick-only helper does not arbitrate buttons. It also does not read hardware, emit commands, detect edges, repeat menu actions, persist settings or alter any simulation rule.

## Next integration boundary

1. Add `preferences.controllerBindings: null` to the next player-library preference schema and migrate only an **omitted** field to null. Validate an explicit value with `resolveControllerBindings` before persistence or adoption. Preserve semantic preference equality during concurrent library merges. Existing frozen readers reject unknown preference fields, so document transfers by source/target release instead of claiming newer profiles load into every older version.
2. Resolve a complete draft before changing the current runtime configuration. The router should install it atomically, clear pending edges/repeat history and previous stick activity, and require a neutral sample before accepting further input. Keep this reset on remap, scope transitions, pause, Stop, disconnect, focus loss and device reassignment. A rejected candidate must leave the previous settings and current session intact.
3. Update the router's fixed used-button/axis sampling to the selected configuration. Check neutrality against applicable mapped inputs and deliberate join controls; changing the map must not leak the capture press into an ability or Confirm. Keep the current explicit connection ownership and deliberate join behavior. Feed only one scope per sample, retain digital priority, and preserve the current pulse/held semantics in the flight adapter.
4. Add a settings capture/edit UI with cancel, restore defaults, both context maps, stick selection and a live preview of raw neutral versus active thresholds. Commit through existing preferences handlers once, then update help/focus prompts from the new labels. Button capture and a selected glyph family do not identify or certify a device.
5. Keep the existing normalized replay commands and rule/score identities. Remapping changes which physical input produces a command, not the command's simulation meaning. Add router, persistence and live controller-lab tests before enabling settings for players. Physical controllers and target browsers still need separate acceptance evidence.

No router, application, library, frozen release or replay schema is changed by this module. Couch ownership, Replay Theater navigation, toggle controls and host-dependent pickers/audio/export activation remain separate work from this data contract. Polling a pad and calling DOM handlers cannot create trusted user activation.

## Verification and sources

Run `mise exec node@22.22.2 -- node --test game/test/controller-bindings.test.mjs`. The **19 tests** cover full defaults against the actual v0.5 router, flight/menu separation, exact stick boundaries and tie precedence, remap collisions/atomic swaps, complete-schema validation, hostile accessor/plain-data cases, copy ownership, glyph invariance, hysteresis sequences, inversion, disabled analog input and malformed/missing axes. These are automated contract tests, not physical-device evidence.

The standard indices, normalized axes and separation of a browser mapping from a device identifier follow the [W3C Gamepad Working Draft, standard mapping](https://www.w3.org/TR/gamepad/#remapping), checked 12 September 2026. Remapping, updated input prompts, analog alternatives and hold alternatives are informed by [Xbox Accessibility Guideline 107](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/107), checked the same day. The bounded ranges, system-button reservation, context separation and compatibility choices above are this project's design decisions; neither source certifies them or measures a connected device.
