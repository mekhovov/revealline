# Canyon sediment presentation

The Canyon surface previously used a repeating height sine wave. On the steep arrival ridges this read as regular horizontal stripes and exaggerated the coarse terrain study. The canonical regional material now uses broad, irregular sediment deposits with a restrained palette, while lighter sand still distinguishes flatter ground from exposed rock.

## Scope and resource cost

This changes only colour and roughness presentation in the shared regional material. Positions, normals, indices, visibility, collision, source manifests and licensed rock meshes are untouched. The authoring compatibility export uses the same canonical implementation as the optional player host.

There are no texture downloads, generated images, additional geometry, render passes or material instances. Performance retains its analytical, zero-noise-sample path. Balanced retains two procedural noise evaluations; Quality retains three. The broad noise sample is reused for sediment colour and breakup. This is a static shader-work comparison, not a measured GPU timing or device-FPS claim. Distant fine grain retains derivative filtering; no motion or displacement is added.

The material program cache key changes to version 2. Existing Plain and Urban styles are unchanged.

## Verification

`verify-terrain-surface.mjs` passes five cases on the exact nine-cell rounded Canyon arrival source. Plain and all three Canyon tiers have identical serialized source, vertices, normals, indices, support hits, swept collisions and resident geometry. Releasing twice disposes the material exactly once, and invalid style/quality/origin inputs reject before allocation. ESLint and formatting pass.

Native Gorge comparison passed for Balanced, Quality and Performance: periodic bands are removed and no console errors were observed. Performance Release/Load restored nine cells, 90 matching meshes/colliders and 673,464 geometry bytes. This is a surface foundation; it does not establish final scene quality or qualify public catalogue, package/offline delivery or giant-world claims. The underlying 4 m terrain remains intentionally bounded.
