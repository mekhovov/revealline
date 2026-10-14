# Large authored FPV regions — active delivery plan

Reviewed 14 October 2026 against main `595421060c718295611a8441fbe8dba1c3da88e4`.
The user selected default catalogue visibility, download on Play, optional offline
storage, and authored regions first. Generation assists authoring; endless runtime
terrain is deferred. Twelve proposed regions are design targets, not shipped maps.

## Current state and priorities

- **Completed before this increment:** 19 optional Library worlds; sixteen CC0
  practice layouts plus Reservoir, Festival and Harbor. Camera access, shared paused
  setup, radio View, stick comfort and Watch/Try/Repeat are merged in stack #1180.
  Integrated recovery/Creator reliability PR #1193 merged. Physical hardware and
  current public deployment acceptance remain separate from implementation.
- **P0, in progress:** default catalogue discovery, Play/download/disarmed launch,
  bounded pagination, and exact asset-source intake. This makes existing maps easier
  to reach and allows more maps without a larger core download.
- **P1, in progress:** separate regional manifest and bounded residency planning.
  Existing World coordinates stop at ±100 m. Real regional flight additionally
  needs terrain/collision streaming, origin shifting, render preparation and recovery.
  Authoring validation alone does not deliver huge playable maps.
- **P2:** Canyon Badlands and Urban Bando District establish terrain and architecture
  quality. No default catalogue row before collision, flight and package qualification.
- **P3:** Tropical Archipelago, Industrial Railway Valley, Coaster Park, Hillside Town;
  then Alpine Highlands, Desert Expedition, Canal City; then Lunar Basin, Castle
  Valley, Retro Metropolis. Expand Reservoir, Harbor and Festival with new revisions,
  keeping old courses and proofs. These are distinct authored regions, not recolours.
- **P4:** catalogue-wide/offline/performance qualification and protected publication.
  D6 extra unit coverage follows; each preceding increment retains functional checks.

Target dimensions: dense regions 4×4 km, natural regions 8×8 km, Desert Expedition
16×16 km. These targets require verification; they are not present runtime claims.
Each region needs six distinct districts, twelve landmarks, multiple safe spawns,
beginner/intermediate/advanced routes, optional activities and uninterrupted free
flight. Interesting scenery must be reachable, with visual/collision agreement.
Save favourite locations, make navigation optional, keep the flight HUD quiet.

## Research refinements

