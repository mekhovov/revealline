# Mountain Reservoir — first scene checkpoint

This is unfinished D5 authoring work: one original shared scene and **Shoreline
check-in** (`mountain-reservoir-01`) in two selectable modes. It is not a delivered
eight-course world. Seven courses, sixteen final exact-pack demonstrations,
final-world visual/collision acceptance and offline qualification remain.
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

The actual `r1` scene review **rejected the artwork**: single-triangle mountains,
an apparently floating far-bank wedge and rectilinear shore did not meet the
world-quality target. The rejected screenshot and observation remain at
`/tmp/fpv-reservoir-scene-r1-rejected.png` and
`/tmp/fpv-reservoir-scene-r1-observation.json` (both also retained in `evidence/`);
transport validation above is not
art acceptance. No course proof generation or seven-course expansion followed.

The `r2` source replaces those wedges with a continuous irregular bank and ridge
heightfield outside the first flight area. It uses one original 256px mineral
texture at a four-metre repeat, muted per-vertex variation and tree roots placed
on the exact rendered triangle surface. Existing course collision solids, route,
dam, hut and rail are retained. The authoring targets are fewer than 15,000
imported triangles and 1.2MiB source GLB; production admission limits are unchanged.
This revision still requires actual visual acceptance before flight proofs.

Generated `r2` has 8,996 imported triangles, 11 materials and one texture;
the complete normalized course is byte-equivalent in JSON content to `r1`
(34 collision bodies and 132 explicit terrain triangles). Prepared model:
1,099,076 bytes, SHA-256
`cb799ef07882e62e415d28746ea99a1f36a872b091fd17c9dd5257bb2535334a`.
Khronos validation reports zero errors. These remain transport and scope checks,
not visual acceptance or flight proofs.

Actual `r2` review accepted the connected terrain correction but rejected the
overall artwork: beige dune-like slopes, sparse repeated cones, bank UV strips
and uniform water/shore remain visible in the retained `evidence/` screenshot
and observation. No proofs or additional courses were generated.

The `r3` source uses grey exposed rock versus olive cover by surface slope,
triangle-consistent metre UVs, low embedded bank outcrops, varied clustered firs
and deciduous crowns, shallow/deep water color, and flush meadow/gravel cover
over the unchanged flat support. The closed hut, roof, paint and exact collision
solids move together to x −26…−18 m, z −19…−11 m, removing their overlap with
the western rock terrace. Project/course revision advances to `r3`; route and
physics remain unchanged. This is another scene candidate, not art acceptance.

Actual `r3` Shore/Wide/Hut and low-graphics review accepted a **first-scene
checkpoint for ordinary-flight/collision qualification only**. It remains
stylized and is not final full-world artistic acceptance. The first collision
pass then correctly failed before either flight: a sphere wholly inside the
rectangular dam did not intersect its closed Rapier triangle shell. The failure
is retained. `r4` uses solid cuboids for the same rectangular dam and roof
envelopes; irregular terraced rocks retain explicit surface triangles. No
runtime physics or route changes are introduced, and the interior-spawn check
is retained. A new exact pack must pass before any completion claim.

The `r4` checkpoint now passes 28 functional checks: Self-level completes in
2,990 ticks and Acro in 3,002, both with zero contacts, full health and the named
shore pad support. Touchdown speeds are 261/262 mm/s under the unchanged 700 mm/s
criterion. The shared pilot's original 65mm early motor cut produced 1,135 mm/s
and is retained as a failed recording. The qualifier now supplies ordinary 48%
throttle through that final gap until actual contact; it does not alter flight
state, criteria or physics. Complete and archive-import replays match terminal
identities. The two-record archive SHA-256 is
`521ddfd1e747e7deec17bebf53d00c30365beb19da5715000939164c7a4754c8`,
bound to pack `4c4a0aba2c6347f7670b86a40af5a0d9dd8a1be0e0b65e4a66465c4684136c6c`.
These remain two **checkpoint** proofs; final shared world geometry/bounds will
require all eight courses and sixteen demonstrations to be qualified anew.

`prepare-import.mjs` freezes all 102 members of the separately accepted historical
`#1060` admitted player (`79a721dd19343726fed30f618a2d7c8cd164d691`) by exact
manifest hash and immutable hardlinks. It adds only the external content and a
manual host harness; no runtime overlay or package rebuild. The real File input,
native IndexedDB, collision queries and both catalogue Watch replays passed
139 actual-browser checks on authoring commit `8bf37589c9882dfbdefa9a72b10746d78a39ff5a`.
The two replays reached the exact 2,990/3,002-tick terminal identities with no
contacts, full health and 261/262mm/s landings. The harness preserves production pause/focus
guards, uses paused shader warmup and a lightweight draw observer, and provides a
separate native-animation-clock launch for manual inspection. It is not an
offline, hardware or full-world acceptance claim.

The separate native-clock imported player rendered Shoreline check-in, armed,
advanced its timer and retained full health. Actual keyboard P paused at 99.6s;
two nested pause-button lookups failed, so this run does not qualify that button.
The import and native-launch JSON receipts and screenshots are retained under
`evidence/fpv-reservoir-{import-browser,native-launch}-r4.*`. This is an accepted
first-course import/collision/playback checkpoint, not delivery of the entire
Reservoir world. Any later shared bounds or geometry revision changes the exact
pack dependency and requires new final proofs for all eight courses.
