# Themeable SIM source kit

The eight collections are original procedural source art shared by Academy, World,
replay presentation and the drone hangar. It extends the existing meshes; it does
not replace collision geometry or flight rules. Imported GLB scenery retains its
author's materials by default; explicit compatible bindings can replace selected
materials. Industrial Workshop, Vyshyvanka, Dnipro Porcelain, Tryzub, Desktop 98,
DOS Navigator, Orchard Workshop and Neon Ruins are selectable collections;
Authored remains available independently.

## Runtime contract

`renderer.setPresentation({ collectionId: 'industrial-workshop', revision: 'r1' })`
prepares a renderer choice. It takes effect on the next `setCourse(course, mode)`.
Use `collectionId: 'authored'` to resolve the course's existing or pinned profile.
`setDrone('racer' | 'pixel' | 'utility')` retains that explicit model choice while
using the selected collection's materials. These functions do not mutate courses.

`resolveSimThemeProfile(course, presentation)` supplies a detached, validated
profile for callers that retain appearance with a replay. Session ownership,
first-arm freezing and recording identities are handled outside the renderer.
Fresh World records use `snapshotSimThemeProfile`, which pins `ThemeProfile.v2`
with its original authored fallback. An unavailable collection revision resolves
that fallback for rendering without changing the saved course or proof. Older
v1 profiles remain readable and use the environment fallback when necessary.
The hangar accepts `getPresentation`, `getCourse` and `getQuality` callbacks and
uses the same `buildDroneVisual` source as the flight renderer.

The shared `game/presentation/theme-system.mjs` publishes bounded
`SimVisualCollection.v1` source descriptors, re-exported by `world-themes.mjs`
for Authored and all eight theme families. Each revision has complete model, asset,
material and effect role bindings plus local source provenance. The registry drives profile
selection and appearance fallback; the material builder consumes the same
collection descriptor. `validateSimVisualCollection` admits immutable plain data
within 16 KiB, validates complete roles, and rejects external asset URLs or unsafe
source paths. Validating a descriptor does not install its code or source assets.
Unknown IDs/revisions resolve to Authored while retaining requested identity;
the strict renderer normalizer still rejects unsupported direct selections.
The shared contract imports only the bounded-data utilities; Studio can resolve
and export a candidate offline without fetching the optional renderer or Three.js.

The fourteen effect roles cover player/hostile pulses, ghost/emissive/trail,
goal outline/active/complete/inactive/glow/inactive glow/emissive/badge and the
direction arrow. All colors are bounded RGB integers. Industrial retains distinct
teal player cues, warm hostile cues, amber active guidance and a translucent blue
personal-best ghost. Opacity, geometry, animation timing and reduced-motion
behavior stay with the existing renderer. Effects resolve from the effective
pinned profile at `setCourse`; preparing a later choice cannot recolor an active
flight. Authored retains its exact earlier colors, including on revision fallback.

`SIM_VISUAL_COLLECTIONS` and `bindSimModelRole` register and validate these roles:

| Role        | Actual first-collection implementation                                                                                                                      |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Drone       | Steel service hull, rubber arms/skids, copper motors and flush fasteners, enamel service panel; all three explicit body choices retained.                   |
| Gate        | Existing clearance frame, inset fastener plates and amber active guidance; opening dimensions unchanged.                                                    |
| Marker      | Numbered beacons, octagonal ring and established status contrast.                                                                                           |
| Landing pad | Enamel deck, existing H/ring, instanced copper fasteners within the pad.                                                                                    |
| Vehicle     | Steel body, rubber tires, copper hubs and inset enamel side plates.                                                                                         |
| Enemy       | Shared drone/sentry/patrol/vehicle shapes with service panels and distinct friendly/threat indicators.                                                      |
| Obstacle    | Original box/trimesh surface with steel or timber treatment; authored geometry, transforms and IDs retained.                                                |
| Scenery     | Existing environment geometry, service conduits outside indoor bounds, courtyard vents, instanced container ribs/castings, timber bark and natural foliage. |

