# FPV environment art and rendering pass

2 October 2026. Focused R5 increment after the guided-radio feature. The eight
existing worlds receive distinct surface and scenery treatment; this does not
create additional challenge identities or claim photoreal production-art acceptance.

## Implemented presentation

| Environment         | Changes                                                                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Training hangar     | Concrete scale, floor joints, service bays and bay numbers; different concrete/metal obstacle surfaces.                                             |
| Meadow              | Irregular grass texture replaces diagonal striping; peripheral walking verge and distant terrain add depth.                                         |
| Woodland            | Asymmetric, varied-height tree clusters, persistent terrain and timber obstacle surfaces.                                                           |
| Ukrainian courtyard | Paving, plaster/brick/timber surfaces, flush window/plinth details and varied low-rise skyline. An inspired setting, not a regional reconstruction. |
| Warehouse           | Coherent concrete/metal surfaces, loading bays, pallets and an asymmetric exterior loading area; pixel sampling remains crisp.                      |
| Stadium             | Asphalt, perimeter track markings, retained bleachers and a single pavilion replacing four identical streetscapes.                                  |
| Container yard      | More varied stacked containers, corrugated surfaces, labels, loading zones and industrial landmarks.                                                |
| Parking garage      | Concrete floor joints, numbered parking bays, column accents and a distinct distant urban edge.                                                     |

Obstacle geometry, gate apertures, visibility distances, collision, physics and
recording identities remain unchanged. Added solid landscape dressing stays
outside the full flight bounds, including large school arenas. Floor markings
are flush. Persistent detail survives installed scenery replacing procedural
fallbacks. Cosmetic quality details do not remove gameplay silhouettes.

Actors now have articulated limbs, recognizable vehicles, wheel/hub/window detail
and shared drone models. Theme asset slots influence gate materials and actor
appearances. Actor quality updates when the preset changes. Presentation follows
simulation ticks and does not advance actors, write input or change scoring.

## Cost and ownership

The existing Performance/Balanced/Quality settings retain their DPR, shadow and
texture bounds. Existing Kenney CC0 models are reused; no external texture fetch,
new runtime decoder or additional runtime file is required. Original procedural
surface maps supply grass, concrete, asphalt, paving, plaster, timber and metal.
Resource owners and disposal remain explicit.

The closed built-in GLB assembly groups repeated static opaque/masked models by
mesh and perimeter side through `EXT_mesh_gpu_instancing`, already supported by
the pinned GLTFLoader. Alpha-blended models retain individual sorting. Arbitrary
creator imports keep their hierarchy, IDs and animation targets. The source
library and its license/provenance are retained unchanged; only layout and
instance assembly change. Two bounded projectile batches replace per-shot
geometry/material churn. The current 64-active-projectile limit remains.

## Research and integration decisions

Landmark composition, consistent surface scale and legible flight paths lead the
pass. VelociDrone's official manual is a reference for optional route guidance
and restrained costly video effects, not a source of reusable maps.
[VelociDrone manual](https://www.velocidrone.com/desktop_manual).

Repeated props share draw calls as recommended by Three.js. Spatial groups retain
useful culling; the glTF extension is used only for the known static library.
[Three.js InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html),
[glTF instancing specification](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Vendor/EXT_mesh_gpu_instancing/README.md).

Existing [Kenney Industrial](https://kenney.nl/assets/city-kit-industrial) and
[Retro Urban](https://kenney.nl/assets/retro-urban-kit) CC0 sources remain the
shipped asset basis. Selected scanned plaster/paving resources from
[Poly Haven](https://polyhaven.com/license) or [ambientCG](https://docs.ambientcg.com/license/)
remain candidates for later artist-led work; none is falsely reported as shipped.

The user-authorized Themes coordination targets the separate **🔥 Themes** chat.
Its Industrial Workshop work in the primary checkout remains untouched. Its
`ThemeFamily`, `SimVisualCollection`, semantic material/effect roles and appearance
session contracts are the integration authority for that separate feature. This
branch does not add a competing theme selector or change theme storage.

Integration handoff: merge the environment composition and role-map changes in
`world-visuals.mjs` into the theme-owned material factory; preserve that branch's
`createWorkshopMaterials`, `applySimMaterialBindings`, `ownedSimMaterials` and
appearance resolution. Retain exact collider geometry, scene disposal and shader
preparation in `renderer.mjs`. `scenery-runtime.template.mjs` plus generated
`world-assets.mjs` own trusted scenery batching. Industrial assets and palette
ownership remain with Themes. Do not replace either branch's files wholesale.

## Verification and remaining acceptance

Functional browser comparison, source-bound package receipts and publication
status are appended after qualification. Extra unit coverage remains deferred to
R7. Browser rendering diagnostics are not sustained FPS/GPU-memory qualification
on an iPhone, Steam Deck or named integrated GPU. Physical-device measurements,
novice readability sessions, shared-theme integration and final artist acceptance
remain outstanding.

The actual-WebGL actor fixture passes 10/10 checks: all20 actors rebuild across
quality changes, repeated and backward-seek snapshots stay stable, five complete
64-projectile turnover cycles retain fixed resources, course replacement clears
pools and disposal releases all registered resources. These are controlled
presentation snapshots, not an authoritative gameplay or hardware-performance
claim. The shared-Three geometry/material probe passes43/43 checks across eight
worlds, larger and elevated bounds. Six prepared GLBs have zero validator errors
or warnings; the validator does not validate the instancing extension, so the
pinned-loader browser run is required separately.
