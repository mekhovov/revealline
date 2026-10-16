# Optional coarse terrain cells for large natural regions

Source capability, 15 October 2026. No new world, default Library row or public
release is admitted by this change.

The approved Desert Expedition target is 16 × 16 km. Using the current 33 × 33
terrain source with 256 m cells requires four times as many files as the 8 km
Canyon inventory. This opt-in 512 m lattice permits a 32 × 32 region covering
16.384 × 16.384 km with the same terrain vertex count and file count as that
Canyon source. Actual delivery size still requires an authored source receipt.

## Compatibility and limits

- The existing 128 m and 256 m lattices keep their canonical GLB bytes, collision
  sampling, local-origin guard and accepted source identities.
- New 512 m cells have **16 m height samples**. Use them for broad natural terrain,
  not intricate ground gaps. Narrow bridges, structures and detailed obstacles
  need explicit scenery geometry and collision.
- A 5-cell window needs anchors within 1,280 m of its origin. Only the new lattice
  receives that reach; older lattices retain 640 m. Every required sparse empty
  cell must satisfy the same guard as a populated cell.
- Complete X/Z grid endpoints must stay within the existing ±100,000,000 mm global
  position domain. A valid spawn alone cannot admit unreachable distant cells.
- Existing 64 MiB delivery, 2 MiB terrain window and 8 MiB combined retained/candidate
  resource limits remain unchanged. No shader, decoder, texture or physics change.

## Functional evidence

Run `node authoring/fpv-worlds/regions/verify-wide-cells.mjs`, then run it with
`FPV_VERIFY_CELL_MM=512000`. Logs are retained beside the authoring verification.

Both runs exercise canonical bytes, actual geometry and slope normals, wrong-size
rejection, global X/Z extent boundaries, all four horizontal local-origin limits
and one-millimetre failures for terrain, populated scenery and explicit-empty
scenery. Real support/sweep queries cover roofs, walls, boundaries, failed atomic
replacement and disposal across six negative-coordinate cells.

Actual Acro and Self-level sessions arm explicitly and pause safely. A continuous
commanded crossing records 4,013 ticks / three origin changes / zero contacts at
256 m, and 7,636 ticks / three origin changes / zero contacts at 512 m. These are
accelerated source checks, not elapsed endurance or device performance evidence.

The full 3 × 3 explicit-empty scenery companion passes diagonal X/Z transitions,
retained/staged cancellation and retry, and geometry/source rejection before extra
fetches. Resident geometry is 456,408 B and retained plus staged is 912,816 B;
scenery fetches remain zero. Camera bounds/depth checks pass all three cell sizes.
Run `verify-coarse-window.mjs` and `verify-flight-preview-bounds.mjs` in the same
authoring directory. Their JSON observations are retained with the crossing logs.

The existing eleven terrain and seven sparse-scenery functional groups also pass.
Native camera/flight review and exact package qualification remain required before
this capability supports a newly admitted player region. The full roadmap remains
open; 16 km finished-world availability is not claimed.
