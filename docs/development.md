# Develop the browser game

The v0.2.0 application uses a browser-independent ES-module simulation with Phaser presentation and plain JavaScript tooling. The full toolchain supports **Node 20.19+ on 20.x, 22.13+ on 22.x, or 24+**, matching the pinned linter's engine requirements. `npm ci --ignore-scripts` restores the pinned dependencies, including Phaser 4.2.1, Prettier 3.6.2 and ESLint 10.10.0; it does not silently refresh the checked-in browser bundle. Source play and static builds use local files without a runtime CDN.

Run `npm run dev`, then open [solo play](http://127.0.0.1:8768/game/), [couch race](http://127.0.0.1:8768/game/couch/), [Replay Theater](http://127.0.0.1:8768/game/replay-theater/) or [the playground](http://127.0.0.1:8768/game/playground/). Refresh after source edits; the server has no bundler or hot reload. It serves GET/HEAD and correct MIME types, refusing hidden files, traversal and symbolic links. It provides no upload endpoint or application backend.

## Commands

| Task | Command | Result |
|---|---|---|
| Serve source | `node scripts/game-cli.mjs serve --port 8768` | Loopback HTTP server; Ctrl-C stops it |
| Validate content and references | `npm run validate` | Runtime validators and distribution resource checks |
| Check undefined names and unreachable code | `npm run lint` | All maintained game/scripts `.mjs` modules; [environment rules](linting.md) |
| Check / apply source format | `npm run format:check` / `npm run format` | Maintained game files and JavaScript scripts; vendor excluded |
| Run behavior tests | `npm test` | Node suites from scripts, game and the separate motion lab |
| Build | `npm run build` | Static `dist/`, checksum manifest, deterministic ZIP and digest |
| Preview production policy | `node scripts/game-cli.mjs serve --root dist --port 8769` | CLI-owned builds receive the generated CSP/security headers |
| Generate a map candidate | `node scripts/game-cli.mjs generate --seed sunflower --out generated/sunflower.json` | Explicit level JSON; refuses an existing destination |
| Verify base campaign routes | `node scripts/verify-campaign.mjs` | 24 legal-input completions: 12 maps × two steering modes |
| Verify expansion routes | `node scripts/verify-packs.mjs` | 20 legal-input completions: ten maps × two steering modes |
| Verify Fieldcraft role interactions | `node scripts/verify-specialty.mjs` | 70 attempts: eight specialty clears, 56 all-class fallback clears and six action-omission comparisons |
| Freeze a saved revision | `npm run release -- --ref YOUR_SAVED_TAG --version YOUR_RELEASE_LABEL` | New immutable local release from an existing trusted Git ref |
| Show supported syntax | `node scripts/game-cli.mjs help` | Unknown or duplicate options fail |

The release command uses placeholders above; substitute an existing ref and an unused label. No CLI command publishes files or creates Git commits/tags. Build can replace a CLI-owned output directory, but rejects unrelated nonempty destinations. Generated `dist/`, `releases/` and `generated/` remain local outputs under the repository's ignore policy.

For a deliberate LAN hardware test, serve a distribution with `node scripts/game-cli.mjs serve --root dist --host 0.0.0.0 --port 8769` and use the computer's LAN address. This exposes that selected root to the local network. Service-worker installation requires a secure context: localhost is suitable on the same computer, while a phone visiting a plain-HTTP LAN address needs HTTPS for the offline test. A desktop resize does not establish touch, controller, audio or hardware performance.

## Change the right layer

| Layer | Files / contract |
|---|---|
| Rules, movement, hazards and abilities | [Core](../game/core/README.md), `game/core/`; `xonix-core.v2`, fixed 120 Hz |
| Maps, themes and classes | [Runtime configuration](assets-and-configuration.md), `game/content/`; `xonix-level.v1` |
| Working editor scenario | [Playground](playground-runtime.md); `xonix-playground.v1` |
| Installable campaigns and artwork | [Packs](library-and-packs.md), `game/packs.mjs`; `xonix-pack.v1` / `xonix-pack-library.v1` |
| Progress, preferences, gallery and local scores | `game/library.mjs`, `game/progress.mjs`; `xonix-library.v1` |
| Single writing tab and profile generation | `game/profile-writer.mjs`, guarded library storage; session-only secondary tabs |
| Combined backup and interrupted-import recovery | [Full backup](full-backup.md), `game/backup.mjs`, `game/backup-storage.mjs`; `xonix-backup.v1` |
| Replay and recoverable attempt | [Replay guide](replays.md), `game/replay.mjs`, `game/sessions.mjs`; `xonix-replay.v3` / `xonix-session.v1` |
| Verified visual replay transport | [Replay Theater](replay-theater.md), `game/replay-player.mjs`, `game/replay-theater/`; no player storage access |
| Solo and local multiplayer input/shell | `game/app.mjs`, `game/ui/input.mjs`, `game/couch/`, `game/multiplayer.mjs` |
| Art, animation and sound | [Audio/rewards](audio-and-rewards.md), `game/ui/`; independent of authoritative gameplay |
| Static package, headers and offline inventory | [Public release](public-release.md), [offline guide](offline-release.md), `scripts/game-cli.mjs` |

The base campaign has 12 maps, four themes and seven class recipes built from five registered primitives. Three bundled expansions add ten maps. Maps can configure signal rectangles, hangars, mission/cut deadlines and trail-length budgets. Roster recipes can configure signal resistance and speed within validated bounds. The playground's JSON editor, brushes and Fiber/Bomber/Impact presets exercise the same implementation. New algorithms require core code and versioned semantics; a pack cannot execute a supplied script.

Keep avatar art independent of collision, capture and ability stats. `classId`, revision and `loadoutHash` identify the starting recipe; `activeClassId` identifies the current craft. A legal `switchClass` input at a safe hangar changes the latter while retaining each class's resources. `rosterHash` and ordered `classHistory` record the available recipes and the actual route. Scoring must distinguish different rosters and class routes. After 4,096 class-history entries, further switches are rejected while the run can continue. Per-level progress retains up to 256 recent setup variants plus aggregate best results; the library caps local score boards and overall data separately.

Use the shared bounded JSON and prepared-image boundaries for imports. Prepare/decode all candidate media and validate dependencies before replacing installed content. Preserve originals, provide an Undo/recovery path, and never write caller objects into a live run. [Library and packs](library-and-packs.md) documents exact limits, dependencies and storage behavior. Installed campaigns can earn their own progress; playground practice, replay verification and couch races cannot award campaign clears.

The profile holds up to 512 campaign identities and 4,096 picture records within 4 MiB; adding content at capacity must preserve existing pictures and surface the capacity error. The gallery displays 12 search results per page, and local scores display ten setup groups per page. This bounds active DOM/render work separately from persistent-data limits.

The shell claims a profile-writing lease for the page lifetime. Secondary tabs may play and export their in-memory changes, but cannot persist preferences/progress or modify installed packs and saved flights. Closing the owner and reloading the second tab transfers the opportunity to claim ownership; do not silently promote it while stale local state remains. The shorter backup lock then serializes coordinated import/recovery among participating writers.

The complete-backup UI exports the current unfinished normal campaign recording when present, otherwise the saved slot, along with the library and installed packs. Import and **Undo complete backup import** use the same prepared-data and durable-journal path. The UI passes only the base campaign plus a trusted dated-challenge resolver; imported pack flights must resolve from included packs. Keep the existing individual exports for selective recovery. See [full backup](full-backup.md) for pre-read byte limits, raw rollback, metadata adoption and failure behavior.

Replay Theater validates an ordinary v3 recording before constructing its transport and painter. It executes only recorded commands, including class switches and explicit input releases. Transport pause must not call `releaseInputs`: it preserves the recorded buffer/latches, while gameplay pause is recorded as a release. Playback rate changes presentation scheduling without rewriting simulation time. The theater remains separate from campaign awards, player storage and resume-session adoption. Its four checked examples derive from the Fieldcraft proofs; [theater maintenance](replay-theater.md) describes refreshing them after intentional content changes.

The older authoring drafts, media library and motion lab use different schemas and registries. Runtime reuse of character-rendering modules does not import all lab mechanics. For AI work, pair [Runtime Maintainer](../authoring/skills/xonix-runtime-maintainer/SKILL.md) with [Expansion Author](../authoring/skills/xonix-expansion-author/SKILL.md) or the relevant asset skill.

## Scheduling and verification

Record exactly one command per actual `FIXED_DT` step and mirror every `releaseInputs` call into the recorder. Render frames are independent of simulation ticks. The solo shell pauses after a frame interruption longer than 250 ms instead of replaying a long input backlog. Presentation animation and audio must never alter score, capture or cooldowns.

Replay verification is bounded to 216,000 ticks/32 MiB and yields by tick and wall-time budgets; use its asynchronous API in the UI. Audio uses a 120 ms look-ahead, at most four score steps per update and 64 voices, without a background interval. These bounds control work; they are not measured frame-rate or audio-quality guarantees on every device. See the dedicated replay/audio guides before changing their scheduling.

Run checks proportional to the edit. Core changes need meaningful simulation tests in both steering modes. Pack/save changes need valid round trips and malformed-data atomicity checks. Input, image or sound changes need a browser preview using the built production CSP. The static validator checks literal resources but cannot establish decoded-image quality, responsive usability, focus behavior or audible output.

Before packaging, run `npm run validate`, `npm run lint`, `npm test`, `npm run format:check` and `npm run build`. Inspect the built main game, playground, couch page and Replay Theater, including a nested hosting prefix where relevant. Exercise save/resume, complete-backup export/import/Undo, pack install/remove, gallery/search pagination and offline preparation through visible controls. Verify that a secondary tab cannot overwrite the saving owner. The current focused couch layout has same-browser CSS checks at six viewport sizes, including 320 × 640 with 44-pixel control targets; physical touch, controller and browser-specific behavior need additional evidence. The [public-release gate](public-release.md) defines what must be recorded for each actual browser/device target; a test count alone is not that record.

The Replay Theater integration checkpoint contained **448 passing JavaScript tests**. Treat that as checkpoint evidence, not a permanent suite size or a release certificate; record a fresh result for the exact frozen artifact after further code changes.

## Completion fixtures and new maps

[campaign-routes.json](../game/replays/campaign-routes.json) and [expansion-routes.json](../game/replays/expansion-routes.json) contain the reviewed routes. Each verifier creates a fresh normal run and uses legal inputs at the fixed interval. It requires real victory and required objectives, without editing cells, enemies, lives or rules. Content digests and expected summaries reject stale fixtures. These routes establish completion for their recorded map/class/seed/policy combinations, not general balance, human enjoyment or solvability of every generated board.

After deliberate base-content changes, use `node scripts/verify-campaign.mjs --discover --out generated/campaign-routes-candidate.json`, inspect the candidate and replace the reviewed fixture intentionally. Discovery refuses to overwrite its destination. `node scripts/verify-packs.mjs --discover` deliberately rewrites the expansion fixture after finding all ten maps' routes; review that Git diff and run its verifier. The search is a bounded heuristic, not a general solvability proof. `node scripts/verify-specialty.mjs` separately checks [Fieldcraft's role interactions](fieldcraft-challenges.md), alternate class completions and action-omission comparisons. These capture measured effects of particular recorded inputs; they do not establish human difficulty or enjoyment.

The shared [generator](../game/generator.mjs) produces structurally valid seeded candidates. Materialize, edit and playtest them before publishing a campaign. Preserve explicit JSON plus generator version/seed for reproducibility. Save changes in logical Git commits, then freeze a tested saved revision using [versioning](versioning.md). Native packaging and network services remain separate implementation work.
