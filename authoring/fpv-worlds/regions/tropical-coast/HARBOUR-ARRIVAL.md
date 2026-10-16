# Connected harbour arrival source study

This authoring-only revision joins the existing covered piers with a solid wooden deck and a connected shore approach. Low support piles sit beside the open flight line. It reuses the covered pier wood image, with bounded deck segments so a single image is not stretched over the entire 71 m connection. The existing village, palms, terrain, licensed models and accepted Library pins are unchanged.

## Exact scope and budgets

The new `harbour-r3` composition extends `districts-r2` through a separate generator variant. Its geometry grows by **48,336 bytes**, below the requested 60 KiB limit. Texture count remains 18 and texture ownership remains 2,599,580 bytes. The conservative full retained-plus-candidate total is **8,147,128 / 8,388,608 bytes**. No budget, physics, shipped runtime or Library entry changes.

All 18 terrain assets and 16 non-harbour scenery assets remain byte-identical. Within the harbour cell, every previous surface, binding and texture remains identical. Only the solid arrival structure is added. Sea and foliage stay visual-only; original trunks and structures stay solid.

## Functional verification

- All 18 canonical GLBs pass glTF validation without warnings or errors.
- Real collider probes at all three quality tiers verify the deck and piles are solid, while the above-deck route, existing pier bay and under-pier openings remain clear.
- All six authored starts plus 13 actual commanded routes pass in Self-level and Acro, including the connected shore-to-harbour turn. There is no body teleport after scenario initialization. Existing contact probes and an added falling-deck probe pass.
- Shared resource budgets and owner disposal pass; no real player store is involved.
- Exact preservation check confirms the licensed input hashes, village placements, pre-existing route definitions, textures and all unaffected cell bytes remain unchanged.

Reproduce from the preserved derived RGBA asset set (the same eight models used by districts-r2):

```sh
node authoring/fpv-worlds/regions/tropical-coast/prepare-coastal.mjs ASSET_DIRECTORY NEW_OUTPUT_DIRECTORY harbour
node authoring/fpv-worlds/regions/tropical-coast/verify-harbour-preservation.mjs PRIOR_DISTRICTS_R2_DIRECTORY NEW_OUTPUT_DIRECTORY
node authoring/fpv-worlds/regions/tropical-coast/verify-coastal.mjs NEW_OUTPUT_DIRECTORY NEW_OUTPUT_DIRECTORY/preparation.json
node authoring/fpv-worlds/regions/tropical-coast/verify-commanded-flight.mjs NEW_OUTPUT_DIRECTORY NEW_OUTPUT_DIRECTORY/preparation.json
```

Receipts in `harbour-receipts-r3` bind the exact manifests and command streams. This is a bounded source/collision/route improvement. Native pilot-height appearance, material review and any subsequent immutable delivery/player admission remain pending. It does not finish the representative coastal art standard or the large archipelago goal.
