---
name: xonix-runtime-maintainer
description: Maintain, test, build and archive this project's playable Xonix browser runtime using its actual core, content and CLI contracts. Use for game logic, browser integration or playable release work; concept-only art and the separate motion lab have their own workflows.
---

# Xonix Runtime Maintainer

Locate the project from the current workspace or this source skill's project path. Read [development.md](../../../docs/development.md) and the relevant code before editing. The playable application is `game/`; the historical `authoring/motion-lab/` is a separate study. A preview class or catalog reference is not automatically implemented in the game.

## Choose the real contract

- `game/core/index.mjs` exports the simulation API and `validateLevel`. Keep DOM, Phaser rendering and authoring-file concerns outside that core.
- `game/content/campaign.json` contains explicit `xonix-level.v1` levels inside `xonix-campaign.v1`. Use the actual validator; do not substitute the older game-pack, media or collection schema.
- `game/content/classes.json` configures registered ability primitives. Preserve class revision and the core's `loadoutHash` in result identity; use `campaign.classRecipes` when validating custom campaign recipes. Never derive that identity from a body or reimplement the core hash in the UI.
- `game/content/themes.json` and declared presentation bindings own appearance. A body image, rotor count, material or theme does not silently change movement, collision, enemy behavior or class statistics.
- `game/build-config.json` owns the static build allowlist. Include required modules, assets and licenses when adding dependencies. Preserve relative imports so source, `dist/` and a nested saved version can all load.

Read the exported functions and current data before selecting names or fields. New primitives, enemy types, save migrations or targeting domains require implemented behavior and tests; arbitrary JSON strings cannot create them. Preserve authored `immediate` and `grid-center` turning, and test both for changes affecting movement, input buffering, dashes or contact order. Cosmetic replacement must leave those mechanics unchanged.

For controls, read `docs/controls.md` and `game/key-bindings.mjs`. Keep mappings separate from simulation rules. Preserve Escape pause, browser/editing shortcuts, unconditional key release, cancellation without partial adoption and visible hints. New preferences require bounded validation, additive migration and portable-backup tests. Archived release profile channels must remain isolated from incompatible new schemas.

For portable saves, local leaderboards and installed campaigns, read [library-and-packs.md](../../../docs/library-and-packs.md). New core results include roster and class-route identities; retain both through rewards and replays. Expansion packs use the runtime `xonix-pack.v1` contract and complete image decoding before atomic installation.

## Make the requested change reviewable

Use `node scripts/game-cli.mjs serve --port 8768` for source inspection. `npm run validate` checks campaign, theme and class data through actual validators plus copied JSON and literal browser resources. Navigation links outside the distribution appear separately as warnings. `npm test` runs the core, tooling and existing lab test files. Run the relevant checks after the edit; complete the full required checks for a release. Do not describe tests as physical-device, visual or production-save validation.

For a candidate map, run `node scripts/game-cli.mjs generate --seed sunflower --out generated/sunflower.json`. It delegates to the same browser-safe `game/generator.mjs` as the playground, writes an explicit validated 48 × 36 level and refuses to replace an existing file. Import it through the playground's level import and inspect real play; structural validity is not a solvability or balance proof. Keep reviewed level JSON and revisions when repeatability matters.

Use `npm run build`, then `node scripts/game-cli.mjs serve --root dist --port 8769` to inspect the distribution. Check the resulting capture, input, local assets and UI at the requested sizes; generated screenshots or contact sheets do not prove playable behavior. Literal-reference checks cannot find all dynamic asset paths. Preserve source images and provenance when adjusting presentation.

## Save or distribute only the authorized result

Read [versioning.md](../../../docs/versioning.md) for `release-snapshot --ref REF --version LABEL`. The ref must already exist. The command archives the selected trusted revision and runs its frozen CLI, without switching the checkout; saved labels cannot be overwritten. Use separate server ports for independent origin-scoped saves. A generated archive is local output, not a deployment or off-device backup.

Follow the user's existing authorization for edits and local artifacts; do not add redundant approvals. Git commits/tags, external publication, store uploads and destructive replacement still follow the scope actually requested. If publication is not yet authorized, finish and verify the local artifact so the approval concerns a concrete result. Never invent a remote, app ID, credential or supported platform.

Read [deployment.md](../../../docs/deployment.md) when delivery matters. Browser builds are implemented; only claim PWA/offline or native readiness after testing the corresponding actual files and target. Capacitor, Electron and Steam packaging require their own configured projects and validation. Record the exact commands, version/source revision, observed results and remaining limitations in the handoff.
