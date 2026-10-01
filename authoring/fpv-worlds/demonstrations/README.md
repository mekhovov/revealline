# World demonstration authoring

`generate-woodland.mjs`, `generate-courtyard.mjs`, `generate-warehouse.mjs` and `generate-stadium.mjs` are original offline authoring tools. They fly the actual
fixed-step v2 runtime, record the quantized commands consumed by that runtime,
and replay the result. They are not shipped with the player application and add no
autopilot to gameplay.

From the repository root, generate a world’s eight challenges in both modes:

```sh
node authoring/fpv-worlds/demonstrations/generate-woodland.mjs \
  woodland-01,woodland-02,woodland-03,woodland-04,woodland-05,woodland-06,woodland-07,woodland-08 \
  /tmp/fpv-woodland-recordings

node authoring/fpv-worlds/demonstrations/generate-courtyard.mjs \
  courtyard-01,courtyard-02,courtyard-03,courtyard-04,courtyard-05,courtyard-06,courtyard-07,courtyard-08 \
  /tmp/fpv-courtyard-recordings

node authoring/fpv-worlds/demonstrations/generate-warehouse.mjs \
  warehouse-01,warehouse-02,warehouse-03,warehouse-04,warehouse-05,warehouse-06,warehouse-07,warehouse-08 \
  /tmp/fpv-warehouse-recordings

node authoring/fpv-worlds/demonstrations/generate-stadium.mjs \
  stadium-01,stadium-02,stadium-03,stadium-04,stadium-05,stadium-06,stadium-07,stadium-08 \
  /tmp/fpv-stadium-recordings
```

Both arguments are optional. Each generator defaults to all eight courses in its
world and a destination named `fpv-<world>-demonstrations` in the current directory.
Each output is a JSON object containing the unchanged course and its v2 proof.
The process exits unsuccessfully if an attempt does not complete with full health
and zero contacts. Generation uses the response profile and piloting parameters
declared in the script.

The recorded pilot turns toward its next leg before accelerating. Woodland 06
returns at a 6.2 m cruise height to clear its moving hazards; Woodland 07 keeps its
lower route beneath the branch. These are piloting choices in the recording,
not course, collider, enemy or physics changes. The woodland and courtyard controllers are qualified for
their current world-specific hold/land/hazard tasks only. Their gate handling is
experimental, and combat objectives are deliberately unsupported.

Courtyard 06 uses two explicit piloting waypoints before its final hold zone:
`(8, 6.2, -10)` m and `(-10, 6.2, -22)` m. It crosses above the moving traffic,
descends to the original hold, then returns at 6.2 m. Its objectives and collision
geometry are unchanged. The other courtyard recordings use the authored routes
directly.

The warehouse and stadium controllers each handle their eight authored gate-racing routes.
Each stages 4 m before each directed gate and settles within 0.45 m at less than
0.8 m/s before crossing toward a point 1.8 m beyond the plane. The flight line is
0.9 m above the gate centre to separate it from the physical pace rival.
Warehouse 07 and Stadium 07 return above their moving hazard lanes at 6.2 m, then descend onto
the original pad. These are recorded control choices; gate dimensions, objectives,
actors, collisions and physics remain unchanged. Combat is unsupported.

`woodland-provenance.json`, `courtyard-provenance.json`, `warehouse-provenance.json` and `stadium-provenance.json` record the original source commit, generator hashes,
per-artifact and per-proof SHA-256 hashes, exact runtime/course identities,
completion evidence, and heading alignment measurements. The checked-in portable
generators reproduce the artifact hashes after their imports and output paths
were normalized. No machine-specific paths are required. Module hashes describe
the snapshot prepared for each batch; later batches append recordings to the
combined runtime module. Per-proof hashes continue to identify each recording
independently of those additions.

To prepare runtime data, read each generated JSON, normalize its course with
`validateWorldCourse`, calculate `dataIdentity(normalizedCourse)`, and pair that
`sourceIdentity` with `proof`. The runtime module exports these data objects as
`WORLD_DEMONSTRATIONS`. Preserve the raw compact JSON command values: do not
resample, smooth or retime them. Update provenance hashes after preparing the
module, replay every proof against the current source course, then inspect the
actual FPV/chase playback before publishing it.

Runtime availability checks the normalized source fingerprint, model/backend
pins and response identity. Starting playback performs full v2 replay validation,
including rules, conditions and final-state identity. A changed course revision
does not silently reuse a stale recording.
