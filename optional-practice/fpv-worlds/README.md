# FPV World Studio

Open `optional-practice/fpv-worlds/index.html` through the project development
server (`npm run dev`). The existing simulator also offers **World Studio** when
opened from the main game or a local development server.

This is the implementation workstream for the revised FPV plan. It includes an
open 60-challenge catalogue, eight procedural environments, personal playlists,
three new campaign styles, three visual drone variants, the imported-world
runtime and portable authoring tools. The original 12 Academy courses remain
on the original simulation and proof format; new courses use `FlightCourse.v2`
and `FlightAttempt.v2`. New course definitions are playable development content;
their presence does not certify human playthroughs, medal calibration or the
120-demonstration release milestone.

## Play and create

- Choose a collection, filter challenges and fly any installed challenge.
- Add challenges to a personal playlist, reorder/repeat them and share its JSON.
  References bind exact pack revisions. A missing revision remains unavailable.
- Keep the selected flight mode, controller, response settings and drone
  appearance between playlist entries. The appearance does not change handling.
- Copy a route in **Create**, edit objective positions, reorder its steps, undo,
  inspect the JSON and test it. Imported assets never supply executable scripts.
- Import a GLB or a glTF with its local PNG/JPEG textures and buffers. Include
  source/author/license information. Scene geometry needs separately authored
  collision and gameplay metadata before it becomes a complete challenge.
- Export a compiled `.rlpack` or editable `.zip`; install packs through
  **World packs**. The editable ZIP profile is intentionally limited to STORE
  entries produced by the supplied exporter.

See [the authoring guide](../../authoring/fpv-worlds/README.md) for the Blender
starter/exporter, `extras.rl` stable IDs, preparation CLI, compression conversion,
reimport ownership and exact supported format limits.

## Runtime and records

Three.js 0.186.1 renders both runtimes. Rapier 0.21.0 is admitted separately for
new-world collision, swept queries and kinematic actor movement. The original
50 Hz flight integration remains in use. V2 records the exact consumed
quantized axes plus fire actions and verifies the final simulation identity.
Interrupted V2 sessions recover by replaying the saved command prefix and
resume paused. Focus loss, reconnect and stalls clear firing state.

World pack installation is a validated IndexedDB transaction. Proof backups
retain course data and unresolved evidence; imported verification labels are
recomputed locally. Browser storage can be evicted, so keep exported backups.
World assets and the executable application are separate installations. A pack
in IndexedDB alone is not proof that the application can start offline.

The original package keeps its 8 MiB / 64-file policy. `fpv-worlds` has a separate
16 MiB / 96-file executable allowance, including the pinned JS/WASM dependency.
It remains outside the main game's mandatory offline cache. Generated builds
provide an exact-byte worker; the raw source preview has no generated worker.
Vendor provenance and licenses accompany the executable closure. The bundled scenery includes original procedural artwork and selected Kenney
CC0 assets with source hashes and licenses. No network asset download is needed
while playing.

## Qualification status

Focused runtime, content pipeline, library and legacy compatibility tests are
part of this change. This does not restore or satisfy the repository-wide
release gate, which is currently waived by `publishing/test-policy.json`.

Remaining release work includes the full set of mode-specific demonstrations,
unfamiliar-player and medal tuning, external asset curation/art polish, measured
desktop/mobile performance budgets, controller/browser qualification, broader
creator usability studies and the final content/backup/recovery acceptance matrix.
Refer to [implementation status](../../docs/fpv-worlds-implementation.md).

## Shared game interface assets

The simulator's game shell uses the main game's Field Kit tokens and semantic
icons, Exo 2 and Departure Mono fonts, FPV / LINE wordmark and three short menu
cues. Shared font notices, selected sound sources and the exact-byte refresh
command accompany the bundled `../civilian-fpv/README.md`. The original main-game
font and sound bytes are embedded in `sim-presentation.mjs` to preserve the
legacy package's source-file limit.

The home screen additionally reuses the main game's original FPV hangar artwork:
`game/ui/art/menu-scenes/fpv.webp` (514,190 bytes; SHA-256
`19f43cb1602e59a692d416d36d715e664765eecc24784b3b3e6516651c53df45`) and
`fpv-portrait.webp` (482,136 bytes; SHA-256
`3d651795fa7623b0200fadaed05a1127109a9c9c6cbd44d183a92a8e12c2ee24`).
These are lossless WebP preparations of the project's original generated
landscape and portrait hangar art; source and processing records are retained in
`game/ui/art/menu-scenes/provenance.json`. Art is decorative and never changes
flight visibility, collision, objective geometry or replay behavior.
