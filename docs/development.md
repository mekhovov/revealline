# Develop the browser game

The playable game lives in [game](../game/). Its simulation is a browser-independent ES module in [core/index.mjs](../game/core/index.mjs); the Phaser page supplies presentation and input. The earlier [motion and ability lab](../authoring/motion-lab/README.md) remains a separate design study. Demonstrated behavior in that lab is not automatically a supported game feature.

Use Node **20.19 or newer**, matching [package.json](../package.json). The CLI itself uses Node built-ins. The browser loads the versioned Phaser bundle in `game/vendor/`; running the checked-in game or building a static distribution does not contact a CDN. `npm ci` restores the pinned Phaser dependency and Prettier 3.6.2 formatter when needed; it does not silently refresh the vendored bundle.

From the repository root:

```sh
npm run dev
```

Open [the game](http://127.0.0.1:8768/game/). The equivalent command is `node scripts/game-cli.mjs serve --port 8768`. Refresh after source changes; this server has no bundler or hot reload. It serves GET/HEAD requests, correct JavaScript MIME types, and no-cache development responses. Hidden files, path traversal and symbolic links are refused. It does not provide authentication, uploads or a production backend.

The default server binds only to loopback. For a deliberate same-network device test, use `node scripts/game-cli.mjs serve --host 0.0.0.0 --port 8768` and open the development computer's LAN address on the device. This exposes the selected server root to that network. Prefer `--root dist` for a distribution-only preview. A desktop viewport resize is not an iPhone, touch, controller or performance test.

## Commands

| Task | Command | Output / boundary |
|---|---|---|
| Serve source | `node scripts/game-cli.mjs serve --port 8768` | Local HTTP server; Ctrl-C stops it |
| Check content and references | `npm run validate` | Campaign levels, themes and class recipes use the actual runtime validators; copied JSON and literal browser references are checked |
| Check source formatting | `npm run format:check` | Prettier checks game `.mjs`/CSS/HTML/JSON and `scripts/*.mjs`; vendored files are ignored |
| Apply source formatting | `npm run format` | Rewrites those same maintained files; does not reformat the historical authoring kit |
| Run behavior tests | `npm test` | Node test files in `scripts/`, `game/` and the existing motion lab |
| Build | `npm run build` | `dist/`, checksum manifest, deterministic ZIP and checksum sidecar |
| Preview built files | `node scripts/game-cli.mjs serve --root dist --port 8769` | Separate local origin for distribution testing |
| Generate a candidate | `node scripts/game-cli.mjs generate --seed sunflower --out generated/sunflower.json` | Explicit level JSON; existing output is never overwritten |
| Replay campaign proofs | `node scripts/verify-campaign.mjs` | Verifies recorded legal-input completions for all eight levels in both turn modes |
| Snapshot a saved revision | `npm run release -- --ref v0.1.0 --version v0.1.0` | A new immutable folder under `releases/`; the ref must exist |
| Show syntax | `node scripts/game-cli.mjs help` | Supported options; unknown/duplicate options fail |

No CLI command uploads or publishes files. Build output can replace an earlier CLI-owned build folder; a nonempty unrelated destination is rejected. `generated/`, `dist/` and `releases/` are local outputs; keep their ignore policy in the repository's `.gitignore`.

## Change the right layer

Edit [campaign.json](../game/content/campaign.json) for the authored level list and explicit map data. Each level uses `version: "xonix-level.v1"`, an ID and revision, a 48 × 36 board, an outer-border spawn, rectangular walls, registered enemy types, objectives, supplies and a coverage goal. Edit [themes.json](../game/content/themes.json) for supported presentation bindings. Read the actual data before changing its shape; the historical pack and media contracts are separate formats.

Edit [classes.json](../game/content/classes.json) to configure the implemented class primitives and their accepted limits. A class recipe has an ID and revision; its gameplay values produce the core's `loadoutHash`. Completion records retain turn policy, class ID, class revision, loadout hash and seed as a distinct setup. Label and description changes do not alter that hash. Local progress validates the current result against the selected recipe; it is not a tamper-proof achievement service.

Registered behavior belongs in `game/core/`. Rendering or avatar art must not change a collider, movement policy, capture rule or enemy simulation. Preserve the selected `immediate` or `grid-center` turn policy, and exercise both when movement or abilities change. Appearance and gameplay class remain independent choices; do not infer an ability from a picture or a rotor count.

The browser playground and CLI share [generator.mjs](../game/generator.mjs). Its seed creates repeatable candidate geometry with two separated obstacles and two field enemies. Its JSON passes the core's structural validator. Validation does **not** prove a level is winnable, balanced, fun, accessible or fast on a phone. Import the emitted single-level JSON through the playground's level import, then play its initial route, capture, hazards and objectives. Save deliberate changes as explicit data with an updated revision. The same seed and generator revision are required to reproduce the original candidate.

## Verify a change

Run the checks that match the edit. Core changes require meaningful simulation tests; source or asset-binding changes require a built browser preview. `validate` checks literal imports and HTML/CSS resources, but cannot discover arbitrary dynamically computed paths. Navigation links outside the distribution are reported as warnings separately from missing rendering dependencies. Review those links for the intended hosting context. Browser inspection is still needed for JSON-driven images, responsive layouts, audio activation, input focus and the visual result of capture.

Before sharing a build, run `npm run validate`, `npm test`, `npm run build`, then serve `dist/`. Check the built game under its `/game/` path and at a nested prefix if that is how it will be hosted. Record the version, commands, actual outcomes and remaining device coverage. See [deployment](deployment.md) and [saved versions](versioning.md).

## Campaign completion fixtures

[campaign-routes.json](../game/replays/campaign-routes.json) records sixteen successful runs: eight authored levels in each turn mode, using the normal interceptor recipe, seed 1, and only direction/boost/action inputs. The verifier starts a fresh `createRun` for each, calls `stepRun` at the fixed simulation interval, and requires the real victory condition and required objectives. It never edits cells, enemies, lives or rules. Content hashes and expected result identities detect stale fixtures.

The initial bounded search found all routes in roughly 4.3 seconds on this development machine, examining 2,096 candidate cuts. This is a local search measurement, not a gameplay frame-rate benchmark. It establishes that these configurations are completable; it does not establish human difficulty, balance, enjoyment, touch usability or performance on other hardware.

After deliberately changing rules/content, discover new candidates with `node scripts/verify-campaign.mjs --discover --out generated/campaign-routes-candidate.json`, then inspect and replay them before replacing the reviewed fixture. Discovery is bounded by fourteen chosen cuts and forty-five seconds per level and fails loudly if it cannot complete the campaign. It uses safe-area path planning and simulation of candidate straight cuts; it is not a general solvability proof for arbitrary maps. Outputs are written without replacing an existing file.
