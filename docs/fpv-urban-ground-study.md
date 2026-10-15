# Urban ground appearance study

An optional `urban` terrain appearance replaces the uniform olive plane with concrete courts, gravel shoulders, asphalt service lanes and muted verges. The court footprints follow the authored mill, loading hall, container yard, parking decks and tower court. Restrained amber apron lines frame the two actual 12 m loading-hall openings without painting across their centre.

This is presentation for the bounded Urban authoring study. It does not change source manifests, height samples, collision triangles, physics, route clearance or public readiness. The default `plain` profile and existing Canyon appearance are preserved.

## Presentation and budget

- Global metre coordinates keep surfaces stationary when the local render origin changes. Four-metre slab joints and fine grain fade with pixel footprint to reduce distance shimmer.
- Concrete fades into gravel shoulders over a few metres. Raised earthworks retain verge colour rather than looking like displaced concrete courts.
- Performance uses district colours, shoulders, slab joints and apron lines. Balanced adds two noise scales; Quality adds one extra fine gravel scale. All three use one shared material per prepared terrain window.
- No image assets, texture allocations, extra meshes, displacement, per-frame callbacks or new render passes are introduced. Existing lighting/shadow settings remain separate. Quality tiers are shader-cost choices, not a measured device-FPS claim.
- These masks are deliberately authored to this Urban layout; they are an explicit inspection option, not a universal automatic surface classifier for imported worlds.

## Inspect

In the paired scenery preview, retain `surface=urban&lighting=urban` and add `ground=urban`. The optional `quality` parameter accepts `performance`, `balanced` or `quality`, with Balanced as default. Without `ground`, terrain remains plain.

```text
authoring/fpv-worlds/regions/scenery-preview.html?manifest=/study/scenery/region.json&companion=/study/terrain/region.json&surface=urban&lighting=urban&ground=urban&quality=balanced
```

Use North loading court, South loading approach and Overview to compare readable openings and district transitions. The existing owner still prepares and releases the exact verified terrain and scenery together.

## Verification

```sh
node authoring/fpv-worlds/regions/verify-urban-ground.mjs "$URBAN_LOADING_OUTPUT/terrain"
node authoring/fpv-worlds/regions/verify-terrain-surface.mjs "$CANYON_OUTPUT"
```

On 14 October 2026, eight Urban combinations (plain plus all three appearance qualities, at two origins) preserved identical source, vertices, normals, indices, mesh transforms and all 26 support/sweep results per combination. All nine cells remained at 456,408 terrain geometry bytes. Each owner had one shared material, zero textures, and disposed that material exactly once. All five existing Canyon surface cases passed too.

Native browser review of Balanced compiled without console errors. North remained 6 cells / 78 meshes / 766,608 combined geometry bytes; South remained 9 cells / 111 meshes / 1,044,240 bytes. Concrete joints and restrained apron lines made the north approach clearer; gravel/asphalt distinguished the south approach from the verge. The screenshot `urban-ground-south.png` records the reviewed appearance. The visible loaded-ground edge is an authoring-window boundary, not a qualified playable-world boundary. No device FPS measurement was made.

Native Release reported no live scenery or collision; Load restored Overview at 9 cells / 111 meshes / 1,044,240 geometry bytes. The source parity suite passed again after rebasing onto main `e4a90960f7`.

## Remaining

This improves surface readability; it does not complete environment art. Sparse district composition, architectural detail and the wider regional-player admission/package/performance work remain separate. No source world or course is silently upgraded to a playable catalogue entry by selecting this appearance.
