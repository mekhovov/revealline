# Desert Expedition surface foundation

This is an explicitly selected, original procedural material for the `natural-r1`
Desert Expedition source. It changes colour and roughness only. It does not add a
Library entry, alter delivery bytes, change geometry/collision, introduce water,
or qualify this source as finished scenery.

## What changes

- Warm sand follows the authored crescent-dune field. Close-range directional
  grain is restrained and fades with pixel footprint; it does not create false
  ridges or imply extra collision detail.
- A pale, matte salt surface follows the actual playa mask and its gently sloped
  reference level. Raised islands and headlands retain their rock/alluvial
  appearance rather than receiving a white overlay merely because they lie
  inside the basin ellipse.
- A darker alluvial strip follows the source's sinuous dry channel. There is no
  blue water or false reflective surface in a dry wash.
- The escarpment, offset mesas and rocky plain receive separate stone/pediment
  tones; slope shading remains available to read the real relief.
- Smooth transitions use global metre coordinates, including the exact
  16,384 m source bounds. Recentring and adjacent cells use the same coordinates.

The primary landscape references remain the National Park Service's
[White Sands geology](https://www.nps.gov/whsa/learn/geology-of-white-sands.htm),
[Badwater Basin](https://www.nps.gov/places/badwater-basin.htm), and
[Death Valley geologic formations](https://home.nps.gov/deva/learn/nature/geologicformations.htm).
These inform visual distinctions between sand, salt and exposed rock; no
photographs, textures, heightmaps or other source media are redistributed.
This study does not claim to reproduce those real locations.

## Bounded implementation

`createTerrainSurface({ style: 'desert', quality, originMm })` is the only new
opt-in. Plain remains the default. The authoring flight preview exposes a
**Desert sand, salt and stone** choice; it does not silently select the style for
other scenes. There is no new runtime module, network request, texture decoder,
texture allocation or GPU geometry. The current Library appearance rules remain
unchanged.

Performance keeps broad district colour and a cheap broad variation without
noise samples or fine grain. Balanced adds broad noise and filtered sand grain;
Quality adds a small filtered fine-grain contribution. All three keep the same
district masks, opacity, depth writes, terrain normals and visibility rules.
The existing live-quality hook updates the same material owner and retains its
origin uniforms without touching geometry or collision.

## Verification

From the repository root, against the preserved final source:

```sh
node authoring/fpv-worlds/regions/desert-expedition/verify-desert-surface.mjs /path/to/desert-expedition-natural-r1-final/terrain
node authoring/fpv-worlds/regions/verify-live-surface-quality.mjs
```

The first check pins the exact terrain manifest and its canonical cell hashes,
then compares all six authored-start windows in Plain and each Desert tier:
positions, shared normals, indices, support height, swept collision and resident
bytes remain identical. Each window has nine cells and 456,408 geometry bytes.
Materials are opaque, have no texture/normal/displacement maps, and dispose
exactly once. Shader-hook assembly retains the global coordinate across different
origins and does not inject displacement, discard or fragment depth overrides.

The existing shared-renderer quality check covers 20 real material transitions
across Canyon, Urban, Railway and Desert, including repeated no-op tier changes,
uniform/material ownership, invalid-tier rejection and disposal.

These are source and functional checks. Shader-hook assembly is not a GPU compile
test. Native desktop/mobile shader compilation, visual comparison of all six
districts and tiers, in-flight readability, actual package/offline delivery and
device performance remain unqualified. Browser inspection is intentionally
deferred during the separate sustained runtime qualification.
