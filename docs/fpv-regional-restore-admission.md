# Conservative regional saved-location admission

This prerequisite adds an explicit `requireClearRestore: true` flag to verified support poses. It does not enable favourites or change ordinary flight, collision response, authored starts, scoring or recordings. Stored locations will remain untrusted even when originally captured during flight.

An opted-in restore still needs verified required cells, supporting height and no sphere/surface overlap. It additionally requires the drone centre to be outside every relevant solid scenery component. Certification uses the exact Float32 positions and indices supplied to the renderer and collider, with the same local translation. Visual-only geometry is excluded at the collider boundary.

## Deliberately limited proof

Vertices are welded exactly within each verified surface, then connected triangle components are checked for closed, consistently oriented manifold topology and convexity. Certified convex interiors reject. Numeric boundary cases, open/clipped/non-manifold or concave components containing the point in their bounds return unavailable. Oppositely oriented disconnected solids cannot cancel each other. Separate wall solids permit ordinary room cavities, doorways and elevated pads; this is not a general proof for arbitrary complex meshes.

The actual original Urban mill slab interior at body position `{x:41000.25,y:7900.125,z:64000.75}` rejects with the restore flag while both authored Urban starts accept. Without the flag, existing flight/adoption policy remains unchanged. A failed restore cannot publish a new scene or origin; previous geometry remains retained.

## Work and ownership bounds

Certification is lazy and cached once per exact scenery owner. It yields during triangle/topology work and every 2,048 plane tests; cancellation, scene replacement and disposal interrupt it. No certification runs on the flight input/tick path. Final classification happens only after preparation, before synchronous adoption, and the final live pose cannot remove the restore requirement.

Limits are 16,384 triangles, two million plane tests and 512 KiB of retained typed-array certificate buffers per owner (at most 1 MiB across retained and staged scenery owners). `certificateBytes` is the sum of actual typed-array `byteLength` values for bounds and planes, not a claim about total JavaScript heap usage; bounded topology maps and temporary arrays are released after certification. Existing geometry/texture/source byte caps are unchanged. A budget-exceeded certificate is unavailable, never clear.

## Verification

Nine focused scenarios cover convex interiors/boundaries, cached repeated checks and disposal, reversed solids, doorway/room/pad poses, open/non-manifold/concave geometry, cooperative cancellation and work limits, exact Urban source-backed admission including loading-hall doorways/interiors and an elevated roof, missing cells/retry, final live-pose protection, and exclusion of actual RGBA visual-only geometry. Existing mixed-owner, continuous-flight and precise-position verification is retained. No native UI or hardware claim is made by this prerequisite.

The new runtime module is explicitly included in both distribution closures. The combined source-file envelope is 161 (latest main 160 plus this module); the 20 MiB byte cap is unchanged. This is structural closure verification, not a completed package qualification. Rejected restoration exposes the typed `regional-restore-unavailable` code so the future UI can localize its explanation without parsing technical messages.

## Remaining before player favourites

Add bounded exact-region/revision storage, plain-text labels, explicit paused save/restore and safe zero-input/disarmed restart. When restoration is unavailable, display a localized short explanation such as “Choose a clear starting point”, keep the saved record, and offer an authored starting point. Do not describe an unavailable saved restore as a judgement that normal flight is unsafe. Package qualification and native favourites interaction remain pending.
