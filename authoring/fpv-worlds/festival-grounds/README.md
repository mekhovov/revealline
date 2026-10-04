# Festival Grounds — first scene checkpoint

Independent D5 work after Mountain Reservoir #1066. This is **one orientation
course**, not a completed eight-course world. The revised r2 scene has
12,172 imported triangles, 12 material batches, two original 256px surface textures
and 44 explicit solids. The existing pipeline reports zero GLTF validation errors
and exact editable ZIP round-trip preservation. Static clearance/source-collider
verification passes 159 checks. Actual r2 art review and ordinary flight proofs are
still pending.

R1's 123 static checks passed, but actual entry/wide review rejected its flat lawn,
sparse stage and weak festival identity. That receipt and screenshot remain in
`evidence/r1-static-review.json` and `evidence/r1-wide-high.png`. R2 keeps the open
lawn while exposing existing ground-profile grass, adding original pebble path
detail, supported stage beams and patterned fabric, closed kiosk finish and
Ukrainian signs, and two physically supported perimeter benches. These changes
are candidates for visual review, not an artistic acceptance claim.

See [design, reference and scope](DESIGN.md). All art is original
[CC0](source/LICENSE.md). The existing runtime, physics, Themes, package ceilings
and bundled catalogue are unchanged. New unit coverage remains deferred to D6.

With the existing pinned authoring dependencies and Node 22:

```sh
node authoring/fpv-worlds/festival-grounds/build-checkpoint.mjs NEW_DIRECTORY
node authoring/fpv-worlds/festival-grounds/qualify-scene.mjs \
  NEW_DIRECTORY/prepared/festival-grounds-checkpoint.r2.rlpack NEW_RECEIPT.json
node authoring/fpv-worlds/festival-grounds/prepare-preview.mjs \
  EXACT_ADMITTED_102_PLAYER NEW_DIRECTORY NEW_PREVIEW_DIRECTORY
```

The preview authenticates and hardlinks immutable admitted assets, preserving
the exact renderer and package locale projection. It offers entry, market,
stage-under-roof, roof, clock, wide and overview poses; quality, mode and appearance
selectors do not change collision. It is a static art observation, not flight,
performance, offline or device acceptance.

After visual acceptance, finish the approved orientation / three races /
precision / follow / observe / capstone allocation. Freeze the final shared World
before generating all sixteen demonstrations and qualifying real import, Watch,
editing/reimport and offline entry. Do not advertise the world in the production
Library catalogue before it is complete and published.
