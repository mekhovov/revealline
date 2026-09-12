# RevealLine

A configurable, Xonix-inspired browser game: leave safe ground, draw a vulnerable cut, close it and reveal a picture. The v0.10.0 source includes 12 campaign maps, sixteen more maps in five installable expansions, four visual worlds, seven gameplay classes and both immediate and grid-buffered steering. Ukrainian FPV Front is the main direction; Ukrainian heritage, 1990s arcade and fictional spend management use the same simulation.

Picture celebrations and a persistent gallery reward completed missions. Searchable, paged local scores and pictures, complete portable backups, suspended attempts, dated challenges, five original synthesized music styles and a separate two-player couch race extend the game. Data-only expansions can supply campaigns, maps, classes built from registered abilities, themes, images and music recipes. Replay Theater plays verified recordings with pause, restart, single-tick steps and speed controls, including four Fieldcraft examples.

## Run locally

v0.10.0 makes [chapter appearance rewards](docs/chapter-rewards.md) attainable in short campaigns, shows exact unlock progress, and adds a brief reward message beside the completed picture. Completed missions remain replayable after an out-of-order restore. This working iteration keeps simulation, saves and equipment seals compatible with v0.9.0; its browser and release checks are in progress.

v0.9.0 adds [pack-authored equipment goals](docs/pack-mastery-contract.md), editable practice definitions and the three-map [Equipment Workshop](docs/equipment-workshop.md) across Ukrainian heritage, 1990s arcade and spend-management themes. Copy, edit, disable and export goals without changing simulation code. Existing records remain archived when definitions change; practice stays non-awarding after mission selection. `inspect-goals` reports content and reference checks separately from gameplay proof.

v0.8.0 adds [Supply Line and Safe Return](docs/equipment-seals.md): optional goals for supply refills, suppressed crossings, a hangar switch and impact recovery. Named pause checklists distinguish accepted actions and safely banked progress; flight uses a compact summary. All three Homeward pictures can now carry a replay-verified equipment seal. Existing simulation, map, replay and save identities are preserved.

v0.7.0 adds [Steady Signal](docs/round-17-mastery-increment.md), an optional equipment seal for Copper Orchard. Its live goal distinguishes an open line from a safely closed cut. Winning attempts are replay-checked before a seal is saved beside the picture; older libraries migrate with no inferred equipment awards. Saved flights reconstruct the goal, and ordinary mission progression remains available without it.

v0.5.0 adds [controller navigation](docs/controller-navigation.md) for the solo menus, hangar, results and collection, plus a [Controller practice lab](docs/controller-practice.md) that drives the actual game using a simulated pad. A deliberate join, released-input boundaries and draft selection prevent menu presses from spilling into flight. v0.6.0 adds [controller settings](docs/controller-settings.md): complete button layouts, position/Xbox/PlayStation labels, separate flight/menu sticks, inversion and press/release thresholds. Draft changes apply together; cancellation preserves the active layout. The practice lab exposes all 16 standard buttons and both sticks. Physical-device verification remains separate work.

v0.4.0 adds [Homeward Skies](docs/homeward-skies.md), a three-picture illustrated Ukrainian chapter, clear campaign continuation and [reviewed earlier-release copying](docs/continuity-transfer.md). v0.4.1 fixes selecting the same backup, pack or authoring asset again after a previous import. [Native app wrappers](docs/native-distribution.md), asynchronous file sharing, custom keyboard controls and persistent Tap steering remain available. Packaged versions keep separate collections; copying or complete backups transfer progress forward while older versions remain unchanged.

The saved [v0.9.0 game](http://127.0.0.1:8767/releases/v0.9.0/site/game/) and [Controller practice](http://127.0.0.1:8767/releases/v0.9.0/site/game/controller-lab/) are available while the workspace server runs. Install Homeward Skies or Equipment Workshop from **Library & saves → Expansion packs**, then choose its Play button. The [frozen browser and offline checks](docs/verification/round-19/frozen-browser.md) and [reproducible archive evidence](docs/verification/round-19/integrity-notes.md) identify this saved build. All twelve earlier versions, including [v0.8.0](http://127.0.0.1:8767/releases/v0.8.0/site/game/), remain independently playable.

Use a supported Node version: 20.19+ within 20.x, 22.13+ within 22.x, or 24+. Then run from this directory:

```sh
npm run dev
```

Open [solo play](http://127.0.0.1:8768/game/), [couch race](http://127.0.0.1:8768/game/couch/), [Replay Theater](http://127.0.0.1:8768/game/replay-theater/) or [the playground](http://127.0.0.1:8768/game/playground/). The checked-in Phaser bundle is local; starting or building this version needs no CDN. Use `npm ci` to restore pinned dependencies and the formatter. Serve through HTTP rather than opening HTML as a file.

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
