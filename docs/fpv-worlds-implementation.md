# FPV World Studio — implementation and player qualification

Current continuation: **3 October 2026**, branch `codex/fpv-optional-mode-examples`.
The catalogue has **14 worlds / 172 authored challenges**: the original 60,
58 school lessons, 30 World Adventures and 24 Snake Hunt challenges. All 120
original mode-specific recordings plus 58 recommended-mode school examples are
installed. Fourteen additional Self-level foundation recordings ship as an
optional archive in PR #979; they do not increase the default installed count.
Content, reimport, ghosts, section practice, continuous learning, control/mobile
improvements and Hangar/Meadow/Courtyard/Woodland/Warehouse refinements are merged,
as are section replay #972, Follow/Observe editing #975 and pack recovery #977.
See [the current delivery plan](fpv-reviewed-delivery-plan.md) and
[delivery log](fpv-continuous-delivery.md) for exact qualification and publication.

Player-feedback sessions no longer block implementation at the owner's request.
Physical-device, novice-player and broader production-art acceptance remain
pending, separately from functional qualification. Historical tables below record
the original 30 September framework baseline, not current catalogue counts.

The current workstream prioritizes functioning features and direct player
verification. **Additional unit-test coverage is deferred to the final phase**
at the user's request. Build checks, browser walkthroughs, replay verification
and import/export round trips continue throughout implementation.

## Delivered application structure

| Area           | Implementation                                                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Entry          | `optional-practice/fpv-worlds/index.html`, separately packaged from Academy                                                        |
| Catalogue      | 60 open challenges: original 12 plus 48 authored routes/tasks in six additional worlds                                             |
| Collections    | Academy, Ukrainian Horizons, Pixel Circuit, Field Operations; no unlock gates                                                      |
| Worlds         | Hangar, meadow, woodland, courtyard, warehouse, stadium, container yard, garage with ramp and upper deck                           |
| Playlists      | Add/repeat/reorder/remove, save/share, exact pack revision references, next-entry bookmark                                         |
| Creator        | Live 3D selection and translation, snapping, numeric editing, route ordering, undo/redo, theme preview and flight preview          |
| Content layers | `World.v1`, `CourseLayout.v1`, `Challenge.v1`; stable objective IDs and source bindings compiled by the FPV adapter                |
| Themes         | Versioned palettes, filtering, drone, character/asset roles, UI and audio profiles; base → campaign → world → challenge resolution |
| Imports        | Bounded GLB/glTF with closed local resources, semantic extraction before optimization, source ownership and reimport diagnostics   |
| Sharing        | Compiled `.rlpack`, editable STORE ZIP, playlist JSON and proof archive parts                                                      |
| Collision      | Rapier swept queries, contact handling, support surfaces, slopes and character-controller routes                                   |
| Actors         | Authored drone, ground, sentry, vehicle and hazard movement; fictional pulse encounters                                            |
| Controls       | Existing keyboard/touch/radio calibration and response handling, explicit action release after pauses                              |
| Recording      | Quantized five-component V2 commands; replay verification; interrupted prefix recovery resumes paused                              |
| Records        | Local evidence, replay, best compatible line, provisional medals/sectors, unscored checkpoint practice                             |
| Storage        | Transactional installs, retained exact revisions and rollback, backups, independent proof retention                                |
| Presentation   | PBR procedural surfaces, landmarks, detailed visual quads, imported scenery, optional motor/ambience/action audio                  |

The catalogue count describes authored definitions available in the application.
It does **not** certify 60 polished production levels or 120 successful
mode-specific demonstrations. Medal targets are initial playtest tuning.

## Authoring contracts

`inspectImport → resolveProject → compilePlayable → preparePack → installPack`

An editable project may carry `definitions.worlds`, `definitions.layouts` and
`definitions.challenges`. The compiler resolves their exact references to
runtime courses. Layout objectives have stable IDs and independent mode order.
Changing the shared world can update multiple layouts without duplicating the
scenery. Blender owns geometry and semantic source anchors; local authoring
overrides are explicit. Removed anchors are diagnosed rather than guessed.

Runtime scenes are GLB/glTF 2.0. The browser profile accepts local PNG/JPEG
textures, bounded skins/animation and explicit collider markers. It rejects
network dependencies, scripts and unsupported extensions. FBX/OBJ/Blend require
external normalization. Compressed geometry can be normalized using the pinned
offline toolchain. Tiled/LDtk/TrenchBroom and native engine scenes remain outside
the release importer profile, as specified in the approved plan.

Editable ZIP currently accepts STORE entries from the supplied exporter; it is
not a universal ZIP importer. Browser imports are capped at 16 MiB per model;
prepared world packs at 64 MiB, below the plan's 256 MiB outer archive ceiling.
The executable World Studio application has a separate 16 MiB / 104-file
allowance. Academy has an 8 MiB / 72-file allowance; civilian flight remains
8 MiB / 64 files.

See [authoring instructions](../authoring/fpv-worlds/README.md), including pinned
glTF Transform and Khronos tools, Blender exporter and original starter fixture.

## Concrete verification so far

- Chromium: all eight environments render, all 60 catalogue entries appear,
  flight arm/pause/retry works, keyboard throttle lifts the drone, English and
  Ukrainian views work, and playlists persist.