[VelociDrone Mobile's manual](https://www.velocidrone.com/mobile_manual) demonstrates
scenery/track filtering, download-on-flight and explicit offline status. Its mobile
scenes use simplified artwork to preserve performance. Adopt shared navigable
geometry with device-appropriate decoration, visible download state and opt-in
storage. Do not adopt automatic removal of players' saved projects or recordings.
[Its scenery catalogue](https://www.velocidrone.com/scenery?dlc=20) groups industrial,
construction, drift, island and valley experiences. This reinforces distinct flight
activities rather than increasing area with repeated props.

[TRYP](https://store.steampowered.com/app/1881200/TRYP_FPV__The_Drone_Racer_Simulator/)
provides varied scenic/scenario flying; [Uncrashed](https://store.steampowered.com/app/1682970/Uncrashed__FPV_Drone_Simulator/)
provides diverse freestyle spaces and environment creation; [WebFPV](https://webfpv.org/)
shows the value of roads, moving subjects, named gaps and authored tracks. Use these
as design references. Their executable code and map assets are not approved imports.

### Source intake (candidates, not imported/qualified content)

| Source                                                                                                                                                           | Intended use                                                                                                     | Preparation                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [Abstract City](https://opengameart.org/content/abstract-city)                                                                                                   | Architecture, tower dives, street lines                                                                          | CC0 assembled scene; geometry/lighting/collision audit                                        |
| [Apocalyptic buildings](https://opengameart.org/content/3d-apocalyptic-building-city-cc0)                                                                        | Urban Bando District                                                                                             | CC0 kit; compose original layout                                                              |
| [Canyon Terrain](https://opengameart.org/content/canyon-terrain-asset)                                                                                           | Canyon Badlands                                                                                                  | CC0 meshes/textures; build our own terrain; no Godot add-on dependency                        |
| [3TD Tropical](https://opengameart.org/content/3td-tropical-environment-pack-v20)                                                                                | Archipelago                                                                                                      | CC0 DAE conversion, vegetation optimization                                                   |
| [USGS 3DEP](https://www.usgs.gov/3d-elevation-program)                                                                                                           | Large natural terrain                                                                                            | Public-domain elevation; needs authored materials/landmarks                                   |
| [Train Kit](https://kenney.nl/assets/train-kit), [Conveyor Kit](https://kenney-assets.itch.io/conveyor-kit), [Factory Kit](https://kenney.nl/assets/factory-kit) | Industrial Railway Valley                                                                                        | Exact archive/license receipt; coherent original layout                                       |
| [Coaster Kit](https://kenney.nl/assets/coaster-kit)                                                                                                              | Coaster Park                                                                                                     | CC0; varied routes, safe gaps and correct collision                                           |
| [Building Kit](https://kenney.nl/assets/building-kit), [Fantasy Town](https://kenney.nl/assets/fantasy-town-kit)                                                 | Hillside Town / Castle Valley                                                                                    | CC0, intentionally separate realistic/stylized presentation                                   |
| [Retro Urban](https://kenney.nl/assets/retro-urban-kit), [Graveyard](https://kenney.nl/assets/graveyard-kit)                                                     | Retro Metropolis / secondary details                                                                             | CC0, labelled stylized world                                                                  |
| [Landscape V2](https://opengameart.org/content/landscape-asset-v2), [3D City](https://opengameart.org/content/3d-city)                                           | Secondary authored layouts                                                                                       | CC0; latter explicitly needs UV/mesh optimization                                             |
| [Poly Haven collections](https://polyhaven.com/collections)                                                                                                      | Hidden Alley, Pine Forest, Shed, Verdant Trail, Namaqualand, Lunar Landscape, Smugglers Cove, Project Lighthouse | CC0 assets; large sources converted in bounded batches, not direct scene downloads to players |

Poly Haven [asset license](https://polyhaven.com/license) permits redistribution;
website previews are not covered as downloadable game assets. Retain exact archive
receipts and constituent licenses. [Quaternius current terms](https://quaternius.com/license.html)
restrict standalone redistribution: only admit individually evidenced compatible
versions. Mixed Poly Pizza collections need each author's exact license/version;
never relabel CC-BY-3.0 as CC-BY-4.0. Do not bulk import unknown-license scenes.

## Delivery contracts

Catalogue v2 retains bounded 32-row/32 KiB pages, immutable hashed continuations,
first-party worker requests and strict exact-revision pack installation. Old v1
feeds stay unchanged. Load more is explicit; duplicate/cyclic pages must fail without
replacing already available rows. Refresh, locale changes, failures and cancellation
must preserve source ownership and focus. Play prepares a disarmed session.

Regional manifests are separate from World.v1 and portable scored proofs. Keep
physics, existing thresholds, IDs and saved recordings unchanged. Regional bookmarks
are unscored location state. The next runtime stage must prepare collision before a
section becomes reachable, pause safely when required data is unavailable, and bound
resident resources with shared asset deduplication. The ordinary free-flight mode
already bypasses scored time limits; do not increase recording limits to fake
long-session support.

Keep the 72 MiB core budget, existing pack/texture/geometry limits, 3 GiB stable
local heavy-build floor and protected release checks. Use available external storage
for sources/outputs without deleting unpushed work or player data. Each complete
increment gets its own PR, dependent native stacks only where necessary. Publication
waiting does not prevent independent development.

## Acceptance

Two-hour boundary-crossing sessions with stable memory/collider counts; terrain seams,
high-speed crossings, origin shifts, tunnels and elevated pads; all flight modes,
views and supported input paths; interrupted downloads, quota failure, missing/offline
sections, context loss and paused recovery. Exact world revisions and old proofs remain
usable. Compare all graphics tiers with equivalent flight openings/collision. Report
named test browsers/devices and sustained observations; do not claim untested FPS.
Verify 390×844, 844×390, 1280×800, desktop, EN/UK, focus and touch access. Require source
receipts, import/export and flight checks, package admission and actual deployed
launch before a new world is described as shipped.
