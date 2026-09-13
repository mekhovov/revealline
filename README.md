# RevealLine

**Development:** the approved [phased roadmap](docs/implementation-roadmap.md) is being implemented on `feature/native-game-edition`. The new [continuous steering and game shell](docs/continuous-steering.md) are the first milestone; the published v0.21 described below stays unchanged. Use the roadmap for current progress and pending gates.

A configurable, Xonix-inspired browser game: leave safe ground, draw a vulnerable cut, close it and reveal a picture. The public v0.21.0 release includes 29 maps across the base campaign and six installable expansions, four visual worlds, seven gameplay classes and both immediate and grid-buffered steering. Homeward Skies and Equipment Workshop provide six original illustrated rewards; the other 23 maps use procedural scenes. Ukrainian FPV Front is the main direction, with Ukrainian heritage, 1990s arcade and fictional spend-management themes using the same simulation.

Picture celebrations and a persistent gallery reward completed missions. Searchable, paged local scores and pictures, complete portable backups, suspended attempts, dated challenges, five original synthesized music styles and a separate two-player couch race extend the game. Data-only expansions can supply campaigns, maps, classes built from registered abilities, themes, images and music recipes. Replay Theater plays verified recordings with pause, restart, single-tick steps and speed controls, including four Fieldcraft examples.

