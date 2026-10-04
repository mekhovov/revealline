---
id: overview
title: Overview
importance: high
filePaths:
  - README.md
  - package.json
  - game/build-config.json
  - game/core/index.mjs
  - game/runtime-content-provider.mjs
  - services/community/package.json
  - platforms/desktop/package.json
  - platforms/ios/package.json
relatedPages:
  - getting-started
  - architecture
  - runtime-data-flow
  - content-and-authoring
  - persistence-and-replays
  - community-service
  - testing
  - operations-and-configuration
---

# Overview

RevealLine is a configurable, Xonix-inspired territory-capture browser game: the player leaves safe ground, draws a vulnerable cut, and closes it to reveal a picture. The repository combines the player experience with authoring tools, content editions, local multiplayer, replay/save workflows, native wrappers, and a separately packaged community service. [README.md:3](../../README.md#L3), [README.md:7](../../README.md#L7), [README.md:13](../../README.md#L13), [README.md:29](../../README.md#L29), [services/community/package.json:6](../../services/community/package.json#L6)

## Identity and main boundaries

The root package identifies itself as `revealline`, uses JavaScript ES modules and npm, and declares version `0.142.4`. Its build config uses the same version and enters at `game/index.html`. Pinned root dependencies include Phaser, i18next and Mediabunny. These are local manifest observations, not a claim about the current public deployment. [package.json:2](../../package.json#L2), [package.json:44](../../package.json#L44), [game/build-config.json:1](../../game/build-config.json#L1)

The deterministic core owns mutable gameplay state. The browser shell and renderer consume that state; external mutation invalidates replay guarantees. Company editions supply content and presentation to the shared Solo host, which retains control of input, difficulty and the update loop. [game/core/index.mjs:57](../../game/core/index.mjs#L57), [game/runtime-content-provider.mjs:82](../../game/runtime-content-provider.mjs#L82)

The README describes local progression, picture collections, saved flights, installable chapters, and separate originals for imported media. It also explicitly describes couch play as local and leaves native device qualification unfinished. Electron and Capacitor dependencies live in their own package manifests. [README.md:7](../../README.md#L7), [README.md:27](../../README.md#L27), [README.md:59](../../README.md#L59), [platforms/desktop/package.json:17](../../platforms/desktop/package.json#L17), [platforms/ios/package.json:19](../../platforms/ios/package.json#L19)

## Reading routes

| Your question                                            | Page                                                            |
| -------------------------------------------------------- | --------------------------------------------------------------- |
| How do I run the checkout?                               | [Getting started](getting-started.md)                           |
| Where are the main boundaries?                           | [Architecture](architecture.md)                                 |
| How does an input become a gameplay tick?                | [Runtime data flow](runtime-data-flow.md)                       |
| How do projects, editions, and themes reach play?        | [Content and authoring](content-and-authoring.md)               |
| How do writing ownership, backups, and replays work?     | [Persistence and replays](persistence-and-replays.md)           |
| How are community packages uploaded and installed?       | [Community service](community-service.md)                       |
| Which checks run, and where are coverage gaps?           | [Testing](testing.md)                                           |
| How do static/offline/native builds and releases differ? | [Operations and configuration](operations-and-configuration.md) |

## Evidence

- [README.md:3](../../README.md#L3): product description.
- [package.json:10](../../package.json#L10): developer entry commands.
- [game/core/index.mjs:57](../../game/core/index.mjs#L57): simulation ownership.
- [game/runtime-content-provider.mjs:82](../../game/runtime-content-provider.mjs#L82): edition/host separation.

## Coverage and limitations

Retrieval terms: `name`, `scripts`, `entry`, `createRun`, `edition`, `community`. Eight sources were inspected for this orientation. The wiki describes the dirty local snapshot recorded in the [index](README.md); historical delivery claims are not treated as live release status. No remote deployment, player experience, or device acceptance was verified.

## Related

[Getting started](getting-started.md) · [Architecture](architecture.md) · [Runtime data flow](runtime-data-flow.md) · [Content and authoring](content-and-authoring.md) · [Persistence and replays](persistence-and-replays.md) · [Community service](community-service.md) · [Testing](testing.md) · [Operations and configuration](operations-and-configuration.md)
