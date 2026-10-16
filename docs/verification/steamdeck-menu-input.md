# Steam Deck menu input repair

Source baseline: `88d1726a268e6aaf3fd8f1373390f4be836f5e12` (current main, v0.107.0). The reported browser was v0.106.0. No immutable release files were edited.

## Reproduction and change

In desktop Chrome 154.0.8037.57, a simulated standard gamepad Confirm followed by a real browser Space press toggled a focused checkbox on and immediately off. A native key/pointer event also relinquished controller navigation and cancelled its uncommitted select editor. This reproduces the reported behavior; the user's physical Steam Deck event stream was not captured.

[Steam Input legacy bindings](https://partner.steamgames.com/doc/features/steam_controller/legacy_mode?language=english) support emulated mouse, keyboard and gamepad inputs. The solo host now guards the paired Enter/Space or primary mouse gesture while the assigned controller's Confirm is physically pressed. A read-only probe handles native events that precede the animation frame without consuming the controller edge. The native release remains guarded across menu changes. The guard follows remapped Confirm and the default West alias, rejects replacement/unsupported pads, and leaves touch, pen, native-only input and fresh flight actions available.

Controller navigation help and connection status now remain inside Settings → Controls → Controller navigation help. The fixed/sticky banner and per-frame reparenting are removed. Help is collapsed by default, uses the current button labels, and has space beneath its summary's focus ring.

## Verification

- Router, navigation and Confirm guard unit tests: 214 passing cases, including 12 new mixed-input regressions.
- Existing touchscreen/controller host suite: all 18 cases passed, with one initial picture-readiness timeout under concurrent load passing on its isolated retry.
- Repository lint, content validation and presentation metadata validation passed. Changed JavaScript, HTML and CSS passed Prettier; `git diff --check` passed.
- Chrome at 1280×800: observed checkbox reversal with the guard absent, then exactly one activation with it installed. Both native-first and gamepad-first orderings passed for keyboard and mouse mirrors. Select preview/apply and standalone touch, mouse and keyboard remained usable.
- Actual solo app in Chrome: simulated A plus native Enter opened Settings, selected Controls, opened the help disclosure, edited and applied Touch steering, and started a flight. The disclosure text cleared its summary focus ring; no controller hint was visible over the running board. No page errors were observed.

Relevant commands:

```sh
node --test game/test/controller-confirm-guard.test.mjs game/test/controller-router*.test.mjs game/test/controller-navigation.test.mjs
node --test game/test/touchscreen-controller-host.test.mjs
node --test --test-name-pattern='Solo adopts the shared couch choice' game/test/touchscreen-controller-host.test.mjs
npm run lint
npm run validate
```

These are source and modeled-input browser checks, not physical Steam Deck certification or a public deployment. The full repository test suite and a new release build were not run for this scoped repair.