Play [the public game](https://mekhovov.github.io/revealline/), or use the [saved v0.21.0 build](http://127.0.0.1:8767/releases/v0.21.0/site/game/) while the workspace server runs. The [public-release guide](docs/public-release.md) records the published v0.21 update and its separate frozen artifact. v0.21 adds [Standard and Gentle campaign play](docs/campaign-difficulty.md): the same maps and pictures, shared mission and appearance unlocks, and separate scores and medals. Optional equipment seals require Standard. Resume and Load keep the saved mode; changing difficulty during a flight chooses the next fresh attempt. Reduced effects and Tap steering are also reachable in Settings for short-landscape layouts.

All [six source checks](docs/verification/round-30/v021-source-gates.md) passed, including **1,831 tests** on **371 unchanged committed inputs**, source `1250a8afdcf9594d87ed6a79ba29639d1225fa69`. The [independent rebuild](docs/verification/round-30/v021-integrity.md) matches all **152 packaged files** and the exact browser-tested candidate. Its [packaged browser journey](docs/verification/round-30/v021-browser.md) verified **145 offline files / 32,077,079 bytes**, restored and completed a Gentle flight with the server stopped, and exercised the first offline couch visit. These software/browser results do not certify physical controllers, native devices or difficulty balance.

Earlier v0.20 adds [shared couch controller menus](docs/couch-controller-navigation.md): either assigned player can deliberately join, choose the setup and control the round, with keyboard and touch still available. Its [source checks](docs/verification/round-29/v020-source-gates.md), [packaged browser journey](docs/verification/round-29/v020-browser.md), [archive rebuild](docs/verification/round-29/v020-integrity.md) and [public deployment](docs/verification/round-29/v020-public.md) remain preserved. Pack/Level launch links and the gallery-clock repair remain included; [earlier release evidence](docs/release-history.md) retains their original results and limits.

**Export saved attempt** at Ready and **Export current attempt** during an unfinished flight retain cancellable verification and a copyable file. Missing campaign content permits an explicitly marked rescue export; resuming still requires its exact campaign. See [saves and packs](docs/library-and-packs.md).

## Run locally

Use a supported Node version: 20.19+ within 20.x, 22.13+ within 22.x, or 24+. Then run from this directory:

```sh
npm run dev
```

Open [solo play](http://127.0.0.1:8768/game/), [Controller practice](http://127.0.0.1:8768/game/controller-lab/), [couch race](http://127.0.0.1:8768/game/couch/), [Replay Theater](http://127.0.0.1:8768/game/replay-theater/) or [the playground](http://127.0.0.1:8768/game/playground/). These routes serve the working source; saved release routes retain their exact frozen builds. The checked-in Phaser bundle is local; starting or building this version needs no CDN. Use `npm ci` to restore pinned dependencies and the formatter. Serve through HTTP rather than opening HTML as a file.

Arrows/WASD move, Shift boosts, E uses an ability, R collects supplies, and Escape/P pauses. Touch controls and standard gamepads are supported by the input adapters. Choose a starting class and steering mode in the flight deck; during a flight, a safe hangar permits class changes with retained equipment resources. Appearance remains independent of gameplay class. In **Library & saves → Saves & loads**, **Export complete backup** keeps progress, packs and the current/saved flight in one file; loading it provides **Undo complete backup import**. One game tab owns persistence, while additional tabs can play and export session-only progress.

## Choose a workspace

| Need                                                               | Start here                                                                                                                                                                                           |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Play, controls, gallery and couch race                             | [Game guide](game/README.md) · [Controller navigation](docs/controller-navigation.md) · [Controller practice](docs/controller-practice.md)                                                           |
| Back up progress, resume a flight or install a campaign            | [Library and expansion packs](docs/library-and-packs.md) · [Full backup](docs/full-backup.md)                                                                                                        |
| Explore measured equipment interactions                            | [Fieldcraft challenges](docs/fieldcraft-challenges.md) · [Replay Theater guide](docs/replay-theater.md)                                                                                              |
| Play the illustrated chapter or replace its artwork                | [Homeward Skies](docs/homeward-skies.md) · [Authored art workflow](docs/authored-art.md)                                                                                                             |
| Edit maps, try fiber/bomber/impact scenarios, compare screen sizes | [Runtime playground](docs/playground-runtime.md) · [Assets and configuration](docs/assets-and-configuration.md)                                                                                      |
| Tune music and completed-picture animation                         | [Audio and rewards](docs/audio-and-rewards.md)                                                                                                                                                       |
| Develop, validate and verify recorded runs                         | [Development](docs/development.md) · [Core contract](game/core/README.md) · [Replays](docs/replays.md)                                                                                               |
| Package, host, prepare offline play or preserve a version          | [Public release](docs/public-release.md) · [Deployment](docs/deployment.md) · [Offline play](docs/offline-release.md) · [Versioning](docs/versioning.md)                                             |
| Build a local macOS app or prepare the iPhone project              | [Native distribution](docs/native-distribution.md) · [Native compatibility](docs/native-compatibility.md)                                                                                            |
| Work with AI skills and prompts                                    | [Authoring kit](authoring/README.md): 13 skills and 124 CLI templates, with additional prose workflow examples                                                                                       |
| Review design references and earlier evidence                      | [Xonix/XPOSED research](docs/research/xonix-and-xposed.md) · [Round 10 research](docs/research/round-10-reference-and-import.md) · [Historical Round 10 verification](docs/verification/round-10.md) |
| Compare earlier visual experiments                                 | [Motion lab](authoring/motion-lab/README.md) · [Reference atlas](docs/concepts/round-09-reference-atlas.html)                                                                                        |

```sh
npm run validate
npm run lint
npm test
npm run format:check
npm run build
node scripts/game-cli.mjs serve --root dist --port 8769
```

The build is a self-contained static website with an explicit offline preparation control. Couch play is local; no online matchmaking, cloud save or global scoreboard service is included. An unsigned macOS ARM64 candidate and a generated Capacitor iPhone project have separate packaging evidence. Native UI/device verification, signing, Steam integration and human assessments of difficulty and enjoyment remain unfinished. A responsive browser fixture does not establish those results.

During this development session, the source server uses [port 8767](http://127.0.0.1:8767/game/). The standard launch command remains on 8768. The [saved-version index](http://127.0.0.1:8767/releases/) lists independently preserved frozen builds; temporary verification servers are stopped after their checks.
