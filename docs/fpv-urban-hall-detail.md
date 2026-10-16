# Urban loading hall: architectural detail study

The immutable `mixed-r3` preparation adds original rounded overhead service ducts, collars and hangers, open gable roof trusses, and entrance canopies. These details establish an industrial interior and a recognizable roof silhouette while keeping the central floor lane, upper lane and existing vertical skylight dive clear.

The region remains a bounded **384 × 384 m authoring study**. It is not a new public catalogue entry or a completed art standard.

## Source and physical geometry

The new geometry is original composition built with the existing pinned Three geometry library. No new downloaded models, texture assets or third-party license obligations are introduced. The earlier CC0 Kenney props and their exact provenance/license receipts remain in the output.

Six new surfaces add 936 triangles. The existing 102 surfaces remain exactly unchanged; all 18 terrain assets remain byte-identical. The complete scenery has 7,934 triangles, and terrain retains 18,432 triangles. Rendered and physical geometry use the same serialized triangles: pipes, canopies and roof frames are physical surfaces, not decorative meshes silently excluded from collision.

| Receipt                                    | Value                                                              |
| ------------------------------------------ | ------------------------------------------------------------------ |
| Revision                                   | `mixed-r3`                                                         |
| Terrain manifest SHA-256                   | `ce072898c33690f9bac94195cc997e620e9846885226fee5ef222f31451f97dc` |
| Scenery manifest SHA-256                   | `a257ff0391703ffc1b7108e6f5bd988cd4ff61e3e1bbccafb96e89865ea162db` |
| Scene/collision assets                     | 36; 2,168,792 bytes                                                |
| Maximum observed committed paired geometry | 1,093,680 bytes                                                    |

Geometry accounting excludes JavaScript/GPU allocations and retained-old plus staged-new transition peaks, which remain subject to the mixed owner's existing combined budgets. No existing source output is overwritten.

## Reproduce and inspect

```sh
node authoring/fpv-worlds/regions/urban-bando/prepare-hall-detail.mjs "$LOADING_MIXED_R2" "$NEW_OUTPUT"
node authoring/fpv-worlds/regions/urban-bando/verify-mixed.mjs "$NEW_OUTPUT"
node authoring/fpv-worlds/regions/urban-bando/verify-hall-detail.mjs "$LOADING_MIXED_R2" "$NEW_OUTPUT"
node authoring/fpv-worlds/regions/verify-mixed-window.mjs "$NEW_OUTPUT"
```

The generator authenticates both pinned parent manifests, every source asset and the committed parent receipt before creating a new output directory. The committed `hall-preparation.json` records the deterministic result.

Serve the generated directory as `/study/` and inspect the existing paired authoring preview:

```text
authoring/fpv-worlds/regions/scenery-preview.html?manifest=/study/scenery/region.json&companion=/study/terrain/region.json&surface=urban&lighting=urban&ground=urban
```

The new **Hall services** and **Hall roof frames** viewpoints show the interior clearances and open roof structure. Existing North/South and Overview views remain available.

## Verification — 14 October 2026

- Two independent generations produced 43 byte-identical files.
- All 18 canonical GLBs passed with zero validator errors or warnings. Serialized scene/collision equality, source identities and terrain seams passed.
- All 14 earlier opening/solid probes and 537 sphere sweeps across the four existing 4 m corridors passed with a 250 mm sphere.
- Ten additional real mixed-owner queries passed: the low and upper central routes, existing skylight dive and gaps beneath/between new services stay clear; the duct, roof chord and canopy correctly collide; canopy support is physical and the original skylight support still resolves to terrain.
- All nine mixed-owner regressions passed, including the synthetic 2,145-tick/two-origin crossing. All nine authored cells admitted, and both original authored spawns completed 50 shared-flight ticks without contact. The synthetic crossing is not a recorded flight through the new hall details.
- Disposal cleared geometry resources; source files remained unchanged throughout verification. Source formatting, ESLint and diff checks passed.
- Native review of the final pair showed Hall services and roof views at 6 cells / 84 meshes / 816,048 geometry bytes. Ducts and attached frames were clearly visible; central openings and roof gaps remained readable. Release removed all live geometry; Load restored Overview at 9 cells / 117 meshes / 1,093,680 bytes without console errors. Screenshots `urban-hall-services.png` and `urban-hall-roof.png` record the final source. An earlier draft fetch failed; that failed attempt is not treated as acceptance. The final pair subsequently passed actual HTTP loading and native review.

## Remaining

The wider district composition, coarse surrounding architecture, sustained performance, public player admission and package/offline qualification remain separate. This detail pass changes no production physics, scoring or course identities.
