# SIM integration review — 2026-10-02

Integration target: main `d4b2848194585a4d7f8cacd4b0f0ede9ec19d20d`.
This receipt covers the appearance merge in the isolated publication checkout.
Earlier 64/96-file package receipts and pre-integration test totals are historical;
current main permits 72 Academy files / 8 MiB and 104 World files / 16 MiB.
Package closure measurements are recorded separately by the publication check.

## Resolved behavior

- Preserved main's async graphics preparation, fresh-arm requirement, radio/input
  lifecycle, beginner guidance, World recovery helper and actor animation.
- Combined shared theme bindings with main's authored surface maps, lighting,
  quality presets, six new adventure environments and renderer resource ownership.
  Explicit theme collections keep their reviewed procedural materials; authored
  appearances retain main's normal/roughness maps and scenery. No simulation model,
  collision, proof algorithm or flight parameter was changed by this integration.
- World recovery passes its copied course and presentation through the extracted
  recovery helper. Academy replay retains its appearance metadata while waiting
  for preparation. A missing appearance notice is applied after the matching scene
  finishes preparing, so preparation no longer erases the fallback explanation.
- Renderer diagnostics retain main's actor/projectile diagnostics alongside theme,
  effect and imported-material-binding information. Main's shadow material
  ownership and instance disposal are retained.

## Fresh checks

- `world.tap`: **62 passed**, no failures or skips. Covers World runtime/content,
  appearance preferences/recording metadata, host lifecycle, editor handoff and
  semantic materials. Material geometry checks now include all **14** current
  environment families, across all eight explicit collections.
- `academy.tap`: **41 passed**, no failures or skips. Covers Academy host controls,
  preparation, replay rates, radio setup and authoring/notebook behavior. Fixtures
  implement the browser SVG/performance APIs added by main and await real host
  preparation boundaries before arming.
- Added regressions verify that superseded appearance preparation cannot arm or
  overwrite a newer choice, and that missing recording appearance remains visibly
  explained after graphics preparation without changing the retained proof.
- Owned JavaScript passes ESLint, Prettier and syntax checks; staged changes pass
  the whitespace check.

These are source/host tests with synthetic renderer fixtures where specified.
They do not qualify physical GPU performance, graphics driver behavior, target
devices, gamepad/touch hardware, or final visual approval of the integrated art.

Reproduce the focused suites from the repository root:

```sh
node --test game/test/fpv-world-runtime.test.mjs game/test/fpv-world-content.test.mjs game/test/fpv-world-appearance-ui.test.mjs game/test/fpv-world-editor-appearance.test.mjs game/test/fpv-workshop-visuals.test.mjs game/test/fpv-appearance.test.mjs game/test/fpv-theme-family-controls.test.mjs
node --test game/test/fpv-flight-ui.test.mjs game/test/fpv-replay-rate.test.mjs game/test/fpv-studio-setup.test.mjs
```
