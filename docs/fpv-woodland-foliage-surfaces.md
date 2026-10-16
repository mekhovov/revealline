# Woodland foliage surfaces — D1

Replace untextured authored Woodland background-tree surfaces with original,
local PBR leaf-cluster and bark maps. The three canopy colors share one map set;
all crowns share stable underside vertex shading. Existing texture quality tiers
prepare 128/256/512-pixel maps. Surfaces stay opaque and mipmapped. No decoder,
asset download, additional draw call, geometry change or collision change.

Pixel styling and shared appearance collections keep their established surfaces.
The main game's theme ownership remains authoritative. This is a surface pass;
organic branching and canopy composition remain the next D1 increment.

## Verification

Baseline: main `a8c808a26447dcea17c82852cb07b24d3059d2cb`, including merged
Container/quad #987 and canopy batching #990. Run
`node scripts/prepare-fpv-woodland-foliage-verification.mjs`, serve the checkout,
and open `docs/evidence/fpv-woodland-foliage-harness.html`. The baseline copies
only the changed visual module; unchanged dependencies come from this checkout.

- Actual browser: 15 cases, 90 rendered comparisons across both Woodland arena
  sizes, all three presets, shadows, Pixel, Industrial Workshop and Meadow.
- Transformed vertices match exactly; draw calls and triangle counts match.
  Pixel, Industrial Workshop and Meadow comparisons are pixel-identical.
- Natural canopies share one albedo set, stay opaque and use the requested
  128/256/512 texture tier. Fifteen unload cycles return to zero GPU geometry and
  a stable one-texture renderer residual; no claim of zero residual textures.
- 21 existing texture/workshop checks pass; no additional unit coverage added.
- World Studio package preparation: 94 files / 14,410,935 bytes, within unchanged
  limits. Changed JavaScript passes ESLint and formatting/whitespace checks.

Evidence: `docs/evidence/fpv-woodland-foliage-browser.json` and
`docs/evidence/fpv-woodland-foliage-comparison.png`. Browser reports Chrome154 on
macOS. This is not sustained hardware FPS, mobile thermal or novice acceptance.
Release checks and actual public deployment verification remain separate.
