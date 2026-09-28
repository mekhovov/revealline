# FPV body-detail candidates

This source-only `reference-v3` study refines **Scout** and the six-arm **Carrier** before expanding the roster. It does not replace a registered collection, change mission rules or award progress. The four PNGs are original 32/64-pixel drawings built from integer clusters. No photograph or generated concept pixels are copied, resized or quantized.

## Treatment

The approved [roster concept](../fpv-proportion-candidates/roster-concept-v1.png) informs the construction: slim carbon arms, a visible forward camera, a rear antenna, shaded equipment faces, small metal fasteners and restrained pack straps. The Scout uses a narrow grey battery; the Carrier uses a wider olive transport case. Both retain a dominant open rotor footprint. The 64-pixel version adds native half-grid clusters rather than simply enlarging the 32-pixel version.

Static bodies contain **no propeller blades, blur, corner reticles or central crosshair**. Every original `reference-v2` pivot, hub position, radius, blade count, phase and direction is retained. The shared renderer supplies moving blades. Nearest pixel-cell boundary checks keep the camera, antenna and equipment outside the entire blade disks; the structural arms and motor housings intentionally lie beneath their rotors. These are drawing clearances, not aircraft engineering or collision geometry.

## Produce and verify

```sh
node scripts/produce-rotor-body-details.mjs
node scripts/produce-rotor-body-details.mjs --check
node --test game/test/rotor-body-detail-candidate.test.mjs game/test/rotor-proportion-candidate.test.mjs
```

[The source module](../../../game/presentation/rotor-body-detail-art.mjs) returns a final RGBA raster and separate structure/equipment/motor layers for audits. [The manifest](manifest.json) records exact source hashes, PNG hashes, occupied bounds, unchanged geometry, prompt and candidate status. Production sprites and the existing `reference-v2` outputs remain unchanged.

The tests cover binary transparency, the shared twelve-colour palette, connected silhouettes, exact motor centres, smaller housing bounds, blade/equipment clearance, native detail, deterministic regeneration and the retained v2 aggregate. They do not establish visual acceptance or a released asset binding.

## Visual review still required

Compare v2/v3 through **both actual render paths**, at 20/24/32 CSS pixels, four headings, bright/dark artwork, board edges and overlaps. Include normal, reduced-effects and paused poses; review actual rotating frames. Keep the exterior Team number/shape identity cue separate from the body. Review the whole board before choosing a collection revision, and preserve accepted original bindings on Retry/Continue/Collection/replay. Inspect the full role roster before extending this treatment beyond the two benchmark roles.
