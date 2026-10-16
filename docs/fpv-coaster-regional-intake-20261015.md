# Coaster Park regional asset preparation

This is source preparation for the planned original larger park. The existing
160 m practice world is preserved. No new default Library entry is added here.

The selected input is Kenney Coaster Kit1.0, licensed CC0-1.0 on the official
[asset page](https://kenney.nl/assets/coaster-kit). The exact6,697,401B archive hash
is `7723d02e3ea822371e12e14722e72d572fdb0384c1379c1469e0598a371f5c7a`.
The retained12-file subset is521,044B including its license and original palette.
The provenance receipt records each exact file hash. No competitor map is copied.

The existing indexed scenery format retains all512×512 palette pixels, UVs and
normals. The kit is double-sided: the authoring adapter explicitly bakes reversed
triangles with opposing normals, avoiding a new runtime material contract. Model
positions are transformed at6× authored scale and quantized to integer millimetres.
No original file is modified.

Eight models pass canonical render/collision identity, complete palette round-trip,
UV/normal/index checks, deterministic serialization and zero GLB validator warnings
or errors: park entrance, station, food/drink stalls, steel loop, steel straight,
large tree and support. The wooden hill and hanging corner each contain a triangle
that collapses after millimetre quantization. Both originals remain retained and
explicitly rejected; this preparation neither drops triangles nor admits them.

Run `node authoring/fpv-worlds/regions/coaster-park/verify-source.mjs NEW_DIRECTORY`
with the repository's authoring dependencies (`@gltf-transform/core` and extensions
4.5.1; gltf-validator). The output directory must be new. The checked-in JSON records
the bounded preparation results; generated scene files stay outside the player.

Remaining: author coherent connected ride districts, safe routes and terrain;
verify actual flight/collision and shared resource bounds; review at pilot height;
then publish immutable delivery and a separately qualified Library entry. Animated
rides, final lighting and public availability are not claimed by this source intake.