The eight environments covered are gym, field, woodland, courtyard, warehouse,
stadium, container yard and garage. New scenery details remain outside the flight
area. Geometry tests compare original scene placements while separately identifying
cosmetic additions. Drone tests verify exterior bounds for all three body choices.

## Materials and ownership

`world-visuals.mjs` defines steel, rubber, copper, concrete, enamel, timber and grass.
Each color map is an original deterministic 128×128 sRGB RGBA texture generated
locally without using the simulation RNG. Metalness and roughness remain explicit
material properties. The color map is never mistaken for a tangent-space normal map.

The calibration's eighth swatch adds a separate, original 128×128 bevel normal
texture derived from a periodic height field. Encoded tangent normals use +Y and
`NoColorSpace`, with unit-vector tests and the same mip/anisotropy policy. The
generator has fixed dimensions and does not read external data. This normal map
is only requested by the calibration page; production scene materials retain
their measured sampling and texture counts.

World surfaces use linear magnification, trilinear minification and mipmaps. The
anisotropic sample caps are 1/4/8 for Low/Balanced/High, limited by device support.
Quality changes update sampling without regenerating source art. Interface/arcade
pixel sampling is independent.

A material factory shares textures within one ownership group. Scene teardown
disposes unique textures, materials, geometries and instanced mesh buffers once.
Flight diagnostics expose renderer draw calls, triangles, texture counts and owned
resource counts. Repeated perimeter decorations share two instance batches across
all containers. Drone bolts, gate plates and vehicle hubs/panels share batches
within each moving group. Small inset fittings receive shadows without adding
their own shadow-map draws.

## Visual inspection

Start the normal local server, then open
`http://127.0.0.1:8768/authoring/fpv-worlds/calibration.html`.
This unlocked authoring route uses the actual flight renderer. It runs no physics,
does not award progress and does not modify player preferences. Select environment,
camera and quality, and compare the selected collection against Authored. The
material canvas and flight scene both expose all eight collections and share the
same production materials and drone geometry.

The Compare button warms 30 frames and samples 120 identical view frames for each
collection. Its report identifies environment, camera, quality, average draw calls
and triangles, texture count, median and p95 browser CPU render time. These are
local diagnostics, not GPU timing, physical-device acceptance or whole-game FPS.

Automated checks:

```sh
node --test game/test/fpv-workshop-visuals.test.mjs
```

Safari inspection confirmed actual rendering of the gym overview and material/drone
specimens. Headless Chrome inspection also confirmed the container-yard overview,
moving yard and warehouse FPV views, actor silhouettes, amber numbered goals and
the material/drone specimens without JavaScript errors.

Local Chrome, 1440×1000 viewport, Balanced, 30 warmup + 120 measured frames:

| Scene/view                     | Authored → industrial draw calls | Authored → industrial CPU p95 |
| ------------------------------ | -------------------------------- | ----------------------------- |
| Container yard 07 / overview   | 164 → 173                        | 1.2 → 1.2 ms                  |
| Container yard 07 / moving FPV | 89 → 95                          | 0.7 → 0.8 ms                  |
| Warehouse 02 / moving FPV      | 215 → 220                        | 1.0 → 1.1 ms                  |
| Woodland 06 / overview         | 239 → 244                        | 1.2 → 1.1 ms                  |

These short, quantized CPU samples do not establish the full-frame p95 budget;
the yard moving view's 0.1 ms increase also exceeds 10% in relative terms.
The overview has 12,704 triangles versus 6,180 authored triangles.

### Repeated lifecycle and frame-cadence check

On 2026-10-02 the same local route was checked in headless Chrome 154.0.8037.93,
WebGL 2 via ANGLE Metal on Apple M4 Pro, at 1440×1000 and device pixel ratio 1.
This is a local browser check, not physical-device certification.

Eight cycles visited every environment with both collections, alternating Low/FPV
and High/overview, then restored the same yard 07 Balanced/overview baseline.
That is 128 environment/collection configurations and eight baseline restores;
24 Windows/DOS/industrial specimen changes ran alongside them. Every restored
baseline held the same counts:

| Counter                                            | Initial and every restored baseline |
| -------------------------------------------------- | ----------------------------------- |
| Registered scene geometries / materials / textures | 105 / 68 / 22                       |
| Renderer geometries / textures / shader programs   | 105 / 25 / 8                        |
| Specimen geometries / textures / shader programs   | 43 / 13 / 4                         |

