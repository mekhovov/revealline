# Local edition packaging before Confirm integration — 2026-09-29

This evidence binds the frozen qualification source **before** integration of remote Confirm corrections into `c5e3419ee`. It does not certify that successor. The successor’s web/native evidence is retained separately under `../integrated-c5e3419ee/`.

**14/14 development editions compiled successfully.** Package/build config version is **0.142.3**, unchanged; these artifacts are not release-admitted or published. No native staging is claimed here.

The earlier unchanged-compiler failure remains recorded in the parent directory: the Dutch aggregate exceeded its 64 MiB offline limit by 209,693 bytes. The repair adds a separate lossless runtime WebP of the supplied DroneAid photograph. Both original PNG files remain byte-identical. The derivative preserves every decoded RGBA byte and its 2000 × 1545 dimensions while saving 386,709 asset bytes. No campaigns, retained compatibility content, scripts, frozen replay variants or budget limits were removed or weakened.

The final largest inventory is **droneaid-nl-community: 66,931,943 bytes / 693 files**, leaving **176,921 bytes** under the unchanged **67,108,864-byte** limit. All fourteen inventories and build manifests are retained under `edition-inventories/`, and `edition-compilation.json` is the checker's complete report. The task-owned edition bodies were removed only after checking their retained inventory pairs, to free disk for native staging. `edition-body-cleanup.json` records that cleanup; `locations.json` retains their historical locations.

`edition-audit.json.gz` independently reads back **506 source/output/offline-inventory byte-and-SHA checks**: 36 shared required paths for each edition, plus the selected Dutch derivative and supplied SVG. This includes the Worker, audio, background clock, analog rendering, bundled catalog and all twelve frozen replay variants. Only the Dutch aggregate contains the new derivative; no edition redundantly contains the retained original PNG. Browser qualification tests are excluded from these packaged inventories.

**1,071 captured source inputs are identical before and after compilation**, including actual compiler/engine/selected content, the targeted image producer, and both original PNGs. The production runtime remained frozen throughout. `lossless-repair.json` links the unchanged originals, derivative and exact decoded-RGBA proof; the producer's read-only `--check` passed.

Validation:

- Scene and edition runtime tests: **34/34 passed** (25 scene tests plus 9 edition tests).
- Fresh sequential packaging cohort: **15/15 passed** (boot 3, edition runtime 9, offline closure 3; edition tests overlap the preceding group).
- After adding the active WebP to exact tiny-build/native-staging asset assertions, boot tests were rerun: **3/3 passed** (`boot-build-derivative.tap`).
- Scoped ESLint, Prettier and `git diff --check` passed.
- Independent read-only review repeated the exact decoded-RGBA and producer checks without finding a blocker.

Commands:

```sh
uv run --offline --with pillow==12.1.1 python scripts/prepare-menu-scenes.py --scene droneaid-nl-community --check
node --test game/test/menu-scenes.test.mjs game/test/edition-runtime.test.mjs
node --test game/test/boot-build.test.mjs
node --test scripts/test-offline-core-closure.mjs
node scripts/check-menu-editions.mjs /private/tmp/revealline-demo-editions-qualification-20260929-3vaq5o0d/editions-lossless
```

This establishes development compilation, source stability, exact packaged closure and the unchanged offline cap. Browser durability/gameplay, wall-clock observation, full-web packaging, native payload staging, physical devices and release admission require their separate evidence.

The exact subsequent web build was staged and independently verified for desktop and iOS before Confirm integration: web/desktop 1,893 files / 755,904,167 bytes; iOS 1,898 files / 755,987,836 bytes with its existing official plugin bridge and four diagnostics. All 34 HTML transformations match the native policy, and 38 actual desktop-protocol requests match inventory bytes and MIME responses. `web-native-static-audit.json` and the platform stage/verify JSON records retain this static evidence. The source web manifest SHA-256 is `691051ed7f57e989b4b56350640b7113d2cfffac66ee5e2bff187d1d4509a5dc`; the archive is `13994aa6b4414afc2c914943e7ac63227048ccc321d82f87f7681a58a7809866`. These old generated bodies were removed after retaining their proofs, as recorded by `native-web-body-cleanup.json`, before rebuilding the integrated successor at the same temporary locations. No app executable, hardware behavior or newer source is certified by this earlier evidence.