- Chromium creator: dragging a gate/volume handle changes the route; Undo restores
  its exact previous coordinates; numeric editing and theme preview work.
- Repeated renderer course/quality changes released owned geometry/material/
  texture resources. Animated skinned GLB import and transform attachment worked.
- Safari Technology Preview: live flight, playlist persistence, sound controls,
  exported proof and interrupted-flight recovery were exercised.
- An actual 680-frame Safari recording replayed in Node with the same final
  identity. This is concrete cross-runtime evidence for one attempt, not a
  universal determinism or controller qualification claim.
- The garage ramp and elevated deck produce the intended support heights;
  an uncontrolled hard landing correctly fails the landing-speed criterion.
- The generated standalone application prepared its verified worker, reloaded
  offline with 60 challenges, loaded licensed scenery, flew and opened the
  hangar with zero JavaScript errors or failed requests.
- Mobile viewport checks at 390×844 covered touch flight, layout overflow and
  repeated Racer/Pixel/Utility hangar previews. These were emulated viewport
  checks, not performance measurements on a named physical mobile device.
- A controlled browser radio walkthrough used the actual setup UI: OFF→ON arms,
  held ON after pause/blur stays paused, and a deliberate OFF→ON resumes.
- A real exported recording round-tripped through SHA-256 archive parts; modified
  bytes were rejected and imported verification trust was reset pending replay.
- Both optional application dependency closures build within their limits.
  Vendor files are hashed and licensed; additional scenery has asset provenance.
- Before the user's unit-test deferral, focused legacy checks passed, including
  the original 24 demonstration proofs and reward thresholds. New tests already
  written remain in the tree for the final qualification phase.

## Player verification sequence

1. Open the catalogue and fly a new-world orientation in Self-level, then Acro.
   Change controls, pause with a held key, resume and confirm deliberate pickup.
2. Fly racing, precision, hazard and fictional combat challenges. Report unclear
   objectives, contacts that look wrong, unreadable targets and unsuitable medals.
3. Build and export a playlist, reopen it in a clean profile, and continue it.
4. Create a route copy, drag objectives, place actors, change theme, test and
   export/install it. Reopen its editable project and keep working.
5. Import the starter GLB, change it externally and reimport. Check additions,
   deletions and retained local overrides before installing an update.
6. Install two revisions of one world. Verify rollback and an older playlist's
   exact revision. Export records, remove the pack, retain unresolved evidence,
   reinstall dependencies and verify again.
7. Interrupt an active flight, reopen the application, recover paused and finish.
   Export the result and verify replay on another supported browser.
8. Prepare a generated application offline, disconnect the network and reopen
   it. Importing a world alone does not install executable application files.

## Final phase: qualification and remaining production work

The remaining release gate includes all requested unit coverage, browser/storage
failure scenarios, exact dependency and archive limits, rollback/retention,
shared-prefab propagation, controller reconnect coverage, full EN/UK review and
the original legacy fixtures. Restore the repository's required test policy
through its reviewed process before describing a build as release-qualified.

The original 120 mode-specific demonstrations are complete. Deliver alternate
school-mode and optional Adventure examples; review routes with unfamiliar
players when sessions become available, tune medals separately per mode,
complete environmental art and animation polish, and measure sustained rendering
and memory on named desktop/mobile reference devices. The 60/30 fps targets are
targets until those measurements exist. No hardware baseline or ETA is inferred
from a fast local browser walkthrough.

The approved October continuation and remaining 8–10-week workstream are recorded
in [`fpv-reviewed-delivery-plan.md`](fpv-reviewed-delivery-plan.md). The estimates
there replace the old remaining-work baseline. Its R7 keeps additional unit
coverage last while requiring functional verification in every phase.

The original 22–26 working-week production estimate remains a historical baseline
for two developers, an environment artist and regular QA. This implementation
accelerates the functional workstream; it does not erase content-production and
human qualification work or establish a new completion date.

## Build and open

```sh
npm run fpv:playtest
node scripts/game-cli.mjs serve --port 8789
```

Open `http://127.0.0.1:8789/dist/fpv-worlds-playtest/`. The generated folder includes
`fpv-worlds-playtest.zip`, an exact build receipt and the separately installable
application. The development server must stay running for online localhost use;
preparing the generated application offline permits subsequent offline reloads.

Scenery attribution and original files are retained in
`authoring/fpv-worlds/assets/kenney`; runtime license/provenance files are shipped
with the package. Sources: [Kenney Industrial Kit](https://kenney.nl/assets/city-kit-industrial)
and [Kenney Retro Urban Kit](https://opengameart.org/content/retro-urban-kit).

## 2 October handheld/controller update

Both hosts now prioritize the FPV viewport on phones and handheld dimensions;
secondary controls live in a paused menu. Standard browser controllers supply
flight axes, Arm, Reset, Pause and combat Fire, with exclusive menu/radio ownership.
The isolated learning lab supports controller takeover. Functional receipts and
research are in [Handheld flight](fpv-handheld-flight.md). Physical device and
sustained performance qualification remain in R7; additional unit coverage stays
deferred. The next focused increment adds FPV SIM after Solo/Versus/Team.
