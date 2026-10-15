# Saved places in regional free flight

Installed regional worlds now have a Saved places group in the existing Pause menu beside authored Starting point. A paused player names and saves the current location, chooses a saved place and explicitly restores there. Restoring keeps the current flight mode and camera, levels the craft at its saved yaw, clears motion/input and requires deliberate arming. Ordinary authored starts remain available when a saved place cannot be verified.

## Exact identity and storage

Each record binds the region ID, source revision and installed descriptor SHA-256. Similarly named revisions cannot use each other's saved places. Positions retain finite millimetre precision; headings use the existing centidegree convention. Labels are bounded plain text and enter DOM text nodes, never HTML. The separate IndexedDB store permits 20 places per exact revision, 200 overall and 128 KiB of serialized records. Adds create new IDs rather than overwriting existing records. Explicit removal reviews the chosen label and uses a transaction generation guard. Concurrent stale edits fail without replacing records.

Stored data is validated again when read and restored. Corrupt records are retained; this increment does not silently repair or delete them. Saved places stay on the current device and are not exported or synchronized by this feature. Playlist bookmarks, recorded flights, scored courses and World.v1 identities are unchanged.

## Restore safety and lifecycle

The selected stored record must still exist in the reviewed storage generation and exact current installed revision. Bounds include the craft radius and ceiling clearance. The regional runtime accepts an explicit saved start and requires the restore-only solid certificate from #1330 before the first frame can be adopted. Unknown cells, intersecting surfaces, certified solid interiors and ambiguous containment cannot arm. The record remains stored and the player can choose an authored starting point.

The shared flight-support query now accepts bounded finite positions, matching existing runtime coordinate validation; its ray equations, radius/drop integer requirements and support policy are unchanged. Both self-level and Acro restoration use the same shared production flight engine. Async restore lookup and launch retain the existing navigation lease; leaving or hiding the view cannot open a stale flight. No menu action automatically arms.

## Verification

- Real source-backed session checks cover exact fractional roof positions, both modes, saved yaw and level attitude, zero input/velocity/ticks, deliberate arming, rejected closed-slab interior, revision mismatch, malformed/out-of-bounds poses, authored fallback and disposal.
- The native browser storage fixture passes five groups: real persistence/concurrent stale edits; read isolation, exact revision and validation; per-revision cap without replacement; reviewed removal/reopen; and corrupt-record preservation.
- Existing continuous-flight 10 scenarios, mixed ownership 8 scenarios and restore containment 9 scenarios pass. Scoped lint and syntax checks pass.
- Main and optional package closures explicitly include the new `regional-locations.mjs` module. The source-file envelope is 162, one above #1330's 161; the 20 MiB byte cap is unchanged. Actual package qualification remains separate from structural closure verification.

Native player-menu acceptance and exact packaged qualification are recorded separately when complete. This receipt does not claim device FPS, universal complex-mesh restore support, cloud sync or bookmarks for ordinary scored courses.
