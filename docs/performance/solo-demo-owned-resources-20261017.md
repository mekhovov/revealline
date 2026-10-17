# Demo resource ownership and manual export

The existing Solo export did not enumerate Demo scene painters, transition surfaces, reward media or bot Worker handles. That omission prevented repeated-transition snapshots from establishing what Demo still owned. It was not evidence of a leak or of the reported device slowdown.

The change extends the existing six Demo/media owners and the application export boundary. It adds no resource manager, eager module import, per-frame snapshot or automatic upload. Source-load and scene-preparation counters change only at their existing asynchronous boundaries and remain positive until canceled work actually settles. Released scene owners leave the observation set immediately; their unsettled work remains visible through separate pending counters.

Manual export reports:

- The persistent display canvas separately from live BoardPainter surfaces, the transition canvas and reward poster.
- Observed shared image identities, deduplicated within Demo. Categories can overlap with each other and with existing Solo/image-pool reports; they are not additive totals.
- Worker handles from construction through successful calls to the existing `terminate()`. Termination requests do not prove native thread exit.
- Owned reward video elements, Blob URL bytes and the cancelable JavaScript play command. Native decode buffers, pending native playback and GPU copies remain unknown.

Canvas and image sizes are RGBA8 estimates from dimensions, not measured process memory. A closed Demo retains its display canvas. Closed canceled preparations can still report positive pending counts; an unknown native allocation is not reported as zero.

The application rejects export before serialization while spectator playback or practice advances. Hidden spectator playback remains active. Explicit Pause or renderer suspension does not permit an active Demo to export an unsettled scene preparation. After closing Demo, export can observe that outstanding preparation until settlement. These rules preserve the existing paused-export boundary without changing gameplay, checkpoints or replay.

## Verification

The final eight complete owner/host files pass **94/94** on declared stable candidate bytes in 55.61 seconds. They cover existing behavior plus exact scene/worker cleanup, ignored cancellation, throwing observation callbacks, idempotent worker release, repeated close/reopen, persistent display accounting, active/hidden/practice export denial and rejection before painter inspection. The prior missing-interface failures and intermediate assertion corrections remain in the evidence cache.

Raw TAP: 30,652 bytes, SHA-256 `4046b8bbdd433707665ababe460afee42ab2a012146d155c23a9913a15a9f311`. Reviewed patch: 30,366 bytes, SHA-256 `93e88876cf9c7822e9e3a485ca00a8f0e6f877d74b4b109e2b746a70948bf583`. All fourteen applied runtime/test paths match the exact tested candidate bytes; their tracked bases were independently checked before application. Scoped lint and formatting pass.

Appearance admission now includes the six newly required complete files; reward and quality files were already in its original 118-file gate and are not duplicated. The predecessor therefore has 23 files. Its thirteen policy controls pass with the original source checks, deadlines, duplicate rejection and exact-output binding intact. This prospective policy does not change the older 397 build's seventeen-file admission receipt.

These are source/model controls. Resource plateaus over twenty retries, ten Next transitions and sustained native play remain open. The new observations make that evidence possible; passing snapshots do not establish those plateaus or physical iPhone/Steam Deck performance.
