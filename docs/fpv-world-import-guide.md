# Import a world: player guide and free-resource shortlist

Reviewed 14 October 2026. The Workshop now includes this workflow and 23 clickable
resource candidates, in English and Ukrainian. This is a **source-resource
shortlist**, not a claim that 23 new playable worlds have been installed or tested.
For finished simulator content, start with **Library**.

## Import in six steps

1. **Download and unzip a scene.** Prefer one self-contained `.glb`. A `.gltf`
   needs every referenced `.bin` and PNG/JPEG image, with its original directory
   structure. A kit of individual buildings is not a whole world: assemble a
   selection first. Do not select multiple GLBs at once.
2. **Convert if needed.** In [Blender](https://www.blender.org/download/), open
   `.blend` or import FBX/OBJ, then **File → Export → glTF 2.0 → glTF Binary
   (.glb)**. Use PNG/JPEG images, no Draco compression, and include custom
   properties when exporting gameplay markers. Bake procedural materials to
   image textures; check the exported result because Blender shaders do not all
   translate to glTF. Keep your original source file.
   [Blender exporter manual](https://docs.blender.org/manual/en/4.5/addons/import_export/scene_gltf2.html).
   In [Crocotile](https://www.crocotile3d.com/howto.html#exporting), use **File →
   Export Scene**, select GLB and include textures. Exporting requires an
   activated license; Blender is the free alternative.
3. **Record provenance before importing.** Enter Asset author, original Source
   URL and the actual License. This profile offers CC0, CC BY 4.0 and Original
   work. Do not label someone else's work Original or pick CC0 for unknown rights.
   Retain license files and attribution; for CC BY record modifications too.
4. **Choose the files in Workshop → Import a world.** Use **Choose scene files**
   for one GLB or a flat glTF resource set. Use **Choose scene folder** for a scene
   with nested textures. Choose the subfolder containing only one model entry,
   not the complete downloaded collection. If folder selection is unavailable
   on your device, export a self-contained GLB on a desktop first.
5. **Read the report → Preview world → Test flight.** Add a safe spawn, simplified
   collision geometry and route objectives. Display meshes do **not** generate
   collision automatically. Without authored markers, the importer creates a
   starter hold/landing route; it does not infer a route through scenery. Check
   scale, visible surfaces, bounds, landing pads and both flight modes. The
   [authoring guide](../authoring/fpv-worlds/README.md) explains `extras.rl`
   markers, the pinned Blender exporter and offline preparation tool. Browser
   import is an entry point, not a universal scene-to-game converter.
6. **Save before leaving.** Export editable project for a portable backup;
   Install pack stores it in this browser. Export world pack to share, then
   recipients use Library → Import .rlpack / editable project. Export again
   after changes. Back up your draft before **Start a new world**: importing into
   an existing imported project starts reimport review. Keep stable source IDs
   for intentional updates and read conflict previews.

Example folder (select `courtyard`, preserving its subfolder):

```text
courtyard/
  courtyard.gltf
  courtyard.bin
  textures/
    brick.png
    metal.jpg
```

## Troubleshooting and current limits

| Symptom | What to do |
|---|---|
| Missing local resource | Preserve paths/case and include the `.bin` and images; use folder selection or self-contained GLB. Remote URLs and data URIs are not fetched. |
| More than one model | Choose one scene, not a folder with many GLBs or alternate exports. |
| Unsupported required extension / Draco / KTX2 | Re-export uncompressed geometry with PNG/JPEG; use the pinned offline preparation recipe where supported. |
| Model exceeds budget | Reduce image resolution, remove unused assets, simplify distant geometry and export a smaller scene. |
| Can fly through walls | Author simplified collider markers; render meshes are not collision geometry. |
| Wrong start or unreachable scenery | Author spawn/route markers and adjust course bounds; the starter route does not fit every scene. |
| Changes disappear | Export a backup and Install pack again after edits; loading a project alone does not save subsequent edits. |

The current browser profile caps the final model at **16 MiB**, supplied files at
128, nodes at 2,048 and images at 64. Images are PNG/JPEG, at most 4,096 pixels per
dimension and 32 million aggregate source pixels. The editable/runtime pack
ceiling is separately 64 MiB. These are importer limits, not the core game's
72 MiB offline budget. A file passing byte limits can still need performance
optimization. This guide does not change any limits.

## Review shortlist: 23 resources

All listed publishers/pages advertise **CC0** for the assets. Source pages were
reviewed; individual archives have not been downloaded, converted or performance
qualified in this change. Archive contents and their supplied licenses must be
recorded when a candidate is selected. No third-party preview images are copied.
Priorities and proposed flight uses below are our assessment, not publisher claims.

**Recommended order:** construction site for a small complete import, an industrial
kit route for efficient reusable scenery, then a carefully reduced Hidden Alley
or Pine Forest scene as the realism benchmark. Do not ship all heavy scenes at once.

### Assembled scene candidates

These provide layouts; they still need conversion, collision, routes and validation.
Poly Haven scene downloads are linked from their collection pages. Select Blender
scene files rather than Unreal projects. A sky/HDRI is lighting, not flyable geometry.

| Candidate / download page | Preparation | Proposed FPV use / priority |
|---|---|---|
| [House Construction Site — Majadroid](https://opengameart.org/content/3d-house-construction-site-lowpoly-cc0) | Publisher provides assembled and separate Blender/FBX objects; export GLB | **P1:** floors, cranes and precision gaps; best first small scene |
| [The Hidden Alley](https://polyhaven.com/collections/hidden_alley) | Blender scene; reduce geometry/textures | **P1 art benchmark:** close urban lines |
| [Pine Forest](https://polyhaven.com/collections/pine_forest) | Blender scene; thin vegetation and simplify colliders | **P1 art benchmark:** tree slalom, clearings |
| [The Shed](https://polyhaven.com/collections/the_shed) | Blender scene; select props and reduce textures | **P2:** compact precision course; verify useful clearances |
| [A Verdant Trail](https://polyhaven.com/collections/verdant_trail) | Blender scene; optimize terrain and vegetation | **P2:** terrain-following route |
| [Namaqualand](https://polyhaven.com/collections/namaqualand) | Blender scene; reduce plant density and texture footprint | **P3:** open landscape exploration |
| [Lunar Landscape](https://polyhaven.com/collections/moon) | Scene conversion and texture reduction | **P3:** distinctive rocky terrain; visual theme only, no promised lunar physics |

Poly Haven permits reuse and redistribution under its [CC0 asset license](https://polyhaven.com/license).

### Modular scenery kits: build a layout first

For Kenney packs choose the included 3D format supported by your authoring tool;
GLB availability is not assumed for every archive revision. Import selected models
into Blender, assemble a route-friendly layout and export **one** GLB. These are
not ready-to-fly maps. Each linked pack page lists CC0.

| Resource | Proposed world / priority |
|---|---|
| [City Kit Industrial](https://kenney.nl/assets/city-kit-industrial) | **P1:** factory yard, roof gaps, energy infrastructure |
| [City Kit Suburban](https://kenney.nl/assets/city-kit-suburban) | **P1:** neighbourhood circuit |
| [City Kit Commercial](https://kenney.nl/assets/city-kit-commercial) | **P1:** rooftop and street route |
| [City Kit Roads](https://kenney.nl/assets/city-kit-roads) | **P1 support:** readable streets joining the city kits |
| [Nature Kit](https://kenney.nl/assets/nature-kit) | **P1 support:** lightweight wooded routes |
| [Racing Kit](https://kenney.nl/assets/racing-kit) | **P1:** readable race layout and barriers |
| [Castle Kit](https://kenney.nl/assets/castle-kit) | **P2:** battlements and courtyard gaps |
| [Pirate Kit](https://kenney.nl/assets/pirate-kit) | **P2:** harbour/island circuit |
| [Space Station Kit](https://kenney.nl/assets/space-station-kit) | **P2:** indoor corridor route |
| [Modular Dungeon Kit](https://kenney.nl/assets/modular-dungeon-kit) | **P2:** carefully widened indoor maze |
| [Modular Cave Kit](https://kenney.nl/assets/modular-cave-kit) | **P2:** tunnels with clear exits |
| [Mini Forest](https://kenney.nl/assets/mini-forest) | **P2:** compact stylized training environment |
| [Mini Skate](https://kenney.nl/assets/mini-skate) | **P2:** low-altitude ramp and rail lines |
| [Survival Kit](https://kenney.nl/assets/survival-kit) | **P2:** camp and woodland props |
| [Platformer Kit](https://kenney.nl/assets/platformer-kit) | **P3:** playful floating obstacle course |
| [The Smuggler’s Cove — Poly Haven](https://polyhaven.com/collections/smugglers_cove) | **P3:** nautical collection; assemble models in Blender. Listed Unreal project cannot be imported directly. |

## Other libraries: review each asset rather than trusting “free”

- [Quaternius's current license](https://quaternius.com/license.html) allows use in
  completed products but restricts redistribution as standalone assets/packs.
  Do not classify all new downloads as CC0 or include them in editable world
  packs without checking the exact grant. Earlier obtained CC0 files require
  retained evidence for that version. Not included in the 23 candidates above.
- [Sketchfab downloadable models](https://sketchfab.com/features/free-3d-models)
  and [Poly Pizza](https://poly.pizza/) are further discovery sources, not
  blanket-approved catalogs. Check the individual author, license and actual
  downloadable files; avoid NC, ND or editorial restrictions for this pipeline.
- [ambientCG](https://ambientcg.com/) provides useful material/lighting resources;
  textures alone are not a world. Verify each selected resource before inclusion.

## Delivery and next decisions

Implemented: bilingual collapsible Workshop guide, 23 resource links grouped by
preparation, exporter/marker help, backups, troubleshooting and license guidance.
No scene bytes, physics, course IDs, recordings or package limits changed.

Remaining per selected candidate: retain archive/license/hash; convert and optimize;
author spawn, collision, bounds and courses; verify both modes and recordings;
measure mobile/desktop rendering and loading/unloading; package and qualify for
Library delivery. These are separate content increments after shortlist review.

## Verification for this increment

- Source browser: desktop 1280×720, portrait 390×844 and landscape 844×390;
  EN/UK guide text, six steps, both native disclosures, keyboard focus through
  resource links, no horizontal document/guide overflow, no console warnings/errors.
  Outbound links carry HTTPS, `_blank`, `noopener noreferrer`; the in-app browser
  did not expose a new tab after the test click, so external-tab launch is not
  claimed as verified on that host. Source websites were separately read.
- All three package preflights pass. Worlds: 122 files, 16,834,200 offline bytes,
  within unchanged 128-file/20-MiB limits. These are preflight results, not release
  admission. Guide and links add no runtime file slots or third-party asset bytes.
- Existing optional-FPV package regression suite: 9/9 pass. The initial sparse
  checkout lacked a motion-lab dependency; restored the tracked dependency and
  reran successfully. No new unit coverage added.
- Source-extracted navigation guard: 11 checks pass, including rejection of
  remote scripts/styles/images, HTTP, unsafe schemes, credentials, download and
  ping attributes. Explicit isolated HTTPS anchors are navigation only.
- Scoped lint, syntax, diff whitespace and shared shell/presentation projection
  checks pass. Full reproducible admission/offline-install qualification remains
  for CI; local disk is below the 3-GiB qualification floor. No new asset import,
  physical-device performance or live deployment claim.
