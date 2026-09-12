# Controller settings

Open **Settings → Controller settings**, then **Edit controller settings**. Changes remain a draft while the currently applied controls continue to work. This lets you swap two buttons without saving an intermediate conflicting map.

- **Button label family:** choose position names, Xbox names or PlayStation names. These are player-selected labels; the game does not infer hardware identity or change physical mappings when you change them.
- **Flight and menu button maps:** assign one physical button index 0–15 to every action. Every action is required. A button can be reused in the other context, but two actions in the same context cannot share it. System/home button 16 is reserved. Only standard Gamepad API mappings are supported.
- **Stick controls:** independently enable stick input in flight and menus, choose horizontal/vertical axes 0–3 and invert either direction. Standard left stick uses 0/1; right stick uses 2/3. Disabling a stick leaves the configured directional buttons available. Axis choices must remain distinct, even while that stick is disabled.
- **Dead zone:** Press starts stick movement; Release keeps an active stick engaged above a lower threshold. Press is 0.10–0.60; Release is 0.02–0.60 and cannot exceed Press. Defaults use 0.35 for both. Equal thresholds preserve one activation boundary; a lower release threshold adds hysteresis. These are shared settings, not a live hardware-calibration result.

**Apply controller settings** validates the whole draft, then asks the app to adopt it and clear held input. Invalid maps stay in the editor with explicit issues; the active map is unchanged. **Cancel draft** discards edits. **Restore defaults in draft** also requires Apply. The collapsible sections use ordinary selects, checkboxes and sliders, so keyboard/touch and the existing controller choice editor can operate them.

The old menu bindings operate the editor until Apply succeeds. Release controls after applying, then use the new bindings. Keyboard and touch remain available to recover from a valid but inconvenient mapping. A failed persistent save can still apply the map to the current session; the status reports the host's session-only warning. Practice and other non-writing sessions must retain their existing storage limits. The editor does not write directly to local storage or create a new profile channel.

Closing/reopening Settings, importing preferences or another explicit host `refresh()` discards an old draft. An external source change is also checked before edits or Apply; it cannot be overwritten by an obsolete draft. Applying is single-flight. Controls are disabled while the host callback is pending; this editor does not offer rollback of an already completed Apply.

## Maintainer contract

[controller-settings.mjs](../game/ui/controller-settings.mjs) exports:

```js
const controllerSettings = attachControllerSettings({
  container: document.getElementById('controller-settings-root'),
  document, // optional, defaults to globalThis.document
  getBindings: () => library.preferences.controllerBindings,
  onBeforeEdit: () => keySettings.refresh(),
  onApply: (canonicalConfig, { signal, isCurrent }) => {
    // The app validates/adopts preferences, updates router bindings, clears
    // cached input and refreshes visible prompts. This example is a contract,
    // not a second persistence implementation.
    return applyThroughExistingPreferences(canonicalConfig);
  },
});
```

The returned API is `{refresh, destroy}`. Attaching renders current settings but invokes no adoption or before-edit callback. `onBeforeEdit` runs when an explicit Edit starts; it can cancel competing keyboard capture. `getBindings()` returns the existing versioned binding preference or `null` for defaults. The editor uses [controller-bindings.mjs](../game/controller-bindings.mjs) for resolution, labels and complete-candidate validation, and calls no hardware sampler.

`onApply` receives an owned canonical configuration. It must adopt through the host's existing preference/router lifecycle before resolving. A return value of `{ok:false, warning}` means **session adoption succeeded but persistence did not**; the warning is displayed as text. Throwing means rejection and should leave the previous host configuration intact. A successful synchronous callback changing `getBindings()` to the candidate is recognized as its own adoption, not an external stale draft.

The optional second argument is a future asynchronous guard. If a host awaits work, it must check `signal.aborted`/`isCurrent()` immediately before committing side effects. Refresh, source change and destruction invalidate the ticket or its freshness. The UI prevents stale completion feedback and repeated Apply; it cannot undo writes from a host that ignores its guard. Even after invalidation, another Apply waits for the old host promise to settle. Current root integration uses synchronous adoption.

Root integration owns the mount/CSS link, Settings open/close refresh, profile-adoption refresh, router binding changes, input clearing, visible action labels and destruction. A preview must remain practice after settings or campaign changes. Preserve both steering policies and existing normalized replay commands; bindings are not map rules or body statistics.

Stable DOM hooks are `data-controller-settings-action="edit|apply|cancel|defaults"` and `data-controller-setting`, for example `flight.buttons.ability`, `menu.stick.enabled` or `deadZone.press`. All content uses DOM text; button choices are indices rather than executable expressions. The companion [stylesheet](../game/ui/controller-settings.css) provides minimum 44 px controls and collapsible sections that fit a phone layout.

## Checks and limits

```sh
node --test game/test/controller-settings.test.mjs
```

The focused tests exercise complete canonical adoption, temporary conflicts/swaps, invalid values, defaults/Cancel, truthful labels, session-only warnings, host rejection, source changes, refresh invalidation, pending async guards, single-flight Apply, focus restoration and disposal. Run binding, router, navigation, input and affected preference/backup tests for integration changes.

Then inspect the actual Settings journey at desktop and phone sizes: open each section, draft a swap, cancel, commit, release, verify the new controls, restore defaults and reopen. Controller practice exercises real UI with simulated input, but its four-axis virtual pad demonstrates configured stick selection and inversion without certifying right-stick hardware or physical jitter. Each Apply sends neutral first; continuous hysteresis is covered by pure/router sequence tests rather than separate slider applications. Real device mappings, native app interaction and browser activation still need the corresponding controller/host evidence. See [Controller practice](controller-practice.md) and [the controller plan](round-15-controller-plan.md).
