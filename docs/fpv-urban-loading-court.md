# Urban loading courts: composition preparation

This immutable `mixed-r2` preparation adds recognizable north and south approaches to the Urban loading hall. Blue containers mark the north court; amber containers mark the south court. An offset approach leads through the existing hall opening. It is a bounded **384 × 384 m authoring study**, not a default Library world or a finished art standard.

## Source and preservation

Seven adapted copies of the existing CC0 Kenney City Industrial container (`surface-71`) use the exact pinned source triangles for both rendering and collision. The copies are approximately 2.446 × 2.59 × 12 m. Their original arrangement, colour choices and new approach route are authored here. The existing license receipt, original source receipt and `License.txt` travel with the generated output.

All 95 earlier scenery surfaces remain exactly unchanged. All 18 terrain scene/collision assets remain byte-identical. The earlier immutable manifests and outputs are retained. Six new containers rest at ground height zero; one intentionally stacks on the north-left container at 2.59 m. This revision adds 2,653 triangles, for 6,998 scenery triangles total; terrain remains 18,432 triangles.

| Receipt                                    | Value                                                              |
| ------------------------------------------ | ------------------------------------------------------------------ |
| Paired revision                            | `mixed-r2`                                                         |
| Terrain manifest SHA-256                   | `7f402a29d4adbd1d684694c1d0976ae2d4159ca96e32bc32399ed2f9a6797e33` |
| Scenery manifest SHA-256                   | `694bb4e034f332b159864538f98215d4fa4e878e9b0ed50f257ade564b0f37b1` |
| Scene/collision assets                     | 36; 2,027,827 bytes                                                |
| Canonical scenes                           | 18                                                                 |
| Maximum observed committed paired geometry | 1,044,240 bytes                                                    |

Geometry bytes exclude JavaScript, GPU allocation, renderer resources and the temporary retained-old plus staged-new transition peak. Existing mixed-owner budgets still govern admission.

## Reproduce and inspect

Use the exact earlier `mixed-r1` preparation as input and a new, nonexistent output directory:

```sh
node authoring/fpv-worlds/regions/urban-bando/prepare-loading-court.mjs "$MIXED_PARENT" "$NEW_OUTPUT"
node authoring/fpv-worlds/regions/urban-bando/verify-mixed.mjs "$NEW_OUTPUT"
node authoring/fpv-worlds/regions/urban-bando/verify-loading-court.mjs "$MIXED_PARENT" "$NEW_OUTPUT"
node authoring/fpv-worlds/regions/verify-mixed-window.mjs "$NEW_OUTPUT"
```

The generator pins both parent manifests, verifies every source byte/hash, compares canonical scenes with their collision sources, and verifies the committed parent receipt. It refuses to overwrite an existing output directory. `loading-preparation.json` records the expected deterministic result.

The existing authoring scenery preview accepts the scenery manifest as `manifest` and the matching terrain manifest as optional `companion`. For example, serve the generated directory at `/study/` and open:

```text
authoring/fpv-worlds/regions/scenery-preview.html?manifest=/study/scenery/region.json&companion=/study/terrain/region.json&surface=urban&lighting=urban
```

Choose **North loading court** or **South loading approach**. The preview uses the existing verified mixed owner, so both verified layers adopt and release together. Omitting `companion` preserves the standalone scenery inspection path.

## Verification receipt — 14 October 2026

- Two independent regenerations produced 43 byte-identical files.
- All 18 canonical GLBs passed validation without warnings or errors. Scene triangles and serialized collision triangles agree; terrain seams and source identities passed.
- All 14 original opening/solid probes and 537 sphere sweeps across four 4 m corridors passed. The previous three corridors are retained; the new loading-court route is additional.
- Actual verified terrain support and exact minimum vertex heights confirm six ground containers at zero. The seventh is intentionally stacked. Seven additional side-impact queries and seven roof-support queries passed against the verified mixed owner. Expected roof support comes from triangle intersection, not a bounding box: the roof centre sits below the corner castings.
- All nine mixed-owner regression cases passed, including retained-frame failures, cancellation, budgets and the synthetic 2,145-tick/two-origin flight. Separately, all nine cells of this authored revision admitted and both original spawns completed 50 shared-flight ticks without contact. The synthetic crossing receipt is not an end-to-end flight through the new loading route.
- Native browser review showed North at 6 cells / 78 meshes / 766,608 geometry bytes and South at 9 cells / 111 meshes / 1,044,240 geometry bytes. The approach colours, clear central door line and shadow depth were visible without browser console errors.
- Native Release removed live scenery/collision; Load restored Overview at 9 cells / 111 meshes / 1,044,240 geometry bytes. Review screenshot: `urban-loading-approach.png` in the external verification output.

## Still required

The green terrain, coarse surrounding buildings and sparse district composition remain a blockout. Ground-to-court material transitions, stronger environment composition and broader art acceptance remain future work. This increment does not qualify production gameplay, public catalogue admission, package/offline delivery or device FPS. It changes no flight physics, scoring, course identity or production world contract.
