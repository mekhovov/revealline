---
id: getting-started
title: Getting started
importance: high
filePaths:
  - package.json
  - README.md
  - scripts/game-cli.mjs
  - services/community/package.json
  - platforms/desktop/package.json
  - platforms/ios/package.json
  - authoring/fpv-worlds/package.json
relatedPages:
  - overview
  - architecture
  - testing
  - operations-and-configuration
---

# Getting started

RevealLine's main development target is a static browser application served by a Node CLI. The root package uses JavaScript modules and accepts Node `^20.19.0 || ^22.13.0 || >=24`; its development command serves the checkout on port 8768. [package.json:5](../../package.json#L5), [package.json:7](../../package.json#L7), [package.json:11](../../package.json#L11)

## Local browser workflow

From the repository root:

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:8768/game/`. The README also lists `/game/controller-lab/`, `/game/couch/`, `/game/replay-theater/`, and `/game/playground/`. The checked-in renderer bundle is local; use HTTP, since opening the document as a file is unsupported. [README.md:17](../../README.md#L17), [README.md:23](../../README.md#L23)

The server defaults to loopback. A custom port/root can be passed directly to the CLI; a built distribution can be inspected separately:

```sh
npm run build
node scripts/game-cli.mjs serve --root dist --port 8769
```

Build defaults to `dist`, while `serve` resolves the supplied directory and uses port 8768 unless overridden. These are documented source commands, not commands executed during this wiki generation. [scripts/game-cli.mjs:1016](../../scripts/game-cli.mjs#L1016), [scripts/game-cli.mjs:1447](../../scripts/game-cli.mjs#L1447)

## Choose the relevant package

| Work area                     | Entry command or package                                                                 | Boundary                                                                                                                                                                                                                         |
| ----------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser game and static build | Root `npm run dev`, `npm run build`                                                      | Root scripts invoke `scripts/game-cli.mjs`. [package.json:11](../../package.json#L11)                                                                                                                                            |
| Community backend             | `npm --prefix services/community start` and `npm --prefix services/community run worker` | Independent package with server, worker, auth migration, and service tests; follow the [community page](community-service.md) for prerequisites. [services/community/package.json:10](../../services/community/package.json#L10) |
| Desktop shell                 | `npm run desktop:start`                                                                  | Delegates to the Electron package; requires its native stage and package dependencies. [package.json:23](../../package.json#L23), [platforms/desktop/package.json:7](../../platforms/desktop/package.json#L7)                    |
| iOS scaffold                  | `npm run ios:doctor`, `npm run ios:sync`                                                 | Delegates to the Capacitor package; this is separate from browser serving. [package.json:25](../../package.json#L25), [platforms/ios/package.json:10](../../platforms/ios/package.json#L10)                                      |
| FPV scenery preparation       | `authoring/fpv-worlds/package.json`                                                      | Dedicated glTF tooling dependencies, separate from the root runtime dependencies. [authoring/fpv-worlds/package.json:5](../../authoring/fpv-worlds/package.json#L5)                                                              |

Package engine requirements differ: desktop declares Node `>=22.22.2`, and iOS declares `>=22.0.0`. Check the package you are working in rather than applying the root minimum to every tool. [platforms/desktop/package.json:9](../../platforms/desktop/package.json#L9), [platforms/ios/package.json:7](../../platforms/ios/package.json#L7)

## Evidence

- [package.json:10](../../package.json#L10): authoritative root commands.
- [scripts/game-cli.mjs:1439](../../scripts/game-cli.mjs#L1439): command dispatch and options.
- [README.md:50](../../README.md#L50): documented local validation/build sequence.

## Coverage and limitations

Retrieval terms: `scripts`, `engines`, `serve`, `buildProject`, `start`, `native:sync`. Seven manifests/entry documents were read or selectively inspected. Dependency installation, server startup, and native tooling were not exercised; this page establishes how the repository is configured to run.

## Related

[Overview](overview.md) · [Architecture](architecture.md) · [Testing](testing.md) · [Operations and configuration](operations-and-configuration.md)
