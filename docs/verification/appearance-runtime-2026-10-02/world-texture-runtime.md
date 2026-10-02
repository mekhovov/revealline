# Embedded world image loading

This continuation fixes the default World GLB image decoder under the existing
server security policy. No CSP directive, vendor file, asset revision, authored
course, physics rule, proof format or installed artwork changed.

## Runtime boundary

World flight, spatial editing and built-in scenery use `world-assets.mjs` and
converge on `renderer.loadScene`. World selection thumbnails are SVG course
diagrams; they do not decode GLBs. Creator `.gltf` imports resolve and validate
local sidecars in `inspectImport`, then repack them into a self-contained GLB
before the editor or flight renderer receives the asset.

The pinned GLTFLoader previously selected ImageBitmapLoader, which fetches
`blob:` URLs. The existing server allows blob images through `img-src` but does
not allow those fetches through `connect-src`. GLTFLoader catches a failed image
load and returns a material with no map, so successful model parsing alone did
not prove successful appearance loading.

The shared `configureWorldGLTFLoader` adapter selects Three's image-element
TextureLoader through the existing parser plugin hook. The pinned GLTF parser
continues to set color-space, sampler, UV orientation and alpha semantics.
Provided resources remain owned blobs constrained by the existing URL manager;
unprovided remote URLs are still rejected before decoding. Failed embedded-image
URLs are revoked. After parsing, an image failure is rejected before the old
imported scene is cleared, and the rejected scene's resources use the same
release path as cancelled/superseded loads. The authoring marking viewer reuses
this exact adapter instead of maintaining its own decoder configuration.

## Focused evidence

Node 20.19.5, exact command:

```sh
node --test --test-concurrency=1 \
  game/test/fpv-world-textures.test.mjs \
  scripts/test-world-texture-acceptance.mjs \
  scripts/test-industrial-marking-kit.mjs \
  game/test/fpv-world-content.test.mjs \
  game/test/fpv-world-editor-appearance.test.mjs \
  scripts/test-optional-fpv-package.mjs
```

**34/34 passed**; [TAP receipt](world-texture-focused.tap).
The new tests execute the actual GLTFLoader, TextureLoader and ImageLoader
protocol. Their final browser image event/decoder and WebGL boundary are modeled;
`fetch(blob:)` is explicitly denied to reproduce the defect. They cover exact
embedded PNG bytes, sRGB/UV/sampler/alpha settings, actual local import repacking,
corrupt-image rejection, retention of the previous scene, cancellation cleanup,
unprovided-resource rejection, unbound authored appearance and exact opt-in
material bindings with unavailable-revision fallback. Course originals remain
unchanged and watched resources release once.

Touched ESLint, Prettier and `git diff --check` passed. The retained marking
generator's `--check` passed with identical PNG/GLB bytes and zero Khronos errors
or warnings.

## Actual package fixture

```sh
node scripts/prepare-world-texture-acceptance.mjs --name embedded-png-r1
```

The fixture is at
`dist/world-texture-acceptance-embedded-png-r1/authoring/fpv-worlds/industrial-markings/runtime.html`.
It contains the actual development optional-package output plus four isolated
inspection/source files. The package itself has 91 files / 14,230,524 bytes;
its revision is `a53d045d84f62202a119b8d85dce53906379b4753d367c2b5001af926dbbf8f0`.
`texture-source-manifest.json` binds every emitted file and records working-tree
changes over source HEAD `5fbceaae5c9544af69f570f3a29771b42362aba2`.
The builder writes no duplicate ZIP or full-game distribution.

The later whole-entrypoint gate correctly rejected this initial fixture's missing
first-paint bootstrap. The source page now follows the existing SIM acceptance
page pattern: synchronous shared bootstrap, shared stylesheet and legacy-layer
local layout. The builder includes their bounded authoring-only dependency closure
with font licenses; these files remain separate from the actual optional-package
inventory and its unchanged limits. No first-paint test exemption was introduced.

The corrected immutable snapshot is
`dist/world-texture-acceptance-embedded-png-shared-chrome-1/authoring/fpv-worlds/industrial-markings/runtime.html`.
Its World package revision and every package byte are identical to the initial
snapshot; the initial snapshot remains retained. First-paint plus package checks
passed **10/10**. See the [TAP](world-texture-first-paint.tap) and
[exact added/changed file receipt](world-texture-first-paint.json). Browser
inspection of the corrected chrome is a separate parent-agent check.

The page checks the emitted renderer's hash and the retained GLB's hash, imports
through the real World content path, and displays both the World renderer and
actual spatial editor. Named checks are Gate/Pad/Wedge views, Authored/Industrial/
Dnipro selection, exact reload, corrupt-image rejection and pending cancellation.
The synthetic presentation course is a disposable clone; no simulation,
profile preference or recording host is created. This fixture does not install
the marking kit or add it to a production theme collection.

Frozen launcher builds also fit their unchanged limits; see
[package bounds](world-texture-package-bounds.json):

| Package | Files | Bytes      | Limit              |
| ------- | ----- | ---------- | ------------------ |
| Academy | 67    | 4,119,317  | 72 files / 8 MiB   |
| World   | 99    | 14,388,130 | 104 files / 16 MiB |

These are source/Node/package checks. Actual browser fixture inspection is a
separate parent-agent receipt. Neither the Node protocol nor the standalone
marking viewer establishes flight readability, temporal sampling, performance,
GPU plateau, offline worker recovery or physical-device acceptance.

## Independent gate-cue source review

No blocking geometry, visibility or ownership issue was found in the parallel
gate-cue change: both axes keep the contrasting strips outside the existing
45 mm frame; only the active compatible themed gate is visible; authored and
unavailable-profile paths allocate no cue; shared resources use the existing
release path. Fog/depth flags remain intact. This source review does not claim
pixel-level visual occlusion, which needs a deliberate occluder route.
