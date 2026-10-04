# Mountain Reservoir — first scene checkpoint

This is unfinished D5 authoring work: one original shared scene and **Shoreline
check-in** (`mountain-reservoir-01`) in two selectable modes. It is not a delivered
eight-course world. Seven courses, sixteen final exact-pack demonstrations,
visual/collision acceptance, native installation and offline qualification remain.
No files are added to the default catalogue, admitted source closure or precache.

`source/scene.mjs` owns original geometry, colors, collider locations and semantic
markers. No third-party art or texture downloads are used. The explicit original
art license is in `source/LICENSE.md`. The existing `scripts/fpv-content.mjs`
pipeline validates and prepares the GLB with its pinned dependencies; this recipe
does not claim a Blender export.

The renderer already draws course collision solids. The GLB adds only outlying
mountains/firs/water and shallow closed-face markings, never duplicate collider
shells. Polygonal terraces use the exact explicit collision triangles as their
visible geometry; the maintenance hut is closed, and its windows and door are
opaque paint. Source collider markers identify the boxes. The single original
source generates the remaining terrain triangles directly into the course.

The first flight area is x −44…6 m, z −34…38 m, y 0…28 m. The yellow inspection
rail at x 5.5 m is the visible water-side boundary cue; the reservoir starts at
x 8 m outside that area. The course lands on a named solid shore pad. It does not
simulate water buoyancy, swimming or landing on water. Later routes must preserve
a coherent accessible scene and state their water boundary honestly.

Generate into a **new** directory using Node 22 and the shared pinned dependencies:

```sh
node authoring/fpv-worlds/mountain-reservoir/build-checkpoint.mjs /tmp/NEW-RESERVOIR-CHECKPOINT
node authoring/fpv-worlds/mountain-reservoir/prepare-preview.mjs COMPLETE_ADMITTED_PLAYER /tmp/NEW-RESERVOIR-CHECKPOINT /tmp/NEW-RESERVOIR-PREVIEW
```

The first generated candidate has 4,556 imported triangles, 12 materials, no
textures, 34 collision bodies and 132 explicit collision triangles. Prepared GLB:
340,448 bytes, SHA-256
`a0f85f07c52a0dbe695e88af5a25f55bd7118e30a6daa4cf332a8f6f97207a5f`.
Khronos validation has no errors and the existing pack/ZIP round trips preserve
the normalized course/project. These are transport checks, not visual or flight
acceptance. The initial static preview uses the actual admitted renderer with
declared static camera states; it cannot demonstrate course completion.

The original `r1` review outputs are in `/tmp/fpv-mountain-reservoir-scene-r1`
and `/tmp/fpv-mountain-reservoir-preview-r1`. Changed candidates must use new
directories. Keep rejected visuals and failed qualification receipts rather than
rewriting their frozen inputs. The ordinary-controls proof pass will use the
existing `adventureAuthoringPilot`, then independent replay, after the shared
qualification lane is released.
