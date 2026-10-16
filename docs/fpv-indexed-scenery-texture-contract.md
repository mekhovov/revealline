# Indexed scenery texture preparation

This is an authoring contract prerequisite for the Railway study, not a player admission or new playable world. The existing regional runtime still accepts only its colour-only scenery profile. No package closure, source allowance, physics, collision solver or installed-world identity changes in this increment.

## Why this is needed

The pinned Kenney Train Kit source uses a 512 × 512 indexed palette with gradients. Native comparison of the original tank wagon against a per-triangle colour approximation showed visible flattening/faceting. That approximation is preserved on the recovery branch `codex/recovery-railway-palette-experiment-20261015`, but is not promoted into the game.

The new `FPVRegionIndexedScenery.v1` authoring envelope embeds one opaque RGB palette and its exact pixel indices, binds the original UVs and transformed authored normals, and wraps the existing millimetre-quantized scenery cell. It permits no image URI, external fetch, animation, alpha, normal map, metallic texture or general PBR graph. The compiler emits a canonical GLB containing its deterministic PNG. The source PNG remains unchanged in the licensed intake.

Texture RGB retains sRGB encoding and the original glTF sampler. This follows the [Khronos glTF material/texture contract](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html); normal values and UVs are written as float32 attributes. The existing canonical cell supplies exactly the same visible/collision positions and indices. Original input positions are still subject to the regional millimetre quantization; this is not a claim of byte-identical source GLB geometry.

## Bounded resources

- One indexed texture per cell, up to 512 × 512 pixels and 256 opaque RGB palette entries; dimensions are powers of two.
- Existing 1 MiB JSON and 512 KiB scene-file limits remain intact, as do the underlying surface/vertex/index limits.
- A 512² RGBA8 texture costs **1,398,100 bytes including all mip levels**. This is an explicit future allocation charge, not a claim that runtime allocation is implemented here.
- UV/normal attribute bytes are reported separately. Sampler values are restricted to glTF wrap/filter enums; UVs are finite and bounded, normals must be unit length, palette indices and bindings must resolve.
- Canonical indexed PNG output uses bounded uncompressed deflate blocks. It trades a larger prepared image for deterministic output and a narrow decoder path; the three prepared GLBs remain below 512 KiB.

## Verification receipt

Run `node authoring/fpv-worlds/regions/railway-valley/verify-indexed-source.mjs <external-output-directory>`.

| Model | Triangles | GLB bytes | JSON bytes | UV/normal bytes |
|---|---:|---:|---:|---:|
| Straight rail | 376 | 289,876 | 396,876 | 12,800 |
| Tank wagon | 1,146 | 344,212 | 507,564 | 39,840 |
| Timber flatbed | 1,094 | 341,260 | 502,581 | 38,400 |

All three GLBs pass the independent Khronos validator with zero warnings/errors. Reading the resulting GLBs back verifies positions, indices, original UVs, transformed normals and sampler settings. Decoding the embedded PNG verifies every one of the 262,144 original palette indices and all 256 RGB entries. Two separate output runs produce the same GLB SHA-256 values. Eleven malformed profiles are rejected, including URLs, unexpected alpha, invalid dimensions, UVs, normals, bindings and samplers.

Native browser comparison of tank, straight rail and flatbed confirms the smooth source shading and palette remain visible, with no console errors. The tank visibly improves on the rejected flattened derivative. Receipt image: `fpv-temp/railway-texture-preserved.png` on the external verification volume. This is a standalone GLB appearance comparison, not integrated regional runtime acceptance.

The curved rail, diesel locomotive and coal wagon are **not prepared**: millimetre quantization at the study's 2.5× scale collapses small source triangles, and the existing geometry validator rejects them. The originals are preserved; no triangles are silently dropped. These require explicit source conditioning and collision requalification before scene composition.

## Remaining gates

1. Integrate this explicit profile into verified source preparation without relaxing the existing colour-only contract.
2. Reserve unique decoded texture/mipmap bytes across both retained and staged windows before allocation; share identical textures within a window, preserve candidate cancellation and GPU prewarm, and dispose texture resources exactly once on failure, eviction and shutdown.
3. Verify runtime texture colour-space/orientation/sampler parity in the browser, actual collision queries and retained-frame cancellation. No side-loaded URLs may bypass source hashes.
4. Condition the three rejected models, then compose a bounded Railway region with meaningful routes and measured clearances.
5. Complete representative art, gameplay, package/offline and device checks before default catalogue admission. Source preparation does not close those gates.