The initial run found a real lifecycle defect: Three's shared depth-material
uniforms re-uploaded a disposed previous-course map during some scene changes.
The generated opaque-mesh shadow path now omits its irrelevant color map. The
fixed run held the plateau above, with no disposed-map re-uploads, WebGL context
loss or JavaScript errors. Alpha-tested/displacement materials and imported GLB
meshes retain their original shadow path. This measures owned renderer resources;
it is not a JavaScript heap-retainer audit.

The `measureCalibrationFrames` export measures complete requestAnimationFrame
intervals while rendering the same synthetic camera path, including the material
preview. Each route ran Authored → Industrial → Industrial → Authored, with 60
warmup and 240 measured frames per run (2,880 measured frames total):

| Fixed route / preset           | Authored p95, two runs | Industrial p95, two runs |
| ------------------------------ | ---------------------- | ------------------------ |
| Yard 07 moving FPV / Balanced  | 16.7, 16.8 ms          | 16.7, 16.7 ms            |
| Warehouse 02 moving FPV / High | 16.8, 16.8 ms          | 16.7, 16.8 ms            |
| Woodland 06 overview / Low     | 16.7, 16.8 ms          | 16.8, 16.8 ms            |

All twelve runs had a 16.7 ms median, p99 at 16.8 ms, and zero intervals over
25 ms. These runs meet the local frame-cadence comparison; the 60 Hz ceiling
does not quantify remaining GPU headroom. Other devices, GPU timestamps, reduced
motion/contrast options and the broader accessibility matrix remain separate
acceptance work. Read-only `calibrationResources` exposes the counters for repeats.

Thirty-two screenshots covered each environment's first built-in course at both
Low and High, in moving FPV and overview. Review found consistent scenery and
markings, transparent numbered badges without opaque rectangular fringes, and
expected shadow removal at Low. Very wide initial hover volumes in gym/field can
extend beyond the near-view frame; overview labels are appropriately small, so
those images do not establish text readability at every distance. The final bevel
swatch visibly rendered its normal-mapped seams. Static captures do not certify
temporal shimmer or every authored texture alpha edge.

## Explicit imported material bindings

An author can put this plain-data object in a glTF mesh node's
`extras.reveallineTheme`. The GLTF loader maps it to `node.userData.reveallineTheme`:

```json
{
  "format": "SimMaterialBinding.v1",
  "collectionId": "industrial-workshop",
  "revision": "r1",
  "role": "steel"
}
```

The `steel`, `rubber`, `copper`, `concrete`, `enamel`, `timber` and `grass` roles
use the shared material factory only when their exact collection revision is
selected. The binding is bounded to 1 KiB of plain data. Missing UVs, unsupported
roles/versions and inactive collections keep the original material and report a
diagnostic. Unbound nodes remain exact. A multi-primitive glTF mesh node applies
its binding to its own loader-identified primitives; it never propagates into
separate child nodes. Geometry, transforms, names, animation hierarchy and
collision data stay unchanged.

Transparency, alpha-test masks and transmission are protected. An author must
add `"allowTransparencyReplacement": true` to deliberately replace those
materials with an opaque role. Original shared materials/textures are retained
for unbound users and disposed once with their imported scene. Results are
available in `loadScene(...).materialBindings` and renderer resource diagnostics;
the diagnostic list is capped at 128 entries with an omitted count.

In Blender, assign the dictionary to the mesh object's custom property named
`reveallineTheme`, enable **Custom Properties** when exporting glTF/GLB
(`export_extras=True`), and inspect the emitted node extras before intake. This
uses Blender's supported [custom-properties export option](https://docs.blender.org/api/3.6/bpy.ops.export_scene.html),
while keeping the project's pinned Blender version. For example:

```python
bpy.data.objects["ServicePanel"]["reveallineTheme"] = {
    "format": "SimMaterialBinding.v1",
    "collectionId": "industrial-workshop",
    "revision": "r1",
    "role": "steel",
}
```

