# RevealLine

A configurable, Xonix-inspired browser game: leave safe ground, draw a vulnerable cut, close it and reveal a picture. Four visual worlds share the same engine: Ukrainian FPV Front, Ukrainian heritage, 1990s arcade and fictional spend management.

**Play:** [current public game](https://mekhovov.github.io/revealline/game/) · [preserved versions](https://mekhovov.github.io/revealline/releases/). The [production plan](docs/production-plan.md) is the current source of priorities, delivered milestones and remaining work. Implementation is active; earlier review pauses and v0.21-era progress summaries are historical.

The latest verified milestone is [v0.35.0](https://mekhovov.github.io/revealline/releases/v0.35.0/site/game/): optional earned-picture stories and Collection replay, with source, frozen, offline and public acceptance. [Its delivery record](docs/verification/round-45/v035-delivery.md) identifies the exact artifact and limits. This source checkout prepares v0.36 with portable original-picture chapters, three new Sentinel Circuit layouts, 12 new original pictures and simpler chapter menus. Source candidates are not publicly delivered until their release gates pass.

The game includes local scores, replay-backed saved flights, a picture collection, optional chapter installation, a separate two-player couch race, configurable enemies/equipment, MP3 libraries and playlists, and both Immediate and Grid + buffer turning. Releasing a direction keeps the craft moving. In revised Arcade chapters, closing a cut stops it; a fresh direction starts the next move. Enemy contact with an unfinished line creates a travelling impact, leaving a chance to reconnect before it reaches the craft. Older editions retain their own rules.

The remaining production targets include broader map progression, every map/theme illustration, more story rewards, character presentation sets, finished auditioned music and physical-device qualification. The [feedback review](docs/feedback-and-next-steps.md) separates delivered changes from those remaining checks. Automated routes establish reproducibility and legal outcomes, not human enjoyment or hardware certification.

## Run locally

Use a supported Node version: 20.19+ within 20.x, 22.13+ within 22.x, or 24+. Then run from this directory:

```sh
npm run dev
```

Open [solo play](http://127.0.0.1:8768/game/), [Controller practice](http://127.0.0.1:8768/game/controller-lab/), [couch race](http://127.0.0.1:8768/game/couch/), [Replay Theater](http://127.0.0.1:8768/game/replay-theater/) or [the playground](http://127.0.0.1:8768/game/playground/). These routes serve the working source; saved release routes retain their exact frozen builds. The checked-in Phaser bundle is local; starting or building this version needs no CDN. Use `npm ci` to restore pinned dependencies and the formatter. Serve through HTTP rather than opening HTML as a file.

Tap Arrows/WASD to steer; Escape/P pauses. Revised Arcade is direction-only, with contact pickups and no manual Scan/Supply/Boost. Tactical chapters expose equipment only where authored: E uses the current ability, R collects supply where supported, Shift boosts, and a safe hangar may permit craft changes. Read the mission brief for the actual goal and counterplay. Appearance remains independent of gameplay class. Touch controls adapt to input; keyboard and standard-gamepad menu adapters share navigation. Physical-device acceptance remains a separate release gate.

Use **Scores & saves → Saves & loads** for game-data backup and Undo. JSON retains progress, installed gameplay and replay-backed continuation; external original pictures, stories and uploaded music have separate binary inventories. Restore the required originals before their game data. [The transfer contract](docs/feature-delivery-workflow.md#live-pictures-earned-originals-and-paired-recovery) explains `.rlmedia`, `.rlstory` and `.rlsound`. One game tab owns persistence, while additional tabs can play and export session-only progress.

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
