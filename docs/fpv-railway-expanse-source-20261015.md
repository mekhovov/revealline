# Railway Valley: original 4.096 km regional source

This increment authors a separate **4,096 × 4,096 m** terrain/scenery pair. It does
not replace the existing 384 m Railway entry, change runtime physics, install a
Library row, or qualify finished artwork. The source can be reproduced from the
committed recipe; heavy output remains external.

## What the source contains

Six distinct industrial districts connect through north/south rail approaches and
a raised valley crossing. Twelve landmarks and twelve explicit practice corridors
provide different flying tasks:

- Freight exchange: open maintenance halls and a clear outer apron.
- River viaduct: under-deck river passage and a longer above-deck portal line.
- Quarry transfer: terraced cutting, transfer tower and conveyor opening.
- Station settlement: platform canopy, side street and five buildings.
- Foundry works: tall stacks, pipe gantries and a larger open hall.
- Timber sidings: crane line, narrow side aisle, stacks and a lower canopy.

The layout has 1,021 original architecture pieces and six placements of previously
accepted Kenney Train Kit primitives. Exact pinned source hashes are checked before
reuse; triangle indices, UVs, normals and palette remain intact. The existing CC0
license and source provenance are copied into the generated source. No outside map
or proprietary assets were copied.

## Functional evidence

`authoring/fpv-worlds/regions/railway-valley/expanse-receipts-r1/` contains the raw
preparation, canonical and commanded-flight receipts.

- 256 terrain cells, 52 occupied scenery cells, 204 explicitly known-empty cells;
  complete paired manifests preserve missing/unknown semantics.
- 308 canonical GLBs recompile byte-identically and pass glTF validation with no
  errors or warnings. All 480 shared terrain edges agree.
- 330 corridor sweeps, five solid-structure probes, four non-grid terrain-support
  comparisons, all six authored starts and 130 window transitions pass.
- 24 real commanded routes across Self-level and Acro complete over 78,235 accepted
  ticks without contacts. Twelve starts remain paused at tick zero. Ten deliberate
  solid-structure contacts confirm the visible architecture stops flight.
- Largest measured current geometry/texture ownership is 3,156,260 bytes. The
  conservative two-window allowance is 6,312,520 bytes, below the existing 8 MiB
  retained-plus-candidate ceiling. Explicit disposal returns ownership to zero.
- Source manifests and payloads total 17,844,865 bytes, below the existing 64 MiB
  delivery allowance. This excludes a future delivery descriptor, which must also
  fit the unchanged limit before publication.
- A fresh reproduction matches both manifests, all 616 payload hashes and the
  preparation receipt. Scoped syntax, formatting and lint checks pass.

Review caught a route through a freight wall and an aisle clipping a crane post.
The tests rejected both. The apron now passes outside the halls, and the timber
route lies between the stack and crane. Earlier generated output is retained;
passing receipts use only the corrected recipe. A terrain placement helper now
uses the same triangle interpolation as visible/collision terrain, with actual
support-query comparisons at non-grid coordinates.

## Reproduction

Run from the repository with Node 20.19.5 and the existing authoring glTF validator
available. Use a **new** output directory; the generator refuses to overwrite one.

```sh
node authoring/fpv-worlds/regions/railway-valley/prepare-expanse.mjs /new/output
node authoring/fpv-worlds/regions/railway-valley/verify-expanse.mjs /new/output
node authoring/fpv-worlds/regions/railway-valley/verify-expanse-flight.mjs /new/output
```

## Remaining acceptance

Native viewpoints and actual player flight, representative material/landscape
polish, immutable delivery, trusted-profile/Library admission, exact package and
public deployment qualification are separate work. This source does not claim
moving trains, authored missions/rewards, an uninterrupted whole-map flight, physical
controller coverage, measured device FPS or final artwork. Eight-metre terrain
samples suit broad relief; narrower openings use explicit matched geometry.