The generated role textures are already part of the runtime source closure in
`world-visuals.mjs`; no texture URL or decoder is introduced by a binding. Keep
the original admitted PNG/JPEG images embedded in the GLB for authored fallback.
Binding an asset does not relax the existing geometry, image, dependency or
optional-package budgets.

A Chrome World-renderer test loaded an actual five-node GLB with unbound, bound
r1, unavailable r2, protected glass and explicitly approved glass cases. Exactly
two replacements applied in Industrial; none applied in Authored. Ten repeated
loads stayed at 74 renderer geometries, 20 textures and 11 programs; removing the
scene restored the exact gym/racer baseline of 73, 18 and 8. There were no script
errors or context losses. Unit tests additionally preserve material references,
geometry/transforms and transparent originals, check multi-primitive scope, and
verify one disposal per shared resource.

## Studio candidate preview

Asset Studio's SIM preview uses a bounded `ThemeCandidate.v1` handoff to the actual
calibration renderer. Same-tab navigation carries a random key for one temporary
session-storage payload. The shared validator admits only a validated candidate
interface and an exact installed-engine SIM descriptor, including material and
effect roles. No external textures, model URLs or executable style data are
accepted. The receiver consumes the payload once and reports missing, invalid or
expired candidates without applying them.

The page applies the candidate's resolved interface colors, fonts and original
surface textures. The flight uses its pinned SIM collection; changing interface
tokens does not invent replacement 3D materials. A visible status identifies the
workspace revision and SIM dependency, and the existing controls allow isolated
comparison. This path never writes player appearance preferences or course data.

A local Chrome 154 check at 1440×1100 confirmed a custom pink accent and purple
panel in actual computed control/surface styles and an inspected screenshot,
while the scene rendered Industrial r1 with its exact registered effect colors.
The candidate identity survived transfer, the payload was consumed, local storage
was unchanged, and reloading reported the consumed preview instead of reapplying
it. Twelve authored/industrial cycles with two projectiles plus a ghost and trail
kept the same 105 GPU geometries, 19 textures and 9 shader programs at each
Industrial baseline. No JavaScript errors or context loss occurred. This is local
browser evidence, not physical-device certification.

## Future model export

Keep the existing pinned Blender/glTF toolchain and admitted embedded PNG/JPEG
profile. Use inspection, targeted optimization and Khronos validation rather than
generic compression defaults. Protect semantic node names, pivots, rotor sockets,
geometry bounds and transforms. Normal-mapped derivatives require matching tangent
space and UV padding verified at their final mip levels. KTX2, Draco or Meshopt
runtime additions require explicit loader and admission changes.

The simulation's canonical positions are millimetres; render geometry uses metres
and converts once at its boundary. Author glTF at metre scale with +Y up and apply
only the reviewed exporter axis conversion. Keep the drone origin, forward axis,
camera/lens attachment and four independent rotor pivots fixed: existing source
rotor centres are at local X/Z ±0.103 m and Y 0.039 m. Cosmetic bounds tests protect
all three selected drone bodies. Preserve collision IDs, visual semantic roles and
the parent/child relationships needed for rotor animation; scene/model optimization
must not join animated rotor parts into the hull or reinterpret art as colliders.

For authored derivatives, preserve the UV set used for tangent generation, pad
island colors/normals to the final mip footprint, and inspect seam continuity at
near and oblique far views. The procedural calibration texture repeats one source
tile and therefore has no packed UV islands. Its normal specimen checks the data
and renderer path; it does not certify an external Blender mesh's UVs or tangents.

## Eight-family implementation and PR946 compatibility pass

Each family has the complete seven-material surface library, eight semantic model
roles and fourteen effect roles. They share validated geometry and vary surface
patterns, pigment, roughness and metalness. The original Industrial r1 descriptor
and texture recipe remain retained. New collections use their own r1 pins.

