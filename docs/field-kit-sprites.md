# Original Field Kit pixel sprites

This collection contains 30 new PNG assets drawn by the original integer-pixel recipe in `game/presentation/pixel-art.mjs`. They are **produced candidates awaiting runtime visual review**. No source image was edited, sampled, quantized, or rescaled to create these assets. The earlier AI hardware concept informed equipment ideas only; its south-facing camera was corrected to north in these independent drawings. Existing generated artwork, legacy bodies, and reference images remain intact.

Open [`review.html`](../game/assets/field-kit/sprites/review.html) through the local server. It shows enlarged clusters and exact 20, 24, and 32 CSS pixel samples on dark and light backgrounds, with each asset’s explanation, requirements, geometry, and copyable AI brief. The [PNG contact sheet](../game/assets/field-kit/sprites/contact-sheet.png) follows the same inventory order. This is a review page, not a game simulation or an approval record.

## Inventory and visual language

| Family       | Slots                                                                             | Native frame        | Distinction                                                                                          |
| ------------ | --------------------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------- |
| Player       | scout, bomber, carrier, interceptor, fiber, impact, trapper; compact and detailed | 32 × 32 and 64 × 64 | Independent equipment and frame profiles; amber player hardware, pale metal edges, cyan north camera |
| Enemy        | bouncer, border-patrol, contour-patrol, claimed-rover, eroder                     | 32 × 32             | Tracked, flying, wheeled, forked, and toothed silhouettes; coral threat hardware                     |
| Large enemy  | lane-boss, relay-sentinel                                                         | 64 × 64             | Heavy rectangular carrier versus raised radar pedestal                                               |
| Terrain      | wall, slow, lethal                                                                | 16 × 16             | Staggered slate blocks, winding olive ruts, and coral diagonal hazard grate                          |
| Small pickup | objective, supply                                                                 | 16 × 16             | Relay diamond and strapped field crate                                                               |
| Powerup      | life, speed, slow, freeze                                                         | 24 × 24             | Heart, paired chevrons, hourglass, and eight-point crystal                                           |

Player silhouettes are deliberately compact. Scout has one strapped battery; bomber carries a green pack and side pods; carrier has six motors and a longer cargo cage; interceptor uses a swept center frame; fiber exposes a cyan rear reel; impact carries pale front armor; trapper has two side equipment rails and a split battery. A small camera cluster consistently points north. Rear antennae remain separate from the front cue.

All production PNGs have binary alpha and use no more than 12 opaque colors from the shared Field Kit palette. There are no gradients, antialiased edge pixels, text, badges, collision rings, propeller blades, rotor discs, or motion blur baked into player bodies. The 64 px images are rendered directly at that pixel grid with separately authored fine hardware details; they are not enlarged copies of the 32 px frames.

At 20 CSS pixels the scout and interceptor’s thin arms are intentionally quiet. Keep the runtime contact-center and heading cues visible and verify the silhouettes against actual terrain before accepting a release. The contact sheet establishes the asset direction, not flight readability across every background.

## Exact geometry and provenance

[`sprites.json`](../game/assets/field-kit/sprites/sprites.json) records each semantic slot, native PNG path, dimensions, byte count, SHA-256, actual measured occupied bounds, exact normalized pivot and motor anchors, palette colors, opaque/transparent pixel counts, requirements, effective AI brief, creator, rights statement, and produced status. Geometry comes from the corresponding registered slot; occupied bounds are measured from the exported alpha pixels rather than copied from a generic box.

The carrier retains six anchors at `(0.3,0.2)`, `(0.7,0.2)`, `(0.2,0.5)`, `(0.8,0.5)`, `(0.3,0.8)`, `(0.7,0.8)`. Other players retain the four `(0.25/0.75,0.25/0.75)` combinations. Every hub uses the registered normalized radius `0.12` and three separately rendered blades. Continuous anchors map to their containing source pixel: the painted center differs from the exact anchor by at most half a native pixel. Runtime attachment coordinates must retain the original floating-point anchors instead of replacing them with rounded pixels.

The player raster remains inside the registered inner 75% art envelope. Its frame and center pivot are cosmetic presentation information. These files do not define collision geometry, simulation speed, movement, abilities, damage, or saved-picture identity. The manifest does not claim reviewed status, even after technical tests pass.

## Production API and regeneration

The pure module exports:

```js
pixelArtForSlot('player.scout.compact');
// { width: 32, height: 32, rgba: Uint8ClampedArray }

pixelArtForSlot('enemy.bouncer', { tokens: { hazard: '#f07879' } });
```

`FIELD_KIT_SPRITE_IDS`, `FIELD_KIT_SPRITE_SIZES`, `FIELD_KIT_PLAYER_HUBS`, `FIELD_KIT_COLORS`, and `FIELD_KIT_SPRITE_VERSION` describe the authored inventory. Each call owns its returned pixel buffer. An optional integer size from 8 through 128 draws the recipe at that inspection grid; registered production exports always use their exact slot dimensions. Known color tokens can alter the palette without accepting arbitrary CSS or changing gameplay data.

Run `node scripts/produce-field-kit-sprites.mjs` to regenerate the 30 PNGs, manifest, review HTML, and contact sheet. Run it with `--check` to verify that every generated artifact matches the source without writing files. PNGs use RGBA8, filter-zero scanlines, and deterministic DEFLATE output. The generator formats its text artifacts with the project’s pinned formatter and records the pixel recipe source hash. Regenerate after changing the recipe, its source version, or relevant slot contracts; do not hand-edit the PNGs or generated manifest.

`game/test/field-kit-pixel-art.test.mjs` verifies all 30 registry dimensions, binary alpha, approved palette limits, measured envelopes, exact motor locations and half-pixel tolerance, north cameras, clear space around static hubs, role/output independence, and native 64 px detail. It also decodes every generated PNG back to the authored pixels, checks hashes and provenance, and runs artifact reproducibility verification.

Adopt these assets through the versioned presentation framework and retain earlier source records. Runtime integration and final review are separate release work. Record concrete in-flight, terrain, reduced-effects, phone, and class-selection review evidence before marking individual assets or the collection reviewed.
