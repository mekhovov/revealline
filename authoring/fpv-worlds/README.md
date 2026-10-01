# FPV world authoring

This folder owns offline preparation tools, authoring recipes and original small
fixtures. It is not included in the browser runtime. Install the exact toolchain:

```sh
npm ci --prefix authoring/fpv-worlds --ignore-scripts
node scripts/fpv-content.mjs prepare authoring/fpv-worlds/fixtures/starter.gltf /tmp/fpv-prepared training-yard
node scripts/fpv-content.mjs pack /tmp/fpv-prepared/project.json /tmp/training-yard.rlpack
node scripts/fpv-content.mjs verify /tmp/training-yard.rlpack
node scripts/fpv-content.mjs zip /tmp/fpv-prepared/project.json /tmp/training-yard.zip
```

`prepare` uses glTF Transform 4.5.1, Khronos Validator 2.0.0-dev.3.10,
Meshoptimizer 1.3.0 and Draco 1.5.7. Packages and transitives are pinned by the
local lockfile. It resolves only supplied local resources, decodes supported
geometry compression, extracts semantics, deduplicates, prunes while keeping
extras/leaves, compares semantic world transforms and validates input/output.
It writes `project.json`, the self-contained model, and `report.json`. It does
not fetch models, resize textures, fabricate collision geometry, grant licenses,
or silently flatten/center/join a scene. Browser import rejects KTX2; use source
PNG/JPEG textures for this profile. Animated morph weights are not yet admitted.

## Blender source

Use the pinned Blender 4.5.14 LTS and its built-in glTF exporter. The script rejects a different patch so exports have a reproducible baseline. Keep original
`.blend` files and linked asset libraries outside generated outputs. Collections
can be marked as assets for reusable gates, posts, buildings, and themed material
sets. Geometry, collision markers and route markers should remain separate.

```sh
blender --background source.blend --python authoring/fpv-worlds/export_world.py -- --output /tmp/source.glb
blender --background --python authoring/fpv-worlds/export_world.py -- --starter --save-source /tmp/starter.blend --output /tmp/starter.glb
```

`--starter` intentionally creates a new procedural scene in the current Blender
process. The starter marks its gate collection and materials as reusable library assets. The script is syntax checked; running Blender is a separate acceptance
check when Blender is available. The exporter writes a receipt with its exact
Blender version. `export-preset.json` documents the repeatable settings.

Every semantic node has custom object property `rl`, exported into `extras.rl`:

```json
{ "id": "gate-01", "kind": "gate", "width": 3.6, "height": 3.6, "order": 0 }
```

Supported kinds: `spawn`, `gate`, `checkpoint`, `landing`, `collider`, `landmark`,
`actor`. IDs are stable across reexports. Collider markers use `size: [x,y,z]`
in glTF local metres (width, height, depth); their exported world matrix carries
rotation and scale. Blender's exporter does not transform custom-property
vectors: the starter explicitly maps Blender XYZ dimensions to glTF XZY.
Consumers convert metres to the deterministic flight model's integer units.
Display meshes never create collisions automatically. Animation may affect
cosmetic geometry/rigs but cannot move semantic nodes or their ancestors. Rigs
allow up to 64 joints, clips 128 tracks and 4096 keys per track, with a
100,000-key aggregate limit.

## Editable project contract

```json
{
  "format": "FPVWorldProject.v1",
  "id": "training-yard",
  "title": "Training yard",
  "world": {
    "id": "training-yard",
    "title": "Training yard",
    "modelAsset": "models/training-yard.glb"
  },
  "source": { "hash": null, "anchors": [], "colliders": [] },
  "overrides": {},
  "courses": [],
  "themes": [],
  "campaigns": [],
  "playlists": [],
  "provenance": []
}
```

`source` records extracted source data. `overrides` maps stable marker IDs to
local changes (`position`, `matrix`, `size`, or `deleted`). Reimport replaces
source data and preserves overrides; removed IDs are retained as diagnosed
orphan overrides rather than silently discarded. Courses are authored
independently using the flight-course schema; playlists/campaigns reference
course IDs. `compilePlayable` resolves source + overrides. `resolveExperience`
selects one course/theme/list. Changing scenery does not rewrite old proofs.
Include source URL, author, license and changes in `provenance` before sharing.

## Formats, integrity, and installation

- `.rlpack` v2 uses eight-byte `RLFPV2\r\n` magic, a little-endian uint32 JSON
  manifest length, canonical UTF-8 JSON, and raw assets in manifest order.
  Every asset descriptor includes exact SHA-256 and byte length. No trailing,
  duplicate, case-colliding, absolute, parent-traversal or URL resources pass.
  The legacy `.rlpack` reader is unchanged; this is a distinct format.
- Editable `.zip` contains `project.json` and the same local assets. The bounded
  initial profile accepts unencrypted STORE entries with UTF-8 paths, no ZIP64,
  descriptors, comments, extra fields or symlinks. CRC32 and local/central
  metadata are checked. Use the provided exporter to preserve this profile.
- Both readers validate the model before installation. Browser SHA-256 requires
  a secure context (`localhost` or HTTPS). Limits: 16 MiB playable GLBs, 64 MiB packs,
  128 files, 2048 nodes, 512 meshes, 64 images, 256 materials, 128 textures,
  8 lights, 2 million vertices per accessor, 4 MiB JSON; texture
  dimensions at most 4096 with 32 million aggregate source pixels.
- `openWorldStore` stores Blobs and project metadata in IndexedDB. All hash and
  model validation completes before a single readwrite install transaction.
  The expected generation is checked inside that transaction. Failure/abort
  preserves the previous metadata and blobs. No localStorage atomicity claim.

Run `node --test game/test/fpv-world-content.test.mjs scripts/test-fpv-content.mjs`.
The storage tests use fake-indexeddb; real-browser quota/context-loss checks
remain separate from these deterministic transaction tests.

## Source references

- https://docs.blender.org/manual/en/4.5/addons/import_export/scene_gltf2.html
- https://github.com/KhronosGroup/glTF-Validator
- https://gltf-transform.dev/cli
- https://github.com/KhronosGroup/glTF-Asset-Generator

Fixtures generated by `fixtures/create-fixture.mjs` are original procedural test
content dedicated to CC0. They are intentionally tiny and do not represent a
finished environment or certify performance for third-party assets.
