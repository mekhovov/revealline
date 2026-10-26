# Optional realistic roster: rendering contract and verification method

This note describes the implemented rendering path. It does not by itself qualify the final artwork or any device. Final artifact hashes and measured results belong in the accompanying browser reports.

## Ownership and state

The optional pack is admitted before decoding. Its prepared model owner retains shared geometry, materials, textures, and source rigs. Actor and remains consumers receive separately released leases. An actor clone owns its animation mixer and cloned skeleton resources; it shares admitted mesh resources. Activating a complete family/cast collection is atomic. Invalid or unavailable art returns to Current without changing accepted actors, hitboxes, events, or the saved defeat ledger.

The collection supports up to 36 family/cast identities. Up to 20 live actors use admitted skins. Live/LOD source roots and their preparation probes are shared across identities; equipment remains specific to each identity. A concrete accepted cast takes precedence over the global preference. An authored/unspecified cast uses the current shared selection, and a defeat records that concrete result for later restoration.

Animation time comes from accepted ticks relative to actor spawn, including rewind and pause. Low uses the final available distance mesh. Other qualities select distance meshes at 14/24, 40, and 80 metres, with a 15% hysteresis band. The present pack has one distance mesh. Regional origins are subtracted before positioning actors or measuring their distance.

Rigid equipment uses the admitted source-bone binding, not name heuristics. An optional validated `remainsRoot` reuses its geometry with the same authored pose as the rigid damage body regions; live equipment retains its original bone binding. Both roots must be active-scene, unskinned, bounded meshes. This prevents rest-pose sleeves or accessories from separating from an otherwise connected clean body. Equipment instance pools share source geometry and paints. A declared rigid remains root places the same gear geometry in the damage body’s source pose; this keeps bone-bound sleeves and accessories aligned on settled bodies without reusing the live rig’s rest pose. A brace opening offset is a translation in the selected bone's local frame before its bind transform. Routed braces remain closed during warning/burst and open during recovery/other vulnerable phases. Unrouted braces follow the same accepted 160-tick protection cycle as the encounter runtime: protected before tick 60, vulnerable from 60 through 159. Reduced motion removes interpolation.

## Remains, presentation budgets, and clean treatment

The 1,024-record logical ledger is separate from visible geometry. Records preserve accepted identity, pose seed, impact facts, and surface attachment. Changing art or restoring a ledger does not create a new defeat, replay a burst, or play audio.

Body and equipment fragments use shared instanced pools. Equipment with matching material and tint is merged within its body region. A complete body cluster is admitted before rendering; draw, instance, or authored-triangle exhaustion can substitute a complete Current cluster or omit a distant complete cluster. It cannot omit individual limbs from a selected body. Logical records remain available when their visible geometry is omitted.

| Detail | Bursts | Moving instances | Settled instances | Marks | Effect draw calls | Authored remains triangles |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Low | 4 | 128 | 256 | 32 | 16 | Current fallback |
| High | 6 | 256 | 768 | 96 | 24 | 600,000 |
| Ultra | 8 | 512 | 1,536 | 192 | 40 | 1,200,000 |

The triangle column covers the optional authored remains only. Total frame triangles additionally include terrain, living actors, their equipment, Current fallback geometry, and particles; the browser report records that separate renderer total. Draw-call caps in this table cover effects, not all living actors or terrain.

Blood off or Brutal off keeps a connected clothed body. Its rigid body regions share one settled transform and their original anatomical offsets. Interior caps and blood marks are omitted. Normal skin, hair, clothing, and equipment remain visible. Blood-enabled breakup uses the authored caps and separated body regions. Reduced motion uses settled poses without ballistic flight.

Marks remain grounded planar geometry. When a ground query is available, their center, corners, and edge midpoints must agree with the recorded surface height and normal. Unsupported marks are rejected as a whole. Accepted support results are reused across origin changes and recovery. This is not arbitrary mesh-conforming wall projection. Bodies settle cosmetically; there is no articulated physical ragdoll solver.

## Final browser workload

The final workload uses the production flight renderer and verified Railway Valley terrain/scenery compiler in a dedicated browser. Accepted actor snapshots, ticks, and defeats are synthetic so the rendering load can be repeated. Aircraft physics, radio sampling, and UI transport are qualified separately.

The intended measured run lasts ten minutes: Low, High, and Ultra, each with sequential effects-off and effects-on phases. All phases retain 20 live actors. Each effects-on phase begins with a full logical ledger and requests eight simultaneous mixed defeats every two seconds. It exercises all casts, terrain transitions, regional recentering, presentation rebuilds, preference changes, and archive restore. The first five seconds of each phase are excluded from CPU timing statistics.

Draw CPU includes actor/effect updates and renderer submission. The actor and effect timers are nested inside Draw CPU and must not be added to it. A separate accepted-input timer covers actor snapshot ingestion, new accepted event ingestion, and periodic archive export/restore. Presentation-frame CPU is the per-frame sum of Draw and accepted-input work. Fixture generation, terrain streaming waits, preparation, and simulation are excluded. GPU timer queries cover the whole draw and discard disjoint samples. Sequential off/on comparisons are observations, not paired-frame causal estimates.

Only the reported desktop/browser configuration is qualified. No mobile, low-end GPU, cross-browser, or photorealism claim follows from the representative or final desktop measurements.

## Verification fixture correction

An initial brief attempt was stopped after inspection showed that the effects-off fixture used the public new-run reset, which also retired the optional appearance. No timing from that attempt is qualification evidence. The final run clears only the presentation ledger through restore, retaining all 20 admitted living skins in both off and on phases; the report records the peak skin count for each phase.
