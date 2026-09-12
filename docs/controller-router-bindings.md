# Router adoption of controller preferences

The current source router now adopts the [validated controller bindings document](controller-bindings-contract.md). This is the next P1 increment after frozen v0.5.0. Frozen assets, core rules, normalized replay commands and saved score identities remain unchanged.

## Integration API

```js
const controller = createControllerRouter({
  bindings: library.preferences.controllerBindings,
  readPads,
  eventTarget: window,
});

// After a complete settings draft has been accepted by the host:
controller.setBindings(candidate);
// Successful adoption returns undefined and waits for a neutral sample.
// Invalid settings throw before changing the active maps or input history.
```

`bindings` accepts a complete `xonix-controllerbindings.v1` document, null or undefined. A legacy omitted preference resolves to the existing default map. `setBindings(null)` and `setBindings(undefined)` restore the standard defaults with equal 0.35 press/release thresholds. A disposed router rejects adoption and continues to return neutral disposed samples without reading hardware.

The host continues to call `sample({ scope, timeMs })` once per rendered frame. Exactly `scope === 'flight'` selects the flight map; every other valid scope selects the menu map. The output shape is unchanged: `{ flight, ui, status, assigned, disconnected }`. The app still owns semantic scope selection, pause/display behavior and translation of a scoped UI action into existing DOM handlers.

Configuration validation and copying run on construction or `setBindings`, before installing event listeners or mutating current routing state. The router compiles its own button maps, digital priorities, selected axes, inversion flags and scalar thresholds. Sampling reads these compiled values and obtains one `readPads()` snapshot per call; it does not revalidate the settings document for each frame/button. Changes to caller-owned configuration objects after adoption cannot affect the running router.

## Default and constructor compatibility

| Setting | Result |
| --- | --- |
| No `bindings` document and no `deadZone` option | Existing default buttons, left stick, strict `> 0.35` activation/release. |
| `bindings: null` or omitted, with valid legacy `deadZone: 0.5` | Existing default maps with equal 0.5 press/release thresholds. |
| Explicit validated `bindings`, plus a valid legacy `deadZone` | The document's thresholds are authoritative; the legacy option does not override it. |
| Any invalid legacy `deadZone` | Construction rejects as before, even if a document was also supplied. |
| Later `setBindings(null)` | Standard 0.35 defaults; the constructor-only legacy override is not reapplied. |

The legacy option retains its existing finite 0.10–0.60 bounds. Repeat timing keeps the existing 350 ms initial delay, 120 ms subsequent interval and bounded configurable ranges. It uses elapsed time and emits at most one directional repeat per sample, with no catch-up burst after a stall.

Flight buttons still produce held Ability, Pickup and Boost signals for the input adapter. Pause, Hangar and Stop remain edges with that priority; a special action suppresses all same-frame equipment/direction output and clears the router. Menu remains edges with Menu, Back, Confirm priority. The opposite context always receives neutral commands. Configured digital directions win over the selected stick, using up, right, down, left priority. Analog magnitude ties still favor vertical.

## Atomic updates and neutral release

A valid adoption retains the selected connection and its generation, installs all settings at once, and clears button edges, join-edge history, directional repeat state, and per-connection/per-context analog activity. The router then waits for a complete physical neutral sample. That sample itself emits no command. A subsequent fresh input can act through the new map.

A rejected candidate leaves the prior compiled settings, controller assignment, blocked state, held-button edge history, repeat deadline and analog hysteresis intact. It does not read hardware or invoke any game/UI callback. The app should retain its prior settings draft/profile on validation failure and show the returned error through its existing status UI.

The neutral check includes the union of:

- Every mapped button in **both** contexts, including buttons unused by the current scope.
- Fixed physical join buttons **0, 1, 2, 3 and 9**, even if the player remaps their normal actions elsewhere.
- Both contexts' enabled selected sticks, each at or below the configured **release** threshold.

This gate deliberately uses the release threshold after clearing analog state. With press 0.35/release 0.25, holding a stick at 0.30 does not unblock a remap, scope change or pause. Returning to 0.25 or below supplies a neutral sample; returning afterward to 0.30 stays inactive until the magnitude exceeds 0.35. Equal default thresholds preserve the existing neutral behavior exactly.

Within an active scope, each connection/context uses explicit analog history: inactive sticks require magnitude above press; active sticks remain active only above release. A context with `stick.enabled: false` contributes no analog movement or analog blocking, and its mapped direction buttons continue to work. If the other context still enables that same stick, it still participates in the shared neutral gate.

`clear()` remains the host's input-release boundary for pause, Stop, scope changes, focus/visibility loss and similar interruptions. It retains assignment but resets analog history and requires neutral. `invalidate()` and selected-connection loss additionally require deliberate rejoining. Descriptor replacement or a reused connection slot receives a fresh generation and cannot inherit another pad's active threshold state. Disconnection of an unrelated pad leaves the selected connection intact.

Joining stays on fixed physical controls, independent of configurable menu Confirm. This keeps the existing deliberate ownership handshake accessible after a remap: observe neutral, press a face button or physical Menu, release, then use the configured menu action. The join press never emits a menu or flight command. No device brand is inferred and no browser trusted activation is manufactured.

## Verification

```sh
mise exec node@22.22.2 -- node --test \
  game/test/controller-bindings.test.mjs \
  game/test/controller-router.test.mjs \
  game/test/controller-router-bindings.test.mjs
```

The combined suite contains 19 bindings tests, 16 existing router tests and 21 adoption tests. It covers all remapped actions, flight/menu isolation, fixed join controls, selected/inverted sticks, digital and special-action priorities, exact hysteresis boundaries, reset causes, both-context neutrality, enabled/disabled analog input, atomic failure, mutable caller data, one hardware read, repeat reset, legacy options, analog buttons and connection replacement. Existing tests compare unchanged default actions and exact 0.35/tie behavior against the live router.

These are automated routing tests. Settings UI/persistence adoption, real controller practice, physical hardware, native host behavior and browser activation restrictions require their own evidence. This change does not implement capture modes, toggle steering/boost, couch ownership changes or Replay Theater navigation.
