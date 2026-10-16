# Coaster Gardens: original 2.048 km regional composition

Source-only study, 15 October 2026. This builds a connected park from the eight accepted CC0 Coaster inputs in #1375 plus original terrain and architecture. The existing 160 m Coaster pack remains unchanged. No default Library entry, immutable delivery, native visual acceptance or public player admission is claimed.

## Playable space and composition

The first source is **2.048 × 2.048 km**, with six authored starting points and 22 connected routes. The larger 4 km target is deliberately deferred until additional meaningful content supports it; the imported models are roughly 5–24 m across at the preserved six-times intake scale.

| District | Composition and flight opportunities |
| --- | --- |
| Arrival gardens | Entrance, station and stalls, three arcade frames, open cross-plaza approaches |
| Loop meadow | Licensed looping landmark, parallel elevated gantries and broad practice paths |
| Ridge station | Station terrace, stepped viewing stands, canopy approaches and outer track landmark |
| Service courts | Two open-ended halls, long side walls, roofs and separate court axes |
| Woodland promenade | Original tree clusters, low benches, boardwalk margins and a broad garden crossing |
| River gardens | Bridge deck with clear underpass, boardwalk margins, entrance and garden turns |

Eight separated four-tree groves offer additional detours. There are 98 licensed model placements and 99 original architecture pieces. Original ground smoothly connects flat authored corridors and foundations with gentle surrounding hills. Main routes have explicitly checked 6 m or 10 m clear widths; narrower optional openings have not been individually qualified. The source is a static park composition, not a mechanically continuous operating rollercoaster. It has no moving rides, combat, scores or new proof format.

## Source and resource boundaries

- 64 terrain cells at 256 m, with 8 m height samples and 112 exact seams.
- 26 populated scenery cells and 38 hash-bound explicit-empty cells. Missing payloads do not become empty space.
- Exact pinned source UVs, normals, palette and baked double-sided faces retained. Original architecture and its collision use the same canonical triangles.
- `coaster-wood-straight-hill-complete.glb` and `coaster-hanging-corner-large.glb` remain preserved but rejected; neither is placed or silently repaired.
- Terrain/scenery payloads including manifests: **33,878,943 bytes**, below the existing 64 MiB delivery envelope before a later descriptor is constructed.
- Worst nine-cell resources: **3,815,084 bytes**; conservative retained plus candidate bound: **7,630,168 bytes**, below the existing 8 MiB combined limit. The identical palette is deduplicated within each prepared window; retained and candidate windows are still counted separately.
- No runtime/schema/physics/policy changes, new texture profile or increased budgets.

Final terrain manifest SHA-256: `e8b0d7ebd1d3e0501d07eea8c4f7f61700da28667afee6e7d95f84ee101e6f36`.

Final scenery manifest SHA-256: `be355ce2f5233691763b9afc9b474c9a9fa1bbae756363327ef4b3c678644cc7`.

## Verification

The committed `expanse-receipts-r1` receipts contain the final source identities and observations:

- 90 canonical GLBs reproduce exactly with zero glTF errors or warnings; all asset lengths/hashes and 112 terrain seams match.
- 936 clearance sweeps across all 22 authored corridors pass; six solid-wall probes hit their actual scenery. Four non-grid ground support samples agree with canonical triangle interpolation within 2 mm. Grid corners, all starts and source-window disposal pass.
- All six authored starts prepare disarmed in both modes. Forty-four actual commanded route flights pass through the production shared regional session: **217,657 accepted ticks** in total, with zero route contacts. Twelve separate commanded wall-impact cases prove collision remains active. These are accelerated functional fixtures, not elapsed endurance or player performance evidence.
- Independent regeneration produced 185 byte-identical files totaling 33,891,444 bytes, including provenance, licence and preparation receipt.
- Syntax, formatting, scoped lint and Git whitespace checks pass.

Generate into a fresh directory, then run the actual source and flight checks:

```sh
node authoring/fpv-worlds/regions/coaster-park/prepare-expanse.mjs /absolute/new/output
node authoring/fpv-worlds/regions/coaster-park/verify-expanse.mjs /absolute/new/output
node authoring/fpv-worlds/regions/coaster-park/verify-expanse-flight.mjs /absolute/new/output
```

Generation uses the same pinned glTF-transform dependencies as the accepted intake; validation also needs `gltf-validator`. The generator refuses to overwrite output. Final external output is preserved at `/Volumes/alex/CodexMigrationStaging/fpv-large-worlds-20261015/coaster-gardens-r3`, with independent repeat `coaster-gardens-r4`. Earlier exploratory outputs remain separate and are not relabelled as this revision.

Remaining: native scene/shader and art review, refinement of density and route variety from that review, a complete pinned immutable delivery, a separate normal Library row, exact combined package installation/offline checks and physical device/controller acceptance. No browser tab was changed during the concurrent endurance run.
