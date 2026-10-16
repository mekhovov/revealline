# Bounded Tropical material review, revision 1

These two derived previews exercise the production regional scenery path. They are not a playable Tropical world, a Library row, a complete collision design or a package admission. The eight original intake models and images remain unchanged in `../intake-v1`.

The separate `FPVRegionRgbaScenery.v1` format retains UVs, authored normals, linear vertex colours, alpha cutouts and material sidedness. It permits only bounded embedded RGBA8 pixels, never arbitrary runtime image decoding or external texture URLs. Existing colour-only and indexed scenery contracts remain unchanged.

## Provenance and deliberate reductions

The inputs come from Ron Kapaun / 3TD Studios' CC0 Tropical Environment Pack v2.0. See `../intake-v1/LICENSE.txt`, `provenance.json` and the pinned original archive/selection records there. This is a derivative of those same assets under CC0. `receipt.json` binds each original GLB, original image, derived pixel resource, source JSON and canonical derived GLB by SHA-256.

Textures are downsampled in authoring with Pillow 12.3.0 LANCZOS to 128 × 128 pixels each. This deliberately reduces texture detail to fit the existing bounded resource contract. Normal/specular maps and wind were already excluded from the original intake. Production scenery uses matte materials (roughness 1, metalness 0); the original intake used roughness about 0.91. This is a bounded material reproduction, not pixel-perfect reproduction of every original shader parameter.

Coordinates are centred within one 128 m source cell, grounded at the original minimum height and rounded to millimetres. Authored normals, UVs and linear vertex tints are retained. No triangles were removed from either preview. Vertex colours matter: an early comparison exposed that omitting palm tints made its trunk and foliage too pale. The corrected source/compiler and production geometry retain those colours, including bounded alpha, and charge their memory.

| Preview       | Triangles | Solid surfaces | Visual-only surfaces | Source bytes | Canonical GLB bytes |
| ------------- | --------: | -------------: | -------------------: | -----------: | ------------------: |
| Palm          |       688 |        1 trunk |            3 foliage |      653,703 |             375,872 |
| Covered jetty |       492 |              3 |                    0 |      394,878 |             254,092 |

For this material review, opaque trunk/structure surfaces are explicitly solid; alpha-cutout foliage is explicitly visual-only. The runtime never infers collision from transparency: each binding requires its own classification. A future world must author and test collision intentionally rather than treating these preview choices as universal rules. In particular, the low-polygon leaf planes do not form invisible solid walls; trunk and structure collision remain present.

## Format bounds

Each source has an exact `format`, `cell`, `textures`, `bindings` envelope. The nested cell retains all existing scenery position, triangle and complexity validation. Each surface has exactly one binding with `surfaceId`, `textureId`, `uvs`, `normals`, `colors`, `alphaMode`, `alphaCutoff`, `doubleSided` and `collision`.

- At most four textures, power-of-two dimensions no larger than 256, at most 65,536 pixels in aggregate per cell.
- Canonical Base64 contains exactly width × height × four RGBA8 bytes. Texture URLs, unsupported sampler values and unused/duplicate textures are rejected.
- UVs are finite and bounded by ±16; normals are finite unit vectors. Colours are either empty or one finite linear RGBA value in [0,1] per vertex.
- Only OPAQUE and MASK materials are admitted. Cutoff is finite [0,1], zero for OPAQUE; sidedness is boolean and collision is exactly solid or visual-only.
- Existing 1 MiB source, 512 KiB canonical GLB and 8 MiB live/staging resource ceilings remain unchanged. Geometry accounting includes UVs and vertex colours. Texture accounting includes retained CPU pixels plus the mip chain; equal content and sampler share one texture per prepared window, not merely equal IDs.

The compiler creates deterministic embedded PNG/GLB bytes and keeps the source/scene SHA verification authority. No new runtime decoder is introduced. One new canonical runtime module is explicitly enumerated in both distribution paths; the Worlds source archive file ceiling rises from 159 to 160 while its 20 MiB byte ceiling remains unchanged. Structural closure checks alone are not full package qualification.

## Reproduce and verify

Use the existing authoring dependencies and a Python executable with Pillow 12.3.0. From the repository root, choose a **new external output directory**:

```sh
node authoring/fpv-worlds/regions/tropical-coast/prepare-rgba-review.mjs /external/tropical-rgba-review /path/to/python-with-pillow
node authoring/fpv-worlds/regions/verify-rgba-scenery-window.mjs
node authoring/fpv-worlds/regions/verify-indexed-scenery-window.mjs
node scripts/check-optional-module-closure.mjs
```

Compare generated source/GLB hashes with `receipt.json`. The production functional check covers strict rejection, exact embedded pixels and tints, alpha material semantics, visual-only foliage versus solid structure sweeps, sharing, verified admission, cancellation and repeated disposal. The existing indexed ownership checks remain applicable and pass unchanged. Both derived GLBs validate with zero errors and warnings.

Native comparison in `native-review.json` inspected both sides of the corrected palm: its tints and cutouts now match the original appearance, with visibly reduced 128px detail. The covered jetty remained acceptable. Palm disposal returned all observed production resource and collision counters to zero. It does not imply flight completion, sustained device performance, player installation or offline readiness. Tropical world assembly, route design and immutable player delivery remain subsequent work.
