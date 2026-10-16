# Planted market courtyard — source review candidate

This separate `courtyard-r4` revision concentrates on the existing middle-terrace court. Three original low-poly trees in grounded planters, two low planted beds, striped market canopies, display crates, thin paving bands and closed-side facade insets add detail around the existing benches, roof silhouettes and civic marker. The 2.2 m market aisle, original front/back building doorways and all nine certified flight routes remain open.

The rounded tree crowns and produce are original opaque solid geometry, not imported vegetation or alpha foliage. Their collision agrees with the visible surfaces; trees sit outside the certified corridors. Existing licensed Kenney Building Kit models/palette remain unchanged. There are no additional texture assets, runtime modules, decoders, water/physics changes or budget increases. Window-like facade insets are opaque artwork on already closed side walls; no promised opening is blocked.

## Verification

Use a new external directory:

```sh
node authoring/fpv-worlds/regions/hillside-town/prepare.mjs /external/new-court courtyard-r4
node authoring/fpv-worlds/regions/hillside-town/verify.mjs /external/new-court courtyard-r4
node authoring/fpv-worlds/regions/hillside-town/verify-commanded-flight.mjs /external/new-court
```

The exact source totals 8,648,655 bytes. Scenery geometry is 1,043,888 bytes and the unchanged shared palette allocation is 2,446,676 bytes. Retained plus candidate source ownership is bounded at 7,893,944 bytes, below the existing 8 MiB ceiling. All 18 canonical GLBs, 10,626 production support/collision queries, 18 commanded routes (nine in both flight modes), eight disarmed starts and four roof/pad contacts passed. Explicit disposal returns owned bytes/reservations and collision worlds, colliders and bodies to zero.

The initial paving prototype was 24 mm above the accepted road and failed the existing 2 mm support-continuity requirement. That failed output is preserved externally. The final thin bands are 1 mm above the existing slab, and pass the unchanged requirement and low-height corridor checks. No acceptance tolerance was widened.

Native appearance is pending. This is an original bounded source study, not representative final town-art acceptance, a new Library entry, package/offline qualification, device FPS evidence or a larger world. The accepted town-r2 pin and courtyard-r3 source remain unchanged. Broader terraces, skyline variety and final atmosphere remain open work.
