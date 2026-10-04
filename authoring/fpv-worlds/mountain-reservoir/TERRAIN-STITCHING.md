# Reservoir r9 terrain-boundary candidate

Published r8 remains immutable. Its offline-flight screenshot exposes triangular
sky gaps behind the western rock terraces: the decorative heightfield has an open
inner boundary, and its sampled edge interpolates between the discrete terrace
levels. The existing world boundary prevents flight beyond that edge.

The optional `--terrain-stitching` generator variant closes the west x=-44m and
north z=-34m edges down to the existing y=0 floor. It adds 34 inward-facing rock
triangles to the existing mineral batch. Every original position, normal, UV and
vertex color remains an exact byte prefix; all other meshes, original texture,
materials, nodes and scene ownership stay exact. No playable collider, course
criterion, spawn, bound or source binding changes. The default generator still
reproduces published r8 exactly; the candidate receives revision r9.

The generated candidate has 12,050 imported triangles, 13 materials, one texture,
60 nodes, 48 colliders and 108 collision triangles. Source GLB is 1,171,468 bytes
(`ca838e9e028838a5a17f74831d4ef8206a14addd2baa510da78f28dd25bd9aac`);
prepared GLB is 1,169,844 bytes
(`925dec1cfa0a70d3ca2aacb5f5fc56cb17693c3522352719d35a6f13ef6771a4`).
The new exact pack is `28a50cb742ce0825edbf760d42fb93fb4147daee1b23f590ef7baf59a4023894`.
It does not inherit the old pack's sixteen recording dependencies.

Manual asset qualification passes 315 checks, including default-r8 and
current-candidate reproduction, every original mesh attribute, new boundary
coordinates and inward normals, exact old edge vertices, and all eight courses
equal apart from revision. The prepare pipeline reports zero validator errors
and exact pack/ZIP round trips. These checks do not establish visual acceptance,
frame times, new-pack demonstration qualification or representative finished art.

The static comparison uses the same course, camera and unchanged admitted renderer
for both immutable prepared GLBs. Review west/north low FPV and a grazing western
angle, then the wide composition and Low/Balanced/High visibility. Covered skirt
segments are behind the existing closed terrace solids; inspect grazing views for
coplanar artifacts. Pixel/shared-style controls retain their existing ownership.

```sh
node authoring/fpv-worlds/mountain-reservoir/build-world.mjs ACCEPTED_R4_PREPARED NEW_R9_OUTPUT --terrain-stitching
node authoring/fpv-worlds/mountain-reservoir/qualify-terrain-stitching.mjs FROZEN_R8_OUTPUT NEW_R9_OUTPUT
node authoring/fpv-worlds/mountain-reservoir/prepare-preview.mjs COMPLETE_ADMITTED_PLAYER NEW_R9_OUTPUT NEW_PREVIEW FROZEN_R8_OUTPUT
```

The next quality work remains separate: material scale, terrace/ridge composition,
purposeful maintenance dressing, and fixed FPV/chase/overview acceptance. Festival
is preserved at `47f8e36e600205e94883fb5568f37b9ce963e88d`; its production remains
paused until Reservoir establishes the representative standard.
