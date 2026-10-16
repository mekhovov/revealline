# Regional world authoring foundation

## Delivery boundary

This increment supplies authoring-only metadata validation, deterministic region-window
planning and byte-integrity inspection. It does **not** add a playable regional map,
stream terrain or collision into the SIM, alter flight physics, or change `World.v1`,
recordings, scored proofs, the player package graph or production import budgets.

The existing fixed-world runtime accepts positions within ±100 m. Increasing that
validator alone would not provide large-world collision, precision or bounded resource
use. Regional content instead starts with an independent `FPVRegionManifest.v1`
contract in `authoring/fpv-worlds/regions/region-manifest.mjs`.

## Data and tools

A manifest contains exact format/id/revision, EN/UK title, a rectangular X/Z grid,
assets, chunks and safe-spawn **candidates**. Coordinates use integer millimetres.
Each chunk declares an id, grid X/Z cell and asset references. A complete grid prevents
accidental missing sections being interpreted as open sky. Each cell requires explicit
scene and collision declarations. Geometry and collision semantics still need a later
admission stage; a valid manifest alone never certifies a safe spawn or traversable map.

Assets declare unique local paths, size, SHA-256 and kind (`scene`, `collision`,
`texture`). Scenes use GLB; collision declarations use JSON; textures use PNG/JPEG.
No URL, executable file, traversal path, case-insensitive duplicate path or unresolved
asset reference is allowed. Terrain-only collision payloads now have an authoring schema and isolated query
admission stage; see [terrain preparation](fpv-regional-terrain.md). Other scenery
collision payloads remain future work. Existing provenance receipts remain
mandatory in the content-production pipeline; this contract does not replace licenses.

Authoring limits are explicit: 128 m cells; at most 128×128 cells; 4,096 assets;
16 assets per cell; 64 MiB per source asset; 8 MiB metadata; 64 spawn candidates.
Vertical bounds are explicit and shared across the region; this version partitions
terrain horizontally, not into vertical tiles. The maximum grid describes metadata
capacity (16.384 km per axis), **not qualified playable scale**.

```sh
node authoring/fpv-worlds/regions/inspect-region.mjs region.json
node authoring/fpv-worlds/regions/inspect-region.mjs region.json --assets ./content
node authoring/fpv-worlds/regions/verify.mjs
```

Inspection can verify each declared file's exact bytes and SHA-256 against a supplied
content directory. Symlinks escaping that directory are rejected. The report always
states `playerAdmitted: false`; integrity does not validate a GLB, collision JSON,
license, optimization, scene appearance or physics compatibility.

## Region-window planning contract

`validateRegionManifest(input)` accepts JSON text or authoring data and returns a
fresh frozen value. `createRegionPlanner(manifest)` builds bounded cell/asset lookups
once and returns a function of global position and the caller's resident chunk ids.

The plan requires the current cell and its immediate neighbours (at most 3×3), then
prefetches within 5×5, sorted by ring, squared distance and stable chunk id. Outer grid
edges are clipped; an exact maximum boundary belongs to the last cell. Positions
outside the region are rejected, not silently moved back into bounds. Negative
coordinates use floor division consistently.

A plan contains required and target chunk ids, source-byte count, asset/chunk acquisition
and release lists and a suggested local origin at the current cell centre. Shared
assets are counted once by asset id and remain resident while any selected cell uses
them. Source-byte allowance defaults to 256 MiB and can be reduced. If the required
neighbourhood exceeds the allowance, planning reports `required-source-budget` and
provides no acquisition/release instructions. Otherwise optional prefetch cells are
omitted as needed; mandatory neighbours are never silently dropped.

The caller must apply **release before acquisition** to avoid transiently exceeding
25 chunk instances. This is a residency plan, not a memory allocator: the source-byte
ceiling does not measure decoded geometry, textures, GPU resources or browser memory.
The caller must track successful asset and collision construction independently; a
chunk appearing in `resident` does not prove collision readiness. If required collision
is missing, the eventual player must remain paused rather than treating it as clear.

`regionToLocal` and `regionToGlobal` perform exact integer translation only. They do
not mutate physics, camera, actor, particle or replay state. The future streaming host
must relocate all dependent systems together before accepting a new origin.

## Verification and next increments

Run the manual authoring verification command above. It covers complete/duplicate/missing
grid cells; formats and unresolved resources; source budgets and prefetch eviction;
negative and outer-edge coordinates; immutable validation; shared resources; deterministic
reordered metadata; 7,200 successive position samples; SHA corruption and local-path
escape. Its synthetic scene bytes are deliberately **not a playable GLB**. These samples
are neither two-hour simulation evidence nor measured FPS. Additional unit-suite
coverage remains in D6.

Still required before any regional world can be advertised playable:

1. Extend the implemented terrain-only collision compiler and isolated seam/query
   checks to scenery/overhangs; add concrete assets, provenance, optimization, authored
   landmarks and safe-spawn checks.
2. Cancellable bounded asset loading, decoded/GPU memory accounting, atomic origin
   relocation, collision installation/removal and safe missing-section recovery.
3. An unscored regional free-flight host and versioned bookmark adapter; existing
   scored courses and proofs stay on their current runtime.
4. Catalogue/player capability admission, offline region storage and exact-revision
   recovery. A metadata-valid region must never be shown as an ordinary playable pack.
5. Actual continuous flight, high-speed boundary, context-loss/offline, input-device,
   package and named-device performance qualification.
