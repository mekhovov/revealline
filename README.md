# RevealLine

A configurable, Xonix-inspired browser game: leave safe ground, draw a vulnerable cut, close it and reveal a picture. The first campaign has eight levels, four visual worlds, five gameplay classes, two steering modes and cosmetic character choices. The Ukrainian FPV world is the main direction; Ukrainian heritage, 1990s arcade and fictional spend management share the same capture rules.

## Run locally

Use Node 20.19 or newer, then run from this directory:

```sh
npm run dev
```

Open [the game](http://127.0.0.1:8768/game/) or [the playground](http://127.0.0.1:8768/game/playground/). The checked-in Phaser bundle is local; starting this version does not require a CDN or an npm install. Use `npm ci` when restoring pinned dependencies or using `npm run format:check` / `npm run format`. Serve through HTTP rather than opening the HTML as a file.

Arrows/WASD move, Shift boosts, E uses the class ability, R collects nearby supplies, and Escape/P pauses. The page also has touch controls and a standard-gamepad adapter. Choose **Immediate** or **Grid + buffer** steering in the flight deck; changing class or steering starts a fresh attempt. Appearance stays cosmetic.

## Choose a workspace

| Need | Start here |
|---|---|
| Play, controls and current scope | [Game guide](game/README.md) |
| Change a picture, theme, map or class | [Assets and configuration](docs/assets-and-configuration.md) · [Playground](http://127.0.0.1:8768/game/playground/) |
| Develop and test | [Development](docs/development.md) · [Core contract](game/core/README.md) |
| Build a website or compare saved versions | [Deployment](docs/deployment.md) · [Versioning](docs/versioning.md) |
| Export and verify a run | [Replays](docs/replays.md) · [Campaign completion fixtures](game/replays/campaign-routes.json) |
| Work with AI skills and prompts | [Authoring kit](authoring/README.md): 11 skills, 124 shared prompt templates |
| Review the plan and source evidence | [Implementation plan](docs/round-10-implementation-plan.md) · [Latest reference/import research](docs/research/round-10-reference-and-import.md) · [Xonix/XPOSED research](docs/research/xonix-and-xposed.md) |
| Verify this delivery | [Verification report](docs/verification/round-10.md) · [Local playable versions](http://127.0.0.1:8767/releases/) |
| Compare earlier visual experiments | [Motion lab guide](authoring/motion-lab/README.md) · [Reference atlas](docs/concepts/round-09-reference-atlas.html) |

```sh
npm run validate
npm test
npm run build
node scripts/game-cli.mjs serve --root dist --port 8769
```

The build is a static website. Native iPhone, Steam and desktop wrappers, offline caching, physical-device performance and human playtesting remain separate delivery checks. Earlier authoring packs and lab formats are preserved design tools; they are not automatically importable into the playable game.

The active development server in this session uses port **8767**: [play](http://127.0.0.1:8767/game/), [edit and test](http://127.0.0.1:8767/game/playground/), [compare frozen versions](http://127.0.0.1:8767/releases/). The standard launch command remains on 8768 so it does not replace an existing server.
