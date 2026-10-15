# Canal City — connected district preparation

Original bounded layout: 384 × 384 m, nine 128 m cells. This is a first composition
slice, not the final Canal City or a multi-kilometre delivery/admission claim.

The district joins a north/south canal, a cross canal and a turning basin. Distinct
routes include a real masonry arch opening, two warehouse passages, a high pedestrian
connection, lock-side passage, an accessible courtyard and basin slalom. Modelled
solid geometry must use the same triangles for rendering and collision. Water is an
explicit visual-only surface; the canal bed remains solid. There is no hydrodynamics,
buoyancy, simulated lock gate or promise of collision with the water plane.

## Design references and source rights

- [UNESCO Canal Ring listing](https://whc.unesco.org/en/list/1349) and
  [UNESCO's Amsterdam urban heritage atlas](https://whc.unesco.org/en/urban-heritage-atlas/Amsterdam/)
  inform the distinction between canal/quay routes, crossing types, courtyard blocks
  and varied rooflines. The layout and geometry here are original; no map, photograph
  or historic building model is copied.
- [Kenney Building Kit](https://kenney.nl/assets/building-kit), verified CC0 on
  2026-10-15, supplies the previously admitted wall/aperture components. Reuse the
  preserved `hillside-town/source` bytes through its strict `indexed-source.mjs`
  loader. Retain its exact archive/file hashes and original `License.txt`. Preserve
  palette colours and normals; remap only the source UV coordinates into the exact retained atlas rectangle, and do not copy the unreviewed courtyard derivative palette.

Original bridge, quay, roof and dock geometry is authored for this slice. Original
water and stone surfacing should use the existing bounded RGBA format, with no new
runtime decoder or water physics. The 512² original palette is cropped to its actually addressed 256 × 128 rectangle (x128, y384). Every retained texel is copied exactly to RGBA with alpha255; UVs retain original pixel density and a minimum16-pixel sampling halo. This is not downsampling, and no runtime cap changes. Distant mip averages can differ because unused atlas regions are removed; final native comparison remains required.

## Verification and remaining gates

Canonical/hash/determinism and seam checks; texture/geometry resident and staged
budgets; real aperture clearance; authored starts; solid structure/bed contacts;
visual-only water passage; actual commanded routes in both flight modes; native
pilot-height and overview review. No Library row or delivery is added by this source
preparation. Broader artwork and moving subjects remain separate plan items.

## Preserved rejection and draft 3 correction

The first published source, `district-r1` (native draft 2), remains preserved.
Native review found a lock deck floating above its walls and conspicuous gaps
between the masonry arch, banks and deck. Warehouse doorways, supported basin
piles, courtyard passage and disposal passed, but the composition was too sparse
and the ground too uniformly tan. That source was not accepted for delivery.

New `district-r2` (native draft 3) adds actual solid load paths: lock supports join
wall tops at 5 m to the deck underside at 8.1 m; arch banks now meet the deck at
13.2 m, and continuous spandrels connect the barrel to the deck. These are visible
matching collision triangles, not painted-over gaps. The original openings and
all six routes remain unchanged. A regression querying the old serialized draft
rejects its missing bridge mass; the same queries pass the new source.

One original 128 × 128 mortar/block texture adds restrained stone courses. It is
reused at metre-derived scale on masonry, paving and lintel surfaces; no licensed
palette texels change. Repeating UV coordinates are rebased by whole periods per
triangle, preserving texture phase across cell boundaries while staying within
the existing ±16 UV limit. Large box faces are subdivided before clipping to
keep those UV spans bounded. The existing four-texture-per-cell maximum remains;
no new decoder, shader, resource ceiling or generic PBR feature is introduced.
Coping bands, pedestrian paving, contrasting public yards and grounded corner
piers/plinths/top lintels add close-range structure outside door openings.

All 18 canonical GLBs match exact source compilation with zero glTF validator
warnings/errors; all nine terrain cells join at exact seams. The 1,239 centre/edge
sphere sweeps, twelve commanded route/mode flights, twelve disarmed starts and
six deliberate structure/bed contacts pass. Added serialized lock/spandrel contact
queries and a paved-apron support query pass. Water remains visual-only above a
solid bed. Loaded geometry plus textures peaks at 1,918,308 bytes; old plus staged
composition is 3,836,616 bytes, under the unchanged 8 MiB cap. Two independent
regenerations produced 41 byte-identical files. Payload files total 6,756,656 bytes.

Draft 3 native comparison is pending. This remains a 384 m composition study,
not a finished city or an accepted representative art standard. Immutable delivery,
Library admission and all broader player/device/offline gates remain separate.
