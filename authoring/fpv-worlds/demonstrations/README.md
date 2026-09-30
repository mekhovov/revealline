# Woodland demonstration authoring

`generate-woodland.mjs` is an original offline authoring tool. It flies the actual
fixed-step v2 runtime, records the quantized commands consumed by that runtime,
and replays the result. It is not shipped with the player application and adds no
autopilot to gameplay.

From the repository root, generate all eight woodland challenges in both modes:

```sh
node authoring/fpv-worlds/demonstrations/generate-woodland.mjs \
  woodland-01,woodland-02,woodland-03,woodland-04,woodland-05,woodland-06,woodland-07,woodland-08 \
  /tmp/fpv-woodland-recordings
```

Both arguments are optional. The default set is all eight woodland courses; the
default destination is `fpv-woodland-demonstrations` in the current directory.
Each output is a JSON object containing the unchanged course and its v2 proof.
The process exits unsuccessfully if an attempt does not complete with full health
and zero contacts. Generation uses the response profile and piloting parameters
declared in the script.

The recorded pilot turns toward its next leg before accelerating. Woodland 06
returns at a 6.2 m cruise height to clear its moving hazards; Woodland 07 keeps its
lower route beneath the branch. These are piloting choices in the recording,
not course, collider, enemy or physics changes. This controller is qualified for
the current woodland hold/land/hazard tasks only. Its gate handling is
experimental, and combat objectives are deliberately unsupported.

`woodland-provenance.json` records the original source commit, generator hashes,
per-artifact and per-proof SHA-256 hashes, exact runtime/course identities,
completion evidence, and heading alignment measurements. The checked-in portable
generator reproduced all 16 artifact hashes after its imports and output paths
were normalized. No machine-specific paths are required.

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
