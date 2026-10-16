# Verified indexed scenery ownership

The indexed-palette contract is now admitted through the same exact-source regional window as colour-only scenery. The loader verifies declared hashes, recompiles the canonical scene, and compares its bytes before allocating a texture. It fetches no extra image URLs. Existing colour-only cell identities, canonical GLB bytes, render meshes and physics queries remain unchanged.

Each private window shares equal texture content and sampler settings across its cells. Authored normals and UVs are used directly; render and collider positions/triangles still come from the same canonical cell. Indexed pixels are expanded to opaque RGBA8, tagged sRGB, kept unflipped, and sampled using the source glTF filter/wrap settings.

## Memory and lifecycle

No byte ceiling increases. The existing 8 MiB scenery and 10 MiB mixed render-resource ceilings include all retained and candidate geometry and textures before allocation. Geometry and texture costs are reported separately, with `resourceBytes` as their total. Existing `reservedGeometryBytes` now reserves this full render-resource charge for compatibility with the shared transaction budget.

For one unique 512² palette, texture ownership charges 1,048,576 B for retained CPU RGBA pixels plus 1,398,100 B for the full GPU mip chain: **2,446,676B total**. This remains an allocation estimate, not a claim to measure driver or engine internals. Material/texture work is prepared detached and uses the existing prewarm callback. Cancellation, prewarm failure, failed adoption, eviction and shutdown dispose private resources exactly once. Retained frames survive a failed successor.

## Verification

`node authoring/fpv-worlds/regions/verify-indexed-scenery-window.mjs <external-output-directory>` covers exact pixels/attributes, shared texture identity, actual Rapier support/sweep parity against colour-only geometry, unchanged resource ceilings including retained frames, prewarm cancellation/failure, commit rollback, corrupt-source rejection and mixed terrain/scenery accounting.

The existing exact-source scenery and mixed-window suites remain applicable. Standalone source verification continues to reject the three unconditioned source models; runtime support does not waive geometry admission rules.

The six new integration scenarios pass, along with all eleven existing exact-source scenery checks and eight mixed-window checks (including the existing 2,145 shared-flight ticks across two origins). Source compiler regeneration still produces identical three GLB hashes with zero Khronos errors/warnings. Format and lint checks pass for the changed JavaScript.

Native browser review compares the original tank with the actual hash-verified regional owner: palette and smooth shading remain visible, with **77,496 geometry bytes and 2,446,676 texture bytes**. Release removes regional resources; Load restores the same counts, with no console errors. The review uses the actual detached preparation/prewarm path and collision owner, not a new flight model. Screenshot: external verification `fpv-temp/railway-runtime-texture-reload.png`. No device FPS claim is made.

The optional Worlds dependency closure gains exactly one canonical module; the existing authoring path becomes a compatibility export. The package byte ceiling stays 20 MiB. Exact combined package verification must include concurrent Library work before release; this local receipt does not claim package/offline acceptance.

## Remaining

No Railway world or default catalogue item is added. Source conditioning and authored route composition remain; representative quality, integrated gameplay, package/offline and device qualification stay separate. The change supports only the explicit opaque indexed-palette profile, not arbitrary PBR/image import.
