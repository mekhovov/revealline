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

Automated source checks passed: all18 canonical GLBs match collision compilation and produce zero glTF validator warnings/errors; all nine terrain cells join at exact seams. There are1,239 sphere sweeps across declared route centre/edges,12 real commanded flights across both modes,12 disarmed start checks and6 actual structure/bed contacts. Visual-water crossing is clear while the bed remains solid. Peak loaded geometry plus textures is1,102,920B, bounded retained/staged composition2,205,840B. Two full regenerations produced41 byte-identical files.

The geometry is a384m first district, not a completed city. Native overview and pilot-height review are pending; no delivery, default catalogue pin, physical-device result or finished realism claim is included.
