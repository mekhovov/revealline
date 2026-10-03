# Courtyard closed house facades

This D2 increment gives the two blank houses inside the Ukrainian Courtyard a
readable civilian scale. Framed opaque windows, closed paneled timber doors,
plinth and roof-edge bands, and an original blue/cream geometric entrance border
sit flush on the existing solids. It complements the exterior street-front
terraces from #961. It does not represent open doors, recesses or flyable windows.

## Scope and ownership

Only `house-west` (8 × 8 × 20 m) and `house-east` (8 × 7 × 26 m) in the
`courtyard` environment receive artwork. The geometry helper rejects renamed,
resized, typed and unsupported obstacles. Every added vertex lies on one of the
original vertical box faces. Existing obstacle meshes, roof silhouettes, garden
wall, well, school obstacles, routes, actors, cameras and physics remain exact.
No external asset, texture image, network request, licence or package file is added.
The artwork is original local procedural geometry.

The two houses share six facade batches: 3,984 non-indexed vertices / 1,328
triangles in every quality preset. They are opaque and receive shadows but add
no shadow casters. Deterministic polygon-offset layers separate closed panes,
frames and door details without moving any surface into a flight opening. The
strict order is plinth/roof 1, closed door 2, accent 3, opaque pane 4 and trim 5;
manual near-wall rays also verify the intended frontmost finish at overlapping
plinth/door, panel line, pane and mullion samples.
World-space UVs use the existing Themes material roles. Materials and shared
maps remain owned by the world and are released once on course disposal.
Pixel retains its previous simple blocks and receives no facade batches.
Authored finishes use untextured materials; shared Themes reuse the material kit.
This is a bounded world-art increment, not a finished-world or device-FPS claim.

## Functional qualification

Baseline: `2dbbe0a0f26684eae0a2bdb0b7cbda087627457f` (merged Garage #1009).
The candidate runtime is identified independently by the SHA-256 in the CPU and
frozen browser receipts; the CPU receipt's Git head records the checkout head before evidence capture.
The manual qualifier passes 949 checks across 171 scene cases and checks all 11
associated catalogue courses, three bounds,
three presets, authored/Pixel/all 17 shared collections, exact existing geometry,
UVs, transforms and material pixels, outward-facing wall coplanarity, canonical
ID/dimension scope, wall ray distances and exactly-once disposal. Other 13
worlds retain their baseline scene/material snapshots. All 19 installed Courtyard
recordings replay successfully, retaining exact final World state identities.
Every retained optional-FPV JavaScript/WebAssembly input is byte-identical to the
baseline except the intentionally edited visual module.

Full `npm run validate`, scoped ESLint/Prettier and the existing 30 workshop,
texture and acceptance-workflow checks pass under Node 22.22.2. These are existing
functional checks; no new unit coverage is added before D6.

Source before/after browser fixture: `dist/fpv-courtyard-facades-verification-source-v2`.
The frozen fixture records its own full module/hash inventory and uses the actual
flight renderer and imported GLB scenery. Source/package browser observations,
package admissions and actual-player acceptance are pending at this source checkpoint.
Human/physical-device performance and final artist acceptance remain open.

The first all-package admission at source checkpoint `70d05b34f` stopped at the
existing byte limit and wrote no candidate directory. Limits were not changed.
A separate reviewed source-size repair is required before package qualification.
Authored scene ownership rises by six geometries and 12 materials with no new
textures; Industrial Workshop rises by six geometries, nine materials and one
existing timber-role map. Pixel counts are exact. These are CPU ownership counts,
not measured GPU/frame-time claims.