| Collection ID         | Distinct surface construction                                                     |
| --------------------- | --------------------------------------------------------------------------------- |
| `industrial-workshop` | Restrained steel seams/rivets, rubber tread, brushed copper and warm enamel       |
| `vyshyvanka`          | Matte dark chassis, woven rubber, red enamel with original ivory diamond stitches |
| `dnipro-porcelain`    | Pale metal, smooth low-metalness ceramic, blue borders and flowing fine marks     |
| `tryzub`              | Navy steel, brass inlay, gold enamel, small geometric chevrons                    |
| `windows-classic`     | Gray molded-plastic bevels/grips, blue label strips, restrained metallic fittings |
| `dos`                 | Indexed block/dither structure and yellow corner glyphs; rough nonmetal surfaces  |
| `orchard-workshop`    | Warm wood grain/seams, canvas weave, cream enamel and stamped leaf-shaped motifs  |
| `neon-ruins`          | Slate metal, broken etched lines, cyan insets and muted violet fittings           |

All recipes are deterministic, 128×128, local procedural source art. The artwork
uses family-specific structure rather than multiplying one common color map by a
tint. Automated tests compare normalized light/dark structure of all eight enamel
maps, test exact role coverage, and build every collection across all eight
original environments while checking course immutability and exterior scenery
bounds. Existing imported GLB policy remains explicit opt-in; no unbound custom
scene is recolored automatically.

Compatible code was adapted from PR946's environment increment `b1bea780a` in the
`fpv-world-framework` worktree: persistent instanced facility marks and numbered
bays, loading zones, ground joints, courtyard borders, stadium lines, and natural
verges/hills outside the full course bounds. These decorations use the selected
collection's material/palette factory, survive replacement of the procedural GLB
fallback, and never add colliders. The renderer also retains two projectile
instance pools (player/other), rendering at most 64 pulses total. Expiring pulses
no longer allocate/dispose meshes every frame. Pools are released with the course.

The PR946 dependency chain was **not** merged: its generated GLB assembly and
`EXT_mesh_gpu_instancing` scenery runtime, six later adventure worlds, separate
PBR-drone/prewarm commits, and articulated actor rig replacement remain outside
this compatibility port. Those changes depend on different generated asset and
renderer predecessors. Existing shared drone/actor bodies and their semantic
material bindings are retained; bounds, replay clocks and the shadow cleanup fix
remain authoritative in this branch.

SIM's independent interface/world controls expose all collections and resolve
Follow game through the shared personal → context → application selection. The
admitted optional launcher may forward only `appearanceFamily` plus
`appearanceRevision`; malformed/duplicate pairs are ignored, unknown valid pins
retain a visible fallback diagnostic, and an explicitly injected host context
wins. Applying the complete game theme clears independent SIM overrides through
`revealline:complete-theme`; first-arm/replay appearance ownership still queues
world changes until a fresh attempt. All eight family pins round-trip through
World v2 profiles and Academy presentation metadata, including unavailable
revision fallback, without modifying the retained proof.

### Local browser verification, eight-family pass

The actual Three.js WebGL renderer completed **192 cases** (8 collections × 8
environments × Low/Balanced/High) in local headless Chrome at 1440×1000, DPR 1,
with friendly/vehicle/drone actors and 64 transient pulses. No JavaScript errors
or context loss occurred during rendering. Eight overview/material screenshots
were inspected: the enamel motifs and model palettes are distinct, active goal
cues stay visible, and the shared model silhouette is preserved.

Six full cycles through all nine appearances (including Authored) returned to the
same measured resource plateau: 143 registered geometries, 88 materials and 31
textures; renderer memory reported 142 geometries, 32 textures and 11 programs.
A further 100 frames with newly identified pulses retained those same resource
counts. Disposal reduced registered resources and renderer geometries to zero
and lost the context; Three's diagnostic counters still reported one internal
texture/program after context disposal, so this is not a claim that every internal
counter becomes zero.

For the fixed container-yard moving view at Balanced, complete animation-frame
p95 intervals were 16.8 ms Industrial and 16.7 ms each for Dnipro, DOS and Neon
(30 warmup, 120 samples per run, including the calibration material viewport).
This checks local frame scheduling and resource behavior, not GPU timestamps,
mobile-device certification or a broad performance guarantee. Evidence is saved
in `docs/verification/eight-theme-sim-2026-10-02.json`; screenshots were captured
under `/tmp/sim-eight-themes-audit/` on the verification machine.
