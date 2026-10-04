# Prepare the current paused frame before Ready

The Worlds host now submits one current-state frame after scene compilation and ghost loading,
before enabling Arm. Quality changes use the same path. The draw uses the existing camera, FOV
and tilt, and retains the existing token, generation, error and context-loss ownership checks.
It does not advance physics, recording, input or animation time. The normal RAF remains gated
on scene readiness. Academy and editor readiness flows are unchanged.

This moves initialization into preparation; it does not establish lower total work, faster
overall loading, GPU elapsed time, sustained FPS or a device-performance improvement.

## Evidence and scope

- Native program classification: 228 checks, 12 loads. All 66 programs first linked by the
  visible draw were `MeshDepthMaterial` shadow programs. Registered actors/materials already
  existed; the evidence rejects lazy actor creation as the cause. Shader observations make no
  extra GL queries. Their timing includes observer work, and machine-wide quiet was not established.
- Matched baseline/candidate: **348/348 each**, four fresh hosts, 12 loads and 36 observed
  submissions each. The 66 exact shadow-program signatures moved before Ready. Each first
  post-Ready draw added zero geometries, textures or programs. Paired state, camera, actors,
  registered resources, canvas and final renderer counts match exactly. This is bounded to
  Yard Check-in and Extraction at the recorded size/settings; later resize/quality/scene changes
  may require further initialization.
- Source lifecycle r5: **253/253**, genuine initial and quality-time native context loss/restoration,
  public course/quality/camera controls, latest preparation ownership, genuine 60-tick practice
  recording, 14-sample ghost, native IndexedDB recovery at tick 15, and disposal to zero resources.
  Full snapshots before/after all 12 warm frames match. FPV correctly culls the overlapping ghost;
  the public Chase camera shows its exact retained pose. The existing hidden ghost handler is
  explicitly used only to qualify renderer ownership; public ghost-toggle access is separate work.
- Rapid course selection and replacement disposal recorded no pending load/prepare in this run.
  They establish those actual sequences, not cancellation of a compiler observed in flight.
- The exact combined candidate `8df41944e5014725046b04621b3a82d3284a157e` passes full
  `npm run validate`, scoped ESLint/Prettier, 16 existing Worlds appearance/imported-texture checks,
  and all three optional packages with two identical builds, committed-input and ZIP-member checks.
  Worlds contains 102 members, 95 original inputs and **16,777,043 original bytes**, leaving
  **173 bytes** under the unchanged 16 MiB source limit. Runtime growth is 379 bytes.
- Exact admitted lifecycle: **253/253**, with zero runtime overlays. All check names and ten
  complete native state snapshots match the source qualification. Its 12 warm frames preserve
  physics/input exactly; all 36 native transactions complete and all eight connections close
  through ordinary disposal. Root visually inspected the restored Yard before continuing.
  The publication branch starts from main `8e5ad71e9b791b7c16bae1cb308026ed3e18d5c2` and its
  95 runtime inputs exactly match the qualified combined candidate; the bridge is retained.

Raw receipts are losslessly gzip-compressed under `evidence/`; each group retains original and
stored byte counts/hashes. Historical manifest wording describes its capture checkpoint, not the
final aggregate acceptance. The exact admitted lifecycle fixture is under
`evidence/admission/lifecycle-fixture.json.gz`; its 102 members have **zero runtime overlays**.
The harness's inherited conservative source-only limitation is superseded only for provenance
by that admitted manifest, not for offline/performance acceptance.

## Preserved failures

- r1's complete export was truncated by tool transport and is explicitly incomplete. Its recovered
  fields identify an assertion that counted an obsolete prepare against the current successful
  owner. The corrected observer checks preparation ID, course generation, result and ordering.
- r2 was never run: a preparation syntax error was caught locally and its immutable directory retained.
- r3 incorrectly required an overlapping ghost to be visible in FPV. The subsequent fixture checks
  FPV culling and Chase visibility separately; production ghost culling was unchanged.
- r4 stopped during native pack installation because `IDBDatabase.transaction` reported that its
  connection was closing, before final disposal. Its full failed receipt is retained. r5 observed
  8 native opens, 36 completed transactions and 8 explicit disposal closes, with no forced close,
  versionchange or transaction failure. **The earlier close's cause remains unresolved; no storage
  repair is claimed.** The observer preserves native requests, connections, errors and transactions.
- The initially expanded existing test command also ran the Academy UI fixture. Its 30 mount
  failures occur in unchanged `app.mjs` before the warm path: the test HTML copier does not assign
  `className`, while its fake DOM class selector reads `classList`, so Settings receives missing
  controls. The involved Academy source, test and fake DOM are byte-identical to the admission
  baseline. No assertion was weakened. One additional missing sparse test asset was materialized
  from its exact Git blob; the focused Worlds/texture rerun then passed 16/16. The original TAP
  failure and materialization receipt are retained. The full suite is not claimed passing.

## Reproduce the bounded checks

These are manual browser qualification tools, not new unit coverage. Use Node 22 and an immutable
player staged with `scripts/stage-fpv-shell-admitted-player.mjs`; do not share mutable source inodes.
`ABS_SOURCE`, `ABS_PLAYER`, `ABS_INVENTORY`, `EXACT_COMMIT` and `ABS_NEW_OUTPUT` below are arguments,
not hard-coded local dependencies.

```sh
node authoring/fpv-worlds/pre-ready-frame/matched/prepare.mjs ABS_SOURCE ABS_PLAYER ABS_INVENTORY EXACT_COMMIT ABS_NEW_OUTPUT baseline
node authoring/fpv-worlds/pre-ready-frame/matched/prepare.mjs ABS_SOURCE ABS_PLAYER ABS_INVENTORY EXACT_COMMIT ABS_NEW_OUTPUT prepared
node authoring/fpv-worlds/pre-ready-frame/lifecycle/prepare.mjs ABS_SOURCE ABS_PLAYER ABS_INVENTORY EXACT_COMMIT ABS_NEW_OUTPUT admitted
```

Serve each fresh fixture on its own local origin, with one visible player and no other owned GPU
jobs. The lifecycle button is **Run native lifecycle checks**; inspect the restored Yard at the
checkpoint, then **Continue lifecycle checks**. It uses the child realm's native IndexedDB.
The visible compact summary and complete receipt textareas retain stopped runs. Export the full
receipt in chunks of at most 40,000 characters and parse/hash the assembled bytes before claiming
completion. Close the player after exporting.

`lifecycle/diagnostic.project.json` is a fixture-only ground hold/land route in both modes. Running
`node authoring/fpv-worlds/pre-ready-frame/lifecycle/make-pack.mjs ABS_NEW_PACK` reproduces the exact
2,803-byte pack (SHA-256 `f50172e5d8e9e0666f6a07f91e5f3ede3c37490c570adbb845f265a21f963388`).
It supplies no proof: the browser must genuinely arm and complete native ticks. It makes no
flight-skill, mastery, reward, offline, controller or broad hardware claim.
