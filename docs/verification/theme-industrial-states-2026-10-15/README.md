# R7 continuation — industrial states and Desktop 98 entry fields

Base: `9e98c4fb3472e4b04104220a0e5d109abac24d59`, fetched from `main` and rebased before implementation. Previous PR #1458 was already merged.

## Changes and rationale

- **Ember Foundry:** cast-metal stipple remains consistent across default, hover, pressed and selected faces. Recesses use the finer stone texture instead of generic powder. Small rim highlights explain the relief without adding animated glow or marks over labels.
- **Polar Relay:** directional brushing now continues across selected/pressed faces, recessed fields and toolbars. Previously these states inherited generic worn-steel finishes. The existing nine-slice frame remains intact.
- **Flight Deck:** the complete base steel recipe and all eleven generated grain tiles are byte-identical to the rebase point. See `material-preservation.json`.
- **Desktop 98:** new interface/family r3 uses white input surfaces and black input text. The teal desktop, silver panels, r2 interface/family and existing Arcade/SIM references are preserved. Bootstrap projection includes both revisions.
- **DOS:** inspected at native control sizes and nested inside Ember; its flat, texture-free construction was retained.

The visual approach follows the joint-widget review and native-resolution emphasis in [Factorio’s GUI tileset article](https://factorio.com/blog/post/fff-243). All material artwork remains project-original; no source artwork was copied.

## Verification

- `theme-tests.tap`: 93 tests passed across theme-system, picker materials, collection expansion, family host, unified appearance, Studio appearance basis, preview, bootstrap, community theme and material-state semantics suites.
- `sim-tests.tap`: 61 tests passed across FPV appearance, family controls, role presentation, World appearance UI and World editor appearance suites. This run followed the Desktop r3 change.
- `browser-checks.json`: 12 native Safari Technology Preview observations of the runtime fixture. Ember, Polar and Desktop passed normal, decoration Off and combined high-contrast/reduced-motion/large-text checks. DOS passed normal and nested Ember checks; Polar also passed inside Ember.
- Bootstrap, grain and embedded SIM presentation generation checks passed; changed JavaScript passed ESLint; changed code passed Prettier.
- Historical interface/Arcade/SIM digest checks pass. The new Desktop test checks r2 retention, unchanged asset references, white fields and the high-contrast override.

## Visual evidence and limits

`ember-native.jpg`, `polar-native.jpg`, `desktop98-native.jpg` and `polar-accessibility.jpg` are resized review copies captured through native Safari. They show shared runtime materials on 44px player controls, 32px Studio controls, fields and tall cards. They are not lossless texture-contrast measurements. No full-game preferences were changed by this fixture.

The local game at `/game/` still displays its password gate. Actual settings, theme-picker, dialog, mission and Studio journeys remain pending; the specimen is not a substitute for those checks. Physical controller/touch checks, narrow layouts, translated labels, pixel contrast, SIM fly-through/performance and offline package acceptance were not qualified by this increment. R7 remains open.
