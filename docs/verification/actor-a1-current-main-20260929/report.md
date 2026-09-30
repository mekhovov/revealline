# Minimal A1 source patch against current main

Base: `64c8b9d81604984363666abadae236d9f2f76f7f`. Donor: PR761 `d9f37b57066b97add90b0ac96d0b5efe834d58e0`.

**Prepared source only.** No production admission, artwork approval, version, build or publication. Repository worktrees and refs were not modified.

Patch: `/tmp/actor-a1-current-main-20260929.patch`
Size: 104,851 bytes. SHA256: `2d8544e6048ff22bdfba5c9a8beaa7768e36c466b3dc7a6f432ceb513d3312d4`.

## Exact patch paths

Eight runtime files:

- `game/ui/rotor-presentation.mjs`
- `game/ui/contact-cue.mjs`
- `game/ui/actor-presentation.mjs`
- `authoring/motion-lab/render-character.mjs`
- `game/ui/render.mjs`
- `game/couch/coop-actor-presentation.mjs`
- `game/couch/coop-pilot-cues.mjs`
- `game/couch/coop-view.mjs`

Seven focused tests and two small Team checkpoint fixtures:

- `game/test/rotor-presentation.test.mjs`
- `game/test/actor-presentation.test.mjs`
- `game/test/coop-actor-presentation.test.mjs`
- `game/test/coop-hunter-pose.test.mjs`
- `game/test/coop-freeze-presentation.test.mjs`
- `game/test/coop-recovery-pose.test.mjs`
- `game/test/contact-cue-comparison.test.mjs`
- `docs/verification/rotor-motion/team-hunter-fixture.mjs`
- `docs/verification/rotor-motion/team-freeze-fixture.mjs`

The Solo renderer is ported by five narrow replacements: two helper imports, optional contact-style option, prepared recipe adapter, prepared-only rotor visibility, and bounded contact understroke. Both main `themeFamily` arguments remain byte exact. No combat, capture/event toggle, candidate loader, model/schema, core, app, producer, registry, asset, version or publication hunks are included. The contact choice remains opt-in; default Solo width is unchanged. Team prepared pilots receive a single unfilled final contact ring and retain their existing fallback/badges.

## Checks and reproduction

- Exact main preimages: `git apply --check --whitespace=error-all` passes outside any Git checkout.
- Node 22.22.2: **152/152** selected renderer tests pass.
- Unchanged main enemy-catalog and actor-appearance-lease suites: **31/31** pass, including FPV-family feedback and the independent lease.
- Baseline control: the three new prepared-player rotor tests **fail on unchanged main** at 240/390/1152px because connected rotor polygons are absent.
- All 17 files pass syntax and formatting; 14 game runtime/test files pass the existing main ESLint configuration.
- Independent patch review found no blocker and verified all 17 exact base/candidate hashes.

Temporary source harness: `/tmp/actor-a1-current-main-20260929-6ru0litl`. `manifest.json` records every patch preimage/candidate hash. The loader reads unchanged modules directly from exact main Git objects, without checkout/fetch. FS fixtures were copied individually from those same objects; the additional approved lease image set is only 24 existing PNGs / 9,965 bytes. No network image retrieval occurred. Existing node_modules was reused.

Run from `/tmp/actor-a1-current-main-20260929-6ru0litl/after` using `/Users/oleksandr.mekhovov/.local/share/mise/installs/node/22.22.2/bin/node`. Exact commands, file hashes and receipts are in `/tmp/actor-a1-current-main-20260929-report.json`.

Retained logs:

- `/tmp/actor-a1-current-main-20260929-focused.tap`
- `/tmp/actor-a1-current-main-20260929-preservation.tap`
- `/tmp/actor-a1-current-main-20260929-baseline.tap`
- `/tmp/actor-a1-current-main-20260929-format.log`
- `/tmp/actor-a1-current-main-20260929-lint.log`

Initial harness-only failures are retained separately: macOS `/tmp` realpath mismatch (resolved before the 152-test pass), and missing approved lease fixtures causing a Git-cwd fallback failure (resolved before the 31-test pass). A local resource-copy attempt also required normalizing the manifest’s `./assets` path before `git show`. These were harness corrections; patch/source bytes were unchanged.

## Integration prerequisites

- Current-effects20 predecessor support and actual source-admission caller/semantic guard integration are not included.
- Extend producer source closures for the new shared helpers and test each dependency invalidates its consumers.
- 59 scoped renderer/equipment review successors expected only with app/audio unchanged; preserve audio52, independent fpv62 lease and all immutable production history.
- No candidate images/schema, production manifests, registrations, generated build config, app, versions or release changes.
- Actual integrated renderer visual review/build/release qualification not performed.
- PR783 head0cc7337 has separate picture/jammer/signal-reception painter ownership/disposal/options/masking hunks requiring deliberate merge; root Team Large text work is separate.

This patch intentionally leaves production-review gates closed. Keep original Team recipe/default/inherited-image checks and equipment PNG/geometry checks when composing the eventual pinned continuation. Current source tests and command traces do not establish native pixel, physical-device, complete mission or public-release acceptance.
