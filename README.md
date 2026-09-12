# RevealLine

A configurable, Xonix-inspired browser game: leave safe ground, draw a vulnerable cut, close it and reveal a picture. The v0.2.0 source includes 12 campaign maps, ten more maps in three installable example expansions, four visual worlds, seven gameplay classes and both immediate and grid-buffered steering. Ukrainian FPV Front is the main direction; Ukrainian heritage, 1990s arcade and fictional spend management use the same simulation.

Picture celebrations and a persistent gallery reward completed missions. Searchable, paged local scores and pictures, complete portable backups, suspended attempts, dated challenges, five original synthesized music styles and a separate two-player couch race extend the game. Data-only expansions can supply campaigns, maps, classes built from registered abilities, themes, images and music recipes. Replay Theater plays verified recordings with pause, restart, single-tick steps and speed controls, including four Fieldcraft examples.

## Run locally

v0.2.1 adds [custom keyboard controls](docs/controls.md), left/right-hand presets and persistent Tap steering. Packaged versions keep separate collections; complete backups transfer progress forward while older versions remain unchanged.

Use a supported Node version: 20.19+ within 20.x, 22.13+ within 22.x, or 24+. Then run from this directory:

```sh
npm run dev
```

Open [solo play](http://127.0.0.1:8768/game/), [couch race](http://127.0.0.1:8768/game/couch/), [Replay Theater](http://127.0.0.1:8768/game/replay-theater/) or [the playground](http://127.0.0.1:8768/game/playground/). The checked-in Phaser bundle is local; starting or building this version needs no CDN. Use `npm ci` to restore pinned dependencies and the formatter. Serve through HTTP rather than opening HTML as a file.

Arrows/WASD move, Shift boosts, E uses an ability, R collects supplies, and Escape/P pauses. Touch controls and standard gamepads are supported by the input adapters. Choose a starting class and steering mode in the flight deck; during a flight, a safe hangar permits class changes with retained equipment resources. Appearance remains independent of gameplay class. In **Library & saves → Saves & loads**, **Export complete backup** keeps progress, packs and the current/saved flight in one file; loading it provides **Undo complete backup import**. One game tab owns persistence, while additional tabs can play and export session-only progress.

## Choose a workspace

| Need | Start here |
|---|---|
| Play, controls, gallery and couch race | [Game guide](game/README.md) |
| Back up progress, resume a flight or install a campaign | [Library and expansion packs](docs/library-and-packs.md) · [Full backup](docs/full-backup.md) |
| Explore measured equipment interactions | [Fieldcraft challenges](docs/fieldcraft-challenges.md) · [Replay Theater guide](docs/replay-theater.md) |
| Edit maps, try fiber/bomber/impact scenarios, compare screen sizes | [Runtime playground](docs/playground-runtime.md) · [Assets and configuration](docs/assets-and-configuration.md) |
| Tune music and completed-picture animation | [Audio and rewards](docs/audio-and-rewards.md) |
| Develop, validate and verify recorded runs | [Development](docs/development.md) · [Core contract](game/core/README.md) · [Replays](docs/replays.md) |
| Package, host, prepare offline play or preserve a version | [Public release](docs/public-release.md) · [Deployment](docs/deployment.md) · [Offline play](docs/offline-release.md) · [Versioning](docs/versioning.md) |
| Work with AI skills and prompts | [Authoring kit](authoring/README.md): 12 skills and 124 CLI templates, with additional prose workflow examples |
| Review design references and earlier evidence | [Xonix/XPOSED research](docs/research/xonix-and-xposed.md) · [Round 10 research](docs/research/round-10-reference-and-import.md) · [Historical Round 10 verification](docs/verification/round-10.md) |
| Compare earlier visual experiments | [Motion lab](authoring/motion-lab/README.md) · [Reference atlas](docs/concepts/round-09-reference-atlas.html) |

```sh
npm run validate
npm run lint
npm test
npm run format:check
npm run build
node scripts/game-cli.mjs serve --root dist --port 8769
```

The build is a self-contained static website with an explicit offline preparation control. Couch play is local; no online matchmaking, cloud save or global scoreboard service is included. Native iPhone/macOS/Steam packages, physical-device certification and human assessments of difficulty and enjoyment require their own evidence. A responsive browser fixture does not establish those results.

During this development session, the source server uses [port 8767](http://127.0.0.1:8767/game/) and the temporary distribution-verification server uses [port 8791](http://127.0.0.1:8791/game/). The standard launch command remains on 8768. The [saved-version index](http://127.0.0.1:8767/releases/) lists existing frozen builds; the v0.2.0 snapshot is a release step, not implied by its source version number.
