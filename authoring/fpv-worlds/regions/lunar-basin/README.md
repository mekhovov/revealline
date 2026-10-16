# Lunar Basin: original 768 m composition contract

This document preserves the original design proposal. See
[SOURCE-STATUS.md](SOURCE-STATUS.md) for the subsequent generated source,
verified changes and remaining admission gates.

**Status: design only.** No region has been generated, collision checked, flown,
visually accepted, delivered or added to the Library. This is the next source
proposal after Canal City; Canal #1437 and its review server are unchanged.

The active roadmap at `e9b17236601b911179cb20009b23a99cde628075` lists Lunar Basin
after Canal. Choose it before Castle Valley because the current work already has
several architectural regions: lunar crater/rille morphology adds a different
flight experience without another building kit intake or texture decoder. This
is an original Moon-themed training environment using the existing terrestrial
FPV physics. A rotorcraft cannot fly in the Moon's vacuum; the presentation must
never imply physically accurate lunar flight.

The first source would cover **768 × 768 m**, on the existing 6 × 6 grid of 128 m
cells with 33 samples per edge. The 8.192 km natural-region ambition remains an
unbuilt roadmap target. Broad area does not substitute for close-range detail.

## Six deliberately different districts

| District | Two landmarks | Flight experience | Nearby recovery |
| --- | --- | --- | --- |
| Mare apron | Open survey shelter; unequal landing berms | Low height figure eight and roofed return passage | Broad smooth apron, 24 m berm entry |
| Ejecta fan | Split block; broken crescent | Unequal solid-block weave and rim orbit | Wide outside line; no enclosed trap |
| Sinuous rille | Asymmetric elbow; survey crossing | Follow an open channel, then over/under a bridge | Two broad ramps, open sky above |
| Terraced crater | Broken rim; central mound | Saddle traverse and descending floor return | Wide saddle and clear floor recovery |
| Fractured highland | Tilted slab; branching fracture | Side slot followed by a choice of narrow or wide line | Both branches rejoin, escape above |
| Observatory ridge | Tilted survey dish; service gallery | Tripod approach, open bays and visible rear exit | Outside circuit remains unobstructed |

Each district has a safe-start target and two concrete route polylines in
`design.json`: four beginner, five intermediate and three advanced routes.
The twelve routes are designed intentions, **not verified traversals**. Their
declared 8–20 m clearance diameters must be measured against generated geometry;
an assertion about these numbers in this design does not establish clear space.
Seven 24 m connecting corridors keep the six districts connected without
teleports. Terrain-resolved altitude profiles remain to be authored, especially
the crater descent and crossing over/under return.

## Readability at pilot height

- Use continuous broad rims and channels at the 4 m terrain sample spacing.
  Narrow ledges, split rocks, roofs and bridge members belong in the separate
  solid scenery meshes. Do not create a heightfield cave or a shader-only hole.
- Build recognizable near silhouettes: unequal tilted slabs, a shallow dish and
  one asymmetric shelter. Avoid twelve copies of the same portal or spike.
- Sand/dust should read as regolith, with dark plains and brighter uplands;
  preserve a restrained palette rather than repeating the Canyon sediment bands
  or recolouring Desert dunes. Surface detail is opt-in and has no displacement.
- Side lighting should describe slopes and contacts while leaving usable shadow
  fill inside openings. A black background or deep shadow is not a replacement
  for material, geometry or passage verification. A sky/lighting change would
  require its own bounded presentation contract; none is assumed here.
- Six starts target meaningful features within 150 m. Every landmark must have a
  pilot-height review camera as well as a wide context view. Native comparison
  must show the actual approach, gap and escape route, not just an aerial image.

## Source and residency contract

All terrain, layout, rocks and research structures are original authored
geometry. No new downloaded asset is required. Existing licensed resources may be
introduced only with an explicit source receipt and a reviewable reason; they
must not silently change this contract. NASA/LPI references below are morphology
research only: no imagery, atlas data, logos or meshes are included.

The terrain manifest remains `FPVRegionManifest.v1`; its sparse companion is
`FPVSceneryManifest.v1`. Every terrain cell is declared, and scenery-free cells
remain explicit empty entries. Canonical scene triangles and solid collision
triangles must agree. Underpass openings may not acquire invisible box proxies.
Landmark members crossing a cell boundary require deterministic clipping and
exact edge agreement. Use the existing production preparation, ownership,
collision and flight model.

| Budget | Target / unchanged ceiling | Evidence status |
| --- | --- | --- |
| Pilot immutable delivery | target ≤12 MiB; hard ceiling 64 MiB | Not generated or measured |
| One required 3×3 window | target ≤2.5 MiB combined charged resources | Not measured |
| Old + staged window | target ≤5 MiB, hard ceiling 8 MiB | Not measured |
| Owned texture allocation | target ≤0.5 MiB; zero proposed texture images | No texture allocation yet |
| Terrain | 36 cells, 1,089 samples/cell; 4 m spacing | Design arithmetic only |

The implementation must inspect actual combined geometry, retained texture
buffers, mip allocations and source reservations. Do not count only compressed
delivery bytes. No budget increase or extra module is authorized by this design.

## Required next increments

1. After Canal's source review, generate one immutable original relief/scenery
   revision. Keep geometry deterministic; resolve each route's Y profile from
   terrain and measured openings. Verify all cell seams and generated manifests.
2. Validate twelve route centre/edge sweeps, six starts, intentional solid
   contacts, all connecting corridors and cross-cell clipped features. Command
   each route through the existing host in Self-level and Acro; verify origin
   changes, failed preparation and disposal. Tests must reject an obstructed
   route and must not infer safety from waypoints alone.
3. Review the six pilot-height districts in FPV/Chase/Overview, all three quality
   tiers and short-screen framing. Reject harsh repetitive relief, floating
   details, unreadable dark bays or large empty approaches before delivery.
4. Publish immutable source delivery separately. Add a trusted Library pin only
   after exact package and ordinary-player download/Fly/reload/revision tests.
   Preserve older regions and every saved identity. Endurance, offline coverage,
   controller/device behavior and final art remain independent acceptance work.

## Primary references

- [NASA Moon facts](https://science.nasa.gov/moon/facts/): regolith and the broad
  highland/mare distinction. The design compresses these motifs into a fictional
  course; it is not a surveyed site.
- [NASA lunar composition](https://science.nasa.gov/moon/composition/): rilles,
  highlands and maria inform distinct terrain families.
- [NASA lunar craters](https://science.nasa.gov/moon/lunar-craters/): crater
  structure motivates the broken rim and floor-return district.
- [Lunar and Planetary Institute rille atlas](https://www.lpi.usra.edu/lunar/rilles/):
  channel morphology reference; no atlas imagery/data is imported.

The fiction/physics distinction, metadata and proposed geometry are authored
locally. Research references do not confer a license on arbitrary third-party
media; none has been downloaded for inclusion.
