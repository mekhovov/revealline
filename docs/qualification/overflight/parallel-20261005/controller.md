# Overflight shared controller adapter — 2026-10-05

The native Overflight host now consumes the existing shared controller binding document and saved Solo radio setup. This is an input compatibility change; the simulation and renderer are unchanged by it.

- Standard gamepads keep saved button remaps, independent menu mappings, axes, inversions, hysteresis and glyphs. Only an absent binding document gets Overflight's RT dash default.
- The shared router owns connection identity, neutral admission, disconnect handling, modal scopes, menu repeat and action edges. The adapter preserves continuous two-axis flight values from the same hardware snapshot; it does not quantize movement into the router's grid direction.
- Raw devices require an exact saved shared radio profile. Unknown raw devices are ignored, including unmapped throttle and switch values. Split/two-seat setups are not silently reinterpreted as a single pilot.
- Shared raw-profile restoration stays read-only during both flight and menus. Overflight's Confirm cannot select or persist a Couch seat. No controller preference or calibration storage is written.
- Menu Confirm is a paired press/release transaction tied to the current scope and assignment. Resume, scope changes, reconnect, focus release and preference adoption require neutral before flight input. Dash remains momentary even if another mode uses a continuous boost toggle.
- The loader resolves the existing native release/edition library key. Corrupt preference data disables controller input rather than substituting defaults; keyboard remains available. Cross-tab changes to the same shared library are adopted through the existing storage event.
- EN/UK Start hints explicitly distinguish saved shared mappings from the mode defaults. Controller menu hints use the selected standard binding labels.

## Automated evidence

Synthetic snapshots cover saved boost remapping, alternate axes/inversion/hysteresis, simultaneous analog axes, mapped D-pad diagonals, one hardware read per sample, pause remapping, confirm-release transactions, upgrade-to-flight boost suppression, same-index identity replacement, disconnect/reconnect neutral gating, exact raw-profile restoration and rejection, unmapped radio controls, release/edition storage keys, corrupt data, read-only storage and listener cleanup.

Commands:

```sh
node --test game/test/overflight-controller.test.mjs game/test/solo-radio-input.test.mjs game/test/controller-bindings.test.mjs
node --test game/test/overflight-controller.test.mjs game/test/overflight-host.test.mjs game/test/overflight-upgrade-card.test.mjs game/test/modal-navigation.test.mjs game/test/controller-navigation.test.mjs > docs/qualification/overflight/parallel-20261005/controller-tests.tap
node_modules/.bin/eslint game/overflight/controller.mjs game/test/overflight-controller.test.mjs game/overflight/app.mjs game/overflight/copy.mjs --max-warnings 0
node --check game/overflight/app.mjs
```

The focused adapter/shared binding/radio batch passed 32/32. The full regression output is preserved in `controller-tests.tap`; its final summary is the authoritative test count. ESLint and the app syntax check passed.

Source SHA-256 at adapter freeze:

| File | SHA-256 |
| --- | --- |
| `game/overflight/controller.mjs` | `bda1c454b870c811a34bde729a75c04dad5d886792ae8d6b6900dd33b596aa5c` |
| `game/overflight/app.mjs` | `f13dceb0ac0157522bf38a2c1e55c0c3c65261255a3ea6a17c798614625f4d43` |
| `game/overflight/copy.mjs` | `bb93602c982c4ac2833a69f9c720c1f848d5b0af3600173197ceb44d7f995f03` |
| `game/test/overflight-controller.test.mjs` | `952e5a9cff80cf08ddd1bc0adbf4cdb25fe0e478ab202ae2d37268fdb11d20a8` |

These are synthetic-input and DOM checks. A physical standard gamepad, an actual radio, platform driver behavior and controller-only human usability have not been reviewed by this evidence. Raw setup editing remains in the shared setup interface; reload Overflight after changing a raw profile there. No controller/GPU performance claim is made here.
