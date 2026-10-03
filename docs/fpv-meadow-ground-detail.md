# Meadow ground surface detail

3 October 2026. This bounded D2 increment starts from main
`b3167a8f89c09286a424996ba4f7e3dca4a351b2`, including the merged Yard
composition and Woodland tree/foliage work. It gives authored Meadow ground
subdued soil patches and scattered short dry-grass detail at close flight height.
It changes color, normal and roughness pixels on the existing ground material.
There is no new grass geometry, decal, obstacle, texture allocation or asset file.

## Scope and ownership

The recipe is selected only for `environment === 'field' && !pixel && !kit`.
Pixel and the 17 shared visual collections retain their existing material maps.
The `grass` material role, palette authority, 12-metre tile, UVs, ground plane,
normal scale, geometry, object hierarchy and all quality budgets remain unchanged.
The new recipe uses the existing three generated maps and their world owner;
roughness and ambient-occlusion bindings still share one data map.

Periodic broad/fine noise supplies calm soil patches. An independent seeded
24-by-24 tuft grid jitters short blades, fully contained within half-metre cells,
so feature masks do not create tile-edge cuts. Blade height and soil relief track
the visible color features. Normal derivative compensation applies only to this
recipe. The shared grass generator and its random-number sequence are unchanged.
Existing low/balanced/high map sizes, mipmaps and anisotropy caps stay intact.

The current field scope contains 43 courses: `flight-05`–`flight-12`,
`beginner-08`–`beginner-27`, `beginner-29`–`beginner-30`, `beginner-43`–`beginner-44`,
`beginner-46`–`beginner-51`, `beginner-53`–`beginner-56`, and `beginner-58`.
Their four arena widths are 44, 64, 88 and 150 metres. The separate controls
preview also uses field ground in a 160-metre arena. No lesson, target, large-school
reference bar/tower/platform ID, flight bound, collision/support surface, route,
recording or appearance pin changes. Existing groves and distant hills keep their
positions, geometry and shadow behavior. No draw call is added.

## Verification

The maintained manual CPU qualification binds all unchanged runtime sources to
the pinned main and compares real before/after procedural scenes. It is manual
functional evidence, not new unit coverage. Existing workshop, texture and
acceptance checks pass 30/30. Full `npm run validate`, changed-file lint, formatting and syntax checks pass.

`docs/evidence/fpv-meadow-ground-detail-cpu.json` records 1,777 passing assertions
across 324 cases: 228 catalogue scenes, 57 controls-preview scenes and 39
other-environment regressions. All 17 shared collections and their seven roles,
Pixel pixels, geometry, UVs, material parameters, sampling, AO/metal/alpha
channels, resource counts and exact-once cleanup remain preserved. Deterministic
rebuilds and live preset cycles pass. All 51 installed field recordings replay
over 61,383 ticks, including exact final identities for all 35 World recordings.
Seventy-one immutable files match the baseline. The CPU receipt records the
working-tree base and independently binds the actual candidate visual/script
bytes by SHA-256; its visual hash is the same as the frozen source fixture below.

The immutable source fixture is
`http://127.0.0.1:8834/dist/fpv-meadow-ground-detail-verification-source/index.html`.
It freezes 31 modules per side / 19,692,954 bytes. Candidate visual SHA-256:
`9e8cb61d40010cbc76a2f72358b47000c4d4b2d9d03174eccf0d26efcb371a80`.
The fixture uses actual flight renderers across four arena sizes, three presets,
authored/Pixel/Industrial Workshop, FPV at 1.5/3/6 metres, chase and overview.
It checks all 43 course scopes, lateral views, unchanged Hangar/Woodland pixels,
live preset restoration, resource plateaus and final disposal. Its compact
receipt retains every check and image hash/count without raw pixel buffers.
Preparation is not a browser pass; the coordinating agent owns actual browser
review. Source/package admission and player evidence remain before readiness.
No physical-device FPS, novice readability, final artist or public deployment
acceptance is inferred. Additional unit coverage remains deferred under the
approved plan.
