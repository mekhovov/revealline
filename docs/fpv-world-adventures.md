# FPV World Adventures — 2 October 2026

Adds six original environments and 30 authored challenges to the existing eight
worlds, 60 original challenges and 58 school lessons: **14 worlds / 148 challenges**.
Free flight remains additional. All challenges are immediately available; no medal
or campaign locks are introduced.

## Playable content

| World               | Shape and landmarks                                                              | Five distinct activities                                                                                  |
| ------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Coastal airfield    | Sea outside the flight boundary, two raised piers, harbour bridge and lighthouse | Orientation, under-bridge race, courier pursuit, rover observation, three elevated landings               |
| Amber quarry        | Rock terraces, central spire, conveyor portal and landing ledge                  | Exploration, moving-beacon crossings, haul-rover escort, fictional pulse arena, spire/ledge capstone      |
| Skyline campus      | Four roof heights and an elevated skybridge                                      | Exploration, over/under race, climbing courier pursuit, roof landings, aerial crossing hazards            |
| Harvest orchard     | Four tree avenues, solid foliage crowns, barn and stone plinth                   | Orientation, avenue exploration, cart observation, walking-guide follow, precision landing                |
| Solar research park | Tilted panel banks, service lanes and control pavilion                           | Exploration, panel-edge precision, rover observation, crossing timing, pulse trial                        |
| Railworks           | Parked wagons, two gantries, platforms and signal box                            | Exploration, gantry race, inspection-rover follow, crossing hazards, fictional drone/rover/sentry contest |

Flight volumes are 120 × 120 × 35 metres. Ground characters and vehicles use
supported floor routes. Aircraft can change height. The 34 authored actor
instances include 31 moving subjects; all moving routes complete a full loop
without blocking. Sentries intentionally stay still. Vehicles follow authored
paths; drifting, suspension, real train movement and navigable water are not
implemented. Combat is confined to fictional practice machines, separate from
civilian follow/observe missions.

The new original procedural scenes use shared materials, bounded instancing,
matching authored collision, 4–6 exterior batches per world and no new runtime
asset files or downloads. Water and distant scenery are outside the flyable
boundary. New terrain/material roles include cut stone, foliage and solar cells.
The six larger arenas have a consistent 125–320 m fog range across presets;
legacy worlds retain their prior fog. Overview/editor views frame the map
independently of the player's wide-angle FPV lens and fit portrait viewports.
These are functional original environments, not finished photorealistic art.

## Research and design choices

- [Liftoff Slipstream](https://store.steampowered.com/app/2019790/Liftoff__Slipstream/)
  uses recognizable moving subjects such as cars, aircraft and trucks. Here,
  distinct subjects and routes support real pursuit objectives.
- [TRYP FPV](https://store.steampowered.com/app/1881200/TRYP_FPV__The_Drone_Racer_Simulator/)
  separates exploration, racing, freestyle and cinematic activities. New catalogue
  filters expose Follow and Observe alongside existing activity types.
- [Uncrashed announcements](https://steamcommunity.com/app/1682970/announcements/)
  describe drift-city traffic and continuous race improvements. The relevant
  design idea is combining a distinct setting with moving activity and easy retry;
  this release does not simulate drifting or copy those maps.
- [VelociDrone's manual](https://www.velocidrone.com/desktop_manual) describes
  ghosts, line analysis and optional race guidance. Exact compatible local ghosts
  remain the route to genuine racing comparisons; waypoint aircraft are pace
  subjects, not scored competitors.
- [Three.js instancing](https://threejs.org/docs/pages/InstancedMesh.html) and
  [shadow guidance](https://threejs.org/manual/pages/shadows.html) support bounded
  repeated scenery and one shadow-casting key light. Graphics presets never
  remove collision objects, subject silhouettes or required sight lines.

Commercial simulator maps/assets are inspiration only, not imported or licensed
resources in this increment. All new scenery is original code-authored geometry.

## Objective and compatibility contract

`actor-track-v1` is an additive, data-only objective on `FlightCourse.v2`:
`actorId`, `minDistance`, `maxDistance`, `maxRelativeSpeed`, `maxTilt`, `ticks`,
`viewAngle` and `minTargetTravel`. Distances/speeds use millimetres and millimetres
per second, angles use centidegrees and dwell uses 50 Hz ticks. `viewAngle` is a
half-angle about the actual 3D body nose, independent of rendered camera/FOV/tilt.
This checks looking toward a subject, not cinematic framing through the FPV lens.

A qualifying tick requires a live subject, airborne player, correct range,
relative speed, tilt, nose alignment and geometric line of sight. Failure resets
consecutive dwell and accumulated subject travel. Follow missions require eight
seconds, at least five metres of real subject travel and a relative-speed bound
below the subject's cruising speed. Hovering while a subject passes is insufficient.
Observation requires four seconds with a visible subject and permits low target
motion. Mission text, compact corrective hints and a small numbered subject
bracket explain the task. Full instructions remain in the paused mission briefing.

Only courses containing the new tag gain tracking state. Old physics, model IDs,
recording commands, rules and snapshots are unchanged. New courses use a separate
`fpv-adventures` pack identity; original world, Academy and school entries plus all
four original curated playlists remain byte-identical. Six separate adventure
playlists preserve exact revisions. Old runtimes reject unsupported objectives
instead of treating them as a hold.

Layered projects, compiled packs and editable ZIPs roundtrip the criterion through
the existing validator. Position/speed and non-hostile role edits preserve follow
objectives; explicit subject deletion removes its references transactionally.
General actor-objective JSON editing remains supported; a dedicated visual
follow/observe authoring inspector is a future creator-UX improvement.

## Qualification

- All 30 courses complete in both flight modes and independently replay identically:
  **60/60 runs**, 253,011 recorded ticks, zero contacts. Six combat runs lose 3–6
  health to valid return fire; the other 54 finish at full health.
- Actor tracking **20/20** functional checks cover positive/negative range, facing,
  LOS, blocked movement, pause/recovery, data/store roundtrips and tampered
  dependency rejection. All **24 v1 + 90 pre-adventure v2** installed demonstration
  proofs replay unchanged. The v2 count includes school proofs.
- Art probes **38/38**, retained eight-world probes **43/43**, route/actor geometry
  **60/60**. The route audit found and corrected three gantry apertures and an
  orchard approach before freezing content.
- Actual WebGL browser checks exercise every new course in all three presets and
  FPV/chase/overview, tracking cues, animation, pause, repeated loading, disposal,
  reduced motion and start/end source hashes. Final receipt is under `docs/evidence`.
- Additional unit-test coverage remains deferred to R7. These checks do not establish
  novice acceptance, physical-controller acceptance, sustained hardware FPS, GPU
  memory consumption or final art quality.

Reproduce physics/replay evidence:

```sh
node scripts/qualify-fpv-adventures.mjs --out dist/fpv-adventures-qualified
node scripts/qualify-fpv-actor-tracking.mjs --output dist/fpv-actor-tracking.json
node scripts/prepare-fpv-adventures-verification.mjs --out dist/fpv-adventures-verification-review
```

The first script records ordinary controls only; it is offline authoring tooling,
not an in-game autopilot. Open the prepared browser fixture and press Run checks.
Proofs are preserved as a reproducible authoring archive, not silently embedded
in the already bounded core package. Their optional player-library delivery is
separate from this playable-world increment.

Publication, package receipts and player build identity are recorded in
`fpv-continuous-delivery.md`. No public availability claim is made before both
protected deployment identity and actual public simulator launch are verified.
