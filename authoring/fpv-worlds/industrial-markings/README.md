# Industrial marking production proof

A small **produced, not yet visually reviewed** source kit for the Industrial
Workshop family: four gate service plates, one landing-pad H/ring/orientation
mark, and a neutral calibration wedge. This is original deterministic mechanical
pixel artwork, not an AI-generated image, scanned texture or imported game asset.

It does not install a collection or change an existing renderer, course, collision,
proof, package policy, or saved `industrial-workshop@r1` reference. The decorative
role metadata uses `extras.markingAnchor`; it deliberately has no `extras.rl` or
automatic material-replacement binding. The World importer reports **zero
semantic anchors and zero colliders**. Existing simulation geometry is not inferred
from a visible marking.

## Source and production

- `r1/source.json`: original data recipe, semantic palette, dimensions, role names,
  author/license and exact installed collection dependency.
- `generate.mjs`: generator with bounded data admission and pinned tool checks.
- `r1/markings.png`: original 128×128 RGBA atlas, 981 bytes. H strokes and a separate
  north triangle use quiet enamel and ink; amber remains a restrained guidance role.
- `r1/markings.glb`: 8,152-byte self-contained glTF 2.0 model with the same embedded
  PNG, six primitives / twelve triangles. No decoder, external URI or extra asset
  dependency is introduced.
- `r1/manifest.json`: exact original source bytes, generator/PNG encoder/lockfile
  hashes, output hashes, actual bounds, and full Khronos validator report.

The only offline tools are the existing `@gltf-transform/core` 4.5.1 and
`gltf-validator` 2.0.0-dev.3.10 from the FPV authoring lockfile. The production proof
uses the repository's deterministic PNG encoder. No dependency install or new
package ecosystem is required when the existing authoring tools are present.

```sh
node authoring/fpv-worlds/industrial-markings/generate.mjs --check
node --test scripts/test-industrial-marking-kit.mjs
```

`--write` creates missing outputs only, after checking every existing output for
exact equality. It refuses an altered previous artifact. A successor lives in a
new directory such as `r2`, sets source `revision` to `r2`, and sets `previous` to
the SHA-256 of the exact retained `r1/manifest.json`; then use `--write r2` and
`--check r2`. Keep the earlier source/output files. A changed generator is identified
by its exact hash; old generator bytes remain in Git and must be used to reproduce
an older receipt after a generator change. No `--force` rewriting route exists.

## Geometry and color contract

All geometry is in metres with +Y up. The reference gate has a 3.6×2.8 m opening;
plate inner edges sit 15 mm outside it. The pad's visible marks remain inside the
existing 1.3 m host radius. The source kit's gate and pad translations merely lay
out an inspection scene; they are not proposed gameplay placements. The neutral
swatch node is explicitly marked `notForRuntime`.

Base-color PNG samples are sRGB. Roughness 0.86 and metalness 0 are linear scalar
properties; no color image is reinterpreted as a normal map. Alpha uses MASK at
0.5. The sampler uses linear magnification and trilinear mipmapped minification,
with clamp wrapping; the runtime viewer caps anisotropy at 4. This world-surface
sampling is separate from the nearest-scaled 2D atlas inspection. Grayscale samples
0/64/118/192/255 compare texture decoding with reference material factors; 118 is
approximately 18% linear gray.

The atlas has small cells; mip bleed, alpha silhouette retention and temporal
shimmer at distant/grazing views remain visual acceptance concerns. Passing the
standards validator does not settle those questions. Texture resolution or gutter
changes require another source revision before adoption.

The source declares semantic ink/steel/enamel/guidance roles rather than hardcoded
runtime family dispatch. The test produces a separate in-memory DOS recoloring
with an exact available collection dependency and proves identical geometry.
Missing revisions fail closed. This proves authoring portability, not arbitrary
player installation or production support for unregistered assets.

## Actual viewer and validation boundary

Open `/authoring/fpv-worlds/industrial-markings/` on the ordinary local source
server. The viewer verifies the emitted GLB hash, then uses the **same pinned Three
GLTFLoader as the game** to decode the embedded PNG and geometry. It does not claim
an independent viewer. Khronos' standards validator is a separate implementation;
glTF Transform also reads the binary back and checks the embedded texture bytes.
The authoring viewer explicitly selects the loader's `TextureLoader` image-element
decoder. This uses the existing `img-src blob:` permission for the embedded PNG;
the default `ImageBitmapLoader` instead fetches blob URLs, which the ordinary
server's `connect-src` policy rejects. No CSP, vendor code, or GLB bytes are changed.
This decoder selection is a viewer configuration, not evidence that every runtime
host already accepts textured GLBs under its own CSP.

Compare whole kit, gate, gate detail, pad and grazing views. The thin gray rectangle
and plain host disk are viewer reference geometry only. Toggle **Unlit color
comparison** to compare the textured wedge with the linear-factor reference swatches
without lighting/tone mapping. Ordinary inspection uses sRGB output and the game's
ACES Filmic mapping at exposure 1.08. The viewer writes no player preferences.

Tests run the **existing** `prepareWorldFile` pipeline on the actual GLB, invoke
its input/output Khronos validators, and compare exact vertex/normal/UV/index data,
world matrices, role extras and embedded texture before/after optimization. They
also decode the complete PNG scanlines, check aperture and pad envelopes, test
malformed data/absent pins, and reject a standards-invalid accessor.
The real GLTFLoader regression verifies the exact embedded PNG, material sRGB
assignment, and image-element loader selection. Its Node fixture models only the
final image callback; browser decoding and GPU display still require visual review.

Static inspection in the actual in-app browser passed on 2026-10-02 after the
image-element decoder correction: gate chevrons/rivets were clear and separate
from the aperture reference; the landing H, ring and orientation triangle were
identifiable; the H remained discernible at the grazing view; and all five unlit
texture grays visibly aligned with their reference swatches. See the scoped
[browser receipt and four captures](../../../docs/verification/appearance-continuation-2026-10-02/industrial-marking-review.md).
The produced source manifest remains unchanged and records its original
pre-review stage; later review evidence lives outside that immutable receipt.

Actual in-flight placement, readability at distance, temporal sampling,
GPU/resource plateau, physical-device checks and an independent rendering-engine
comparison remain **unqualified**. In particular, the default runtime embedded-PNG
loader still needs a CSP-compatible integration before this kit can be adopted.
Runtime adoption needs a new
reviewed collection revision, exact dependency closure and preserved authored
fallback; it must not replace the installed r1 collection in place.
