# Regional geometry and flight-frame adoption

The verified geometry owner previously replaced its group and disposed the old one before the flight host resumed its `await`. A cancellation during that handoff could leave the retained visible geometry and the body's local origin out of sync. This increment closes that boundary without changing flight equations, collision rules, source identities or proof data.

Both verified terrain and scenery owners accept an optional third transition argument: a trusted host transaction with synchronous `commit({ group, provenance })` and `rollback()` callbacks. This is host code, never imported region data. The callback references are captured before transport. Asynchronous callbacks and malformed transactions are rejected before requests start.

All source hashes, canonical render/collision agreement, budgets and support tests still run first. The staged group is then adopted by the host; cancellation is checked again before the verified owner publishes it. Host attachment, local origin, drone pose and camera anchor move in one synchronous section. Only then is the old geometry disposed. A thrown callback or synchronous cancellation runs rollback and disposes the staged group while retaining the old owner. Owner readiness stays false on error/cancellation, so retained scenery cannot accidentally authorize flight.

Cancellation queued after the synchronous commit keeps the complete new frame and pauses it. It does not attempt to restore already-disposed old geometry. Retry remains explicit and never arms automatically; the usual neutral-control arm check still applies. The transaction does not change the global integer body, velocity, rotation, angular state or accepted tick count.

## Focused verification

`node authoring/fpv-worlds/regions/verify-frame-transaction.mjs` exercises the actual pinned Three/Rapier owners with hash-verified canonical terrain and scenery fixtures:

- Failed host adoption restores the previous visible group and provenance; retry replaces it once and releases old resources.
- Synchronous cancellation inside attachment rolls back before owner publication.
- Cancellation queued during attachment retains one coherent newly adopted group/origin, with queries unavailable until recovery.
- Invalid asynchronous transactions trigger no network requests.
- Actual flight-root attachment cancellation preserves all body values, local origin, recentre count, drone pose and old children; retry remains disarmed until a neutral arm.
- Cancellation in the promise handoff leaves the actual flight origin equal to the retained geometry origin, without an empty visible group.

The twelve focused scenarios pass, including actual flight-host cancellation/retry through both terrain and scenery profiles after integration with the shared geometry adapter. Existing regional flight checks (6 scenarios, including 2,196 accepted ticks across four cells and five local frames) and shared input-session checks (8 scenarios) pass. Existing exact-source terrain checks (12 scenarios) and scenery checks (11 scenarios) also pass, including failed successors, cancellation, disposal and repeated bounded ownership transitions. Five commanded Urban regression routes also pass: warehouse doorway, solid wall contact, elevated roof descent, parking shaft and 1,862-tick cross-cell road flight with two origin crossings and zero contacts. No GPU, FPS or physical-controller claim is made by these deterministic lifecycle checks.

This remains an unscored authoring path with `playerReady: false` and `flightReady: false`. A shared production regional host, combined terrain/scenery ownership, full application navigation, large-world packaging and device qualification remain outstanding. The callbacks are deliberately not a permission to substitute unverified geometry or to await work during adoption.
