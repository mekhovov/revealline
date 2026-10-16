# Regional collision ownership diagnostics

Regional admission, verified-window and flight owners expose an explicit read-only `collisionSnapshot()` returning `{ worlds, colliders, rigidBodies }`. Live counts come from the owned Rapier collider and rigid-body sets. Disposed owners return zero without calling freed WASM objects. Counts include both the retained committed window and an asynchronously preparing replacement; no engine handles or mutable sets escape.

The normal flight snapshot and stepping path do not call this diagnostic. It does not change physics, geometry, budgets, scoring or recording formats, and introduces no shipped module. The mixed host's drone state is advanced by the shared flight solver, not a Rapier rigid body; zero rigid bodies in these static query worlds is expected.

`node authoring/fpv-worlds/regions/verify-continuous-flight.mjs` passes 10 scenarios, including a bounded ownership stress case:

- Forty accepted replacements and forty deliberate frame-preparation failures alternate between two-cell and three-cell windows with actual terrain and roof/wall colliders.
- Settled ownership stays at two query worlds, six or nine colliders, and zero rigid bodies. Failed candidates leave the previous query counts and readiness intact.
- During replacement, retained and staged ownership peaks at four query worlds and fifteen colliders. This counts the staging interval instead of sampling only after disposal.
- Returned counts are independent values: modifying one result cannot change subsequent observations.
- Disposal during held asynchronous preparation releases both old and staged ownership; awaiting completion and disposing again both report zero worlds, colliders and rigid bodies.
- The preceding nine scenarios still cover accepted continuous movement, delayed/corrupt sources, unsupported pose rejection, cancellation and graphics-preparation failure. Their existing 2,200 accepted-tick/four-crossing result remains unchanged.

These are ownership and actual live-set counts, not process heap, WASM allocator capacity, GPU memory, garbage-collection timing or device FPS measurements. They complement the separately recorded 48,000-tick synthetic workload; this shorter replacement stress does not retroactively add collider measurements to that earlier receipt. No player database or browser storage is used.
