# Selected-world resources and offline capacity

The six-world expansion keeps one selected battlefield in memory. All 18 authored layouts use the same 1,327 actor/effect frames; the environment does not multiply the sprite atlas. Native artwork remains generated once into retained world tiles.

| Device texture edge | Sprite pages | World tiles | Sprite RGBA bytes | World RGBA bytes | Total base GPU bytes |
| ------------------- | -----------: | ----------: | ----------------: | ---------------: | -------------------: |
| 2,048               |            1 |           6 |        16,026,240 |       12,441,600 |           28,467,840 |
| 512                 |           18 |          18 |        15,787,328 |       12,441,600 |           28,228,928 |

Both fit the 32 MiB base budget. Recovery retains an additional CPU canvas copy of the same size. Preparation scratch is 16,384 bytes and is released after preparation. Decoded appearance images, Phaser render targets and other host textures are separate; this is not a total process-memory claim.

The renderer/presentation-host suite passes 50 tests. New coverage checks all 18 compiled layouts and ten V4 renderer lifecycles spanning all six worlds, alternating the two texture limits and 1,500/2,500-actor workloads. Selected custom material/prop/panel sources are painted, textures are uploaded once, context events preserve 700/1,200 visible actors, retry reuses prepared pixels, and double disposal releases every owned canvas and context listener. Existing tests also cover failed preparation, deterministic non-overlapping atlas packing, custom actor frames, reduced-effects parity and decoded-image ownership.

These lifecycle checks use the Phaser contract fake. They do not establish GPU timing, real browser context recovery or a physical-device soak.

## Offline sizes

`resource-accounting.mjs` builds the real standalone optional package manifests and ZIP buffers in memory; no archive is written. Exact current totals:

| Package         | Complete files | Complete bytes |  ZIP bytes | Policy bytes |
| --------------- | -------------: | -------------: | ---------: | -----------: |
| civilian-flight |             84 |      3,553,050 |  3,565,530 |    8,388,608 |
| civilian-fpv    |             89 |      6,547,343 |  6,560,809 |    8,388,608 |
| fpv-worlds      |            124 |     16,968,363 | 16,988,123 |   20,971,520 |

These are development standalone packages without the additional frozen-release launcher. Their admission limits remain unchanged. Compared with stack base `6e16bd5b9`, the exact admitted source closure grows 58,964 bytes for civilian-flight and 58,738 bytes for the other two packages. This source delta excludes generated manifest/worker/icon overhead; it is not a compressed-archive or complete-main-PWA delta. The three added shared sources total 50,773 bytes. Existing native source changes account for the rest. No raster assets are duplicated for individual modes or worlds.

The JSON report retains every selected resource slot, each layout's inventory, exact package revisions and file hashes. The separate offline tests pass 79 cases, including real source bytes for all 18×5 layout/operation routes, fresh installation, rejected incomplete updates, retained prior installation and exact retry recovery.

## Reproduction

```sh
node --test game/test/overflight-renderer.test.mjs game/test/presentation-host.test.mjs
node --test game/test/offline.test.mjs scripts/test-offline-core-closure.mjs
node docs/qualification/overflight/maps-movement-20261014/resource-accounting.mjs
```

Native installed-PWA review uses `native-offline-server.mjs`. It refuses uncommitted runtime sources, calls the complete production `prepareBuildProject()` API, validates every generated offline pin and serves the immutable entry map from memory. It writes only a small qualification report. Origin resources can then be denied through its localhost qualification control; the normal installed-app UI and real generated worker remain unmodified. Browser evidence is recorded separately.
