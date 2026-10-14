# Urban Bando: representative architecture preparation

This increment prepares an original **384 × 384 m** architectural study with real openings and matching visible/collision triangles. The broader **4,096 × 4,096 m** Urban Bando region remains a design target. This study is not a player package, default Library entry, or flight-qualified world.

## What is prepared

| District       | Architecture and intended practice line                                                                   |
| -------------- | --------------------------------------------------------------------------------------------------------- |
| Open Mill      | Four ring-shaped slabs, open side lanes, and a genuine 28 × 24 m central atrium for vertical transitions. |
| Loading Hall   | Opposed 12 m loading doorways, side walls, roof beams, and an open skylight.                              |
| Container Yard | Three licensed containers and an original portal crane with a clear passage between its supports.         |
| Parking Decks  | Four open decks with a 16 × 16 m central shaft and a separate sloped access ramp.                         |
| Viaduct        | Supported elevated deck with open underpasses, solid pillars and edge railings.                           |
| Tower Court    | Licensed water tower and service building, stepped platforms, and an open approach.                       |

There are 71 original solids, five licensed prop placements, six named districts and twelve EN/UK landmarks. Architecture is deliberately an early geometry study: it does not yet include production surface maps, weathering, vegetation, street dressing or environmental sound.

## Sources and rights

The architecture is original project-authored work. Five props reuse the existing pinned **Kenney City Kit Industrial 2.0**, under **CC0-1.0**:

- [Official source and licence](https://kenney.nl/assets/city-kit-industrial).
- Existing complete receipt: `authoring/fpv-worlds/assets/kenney/city-industrial/provenance.json`.
- Original archive SHA-256: `5b381164e5760f3830a2dbee43b972deee38b2a695d091b56e238ab2910c96d2`.
- Models: `shipping-container-a.glb`, `shipping-container-b.glb`, `water-tower.glb`, `building-d.glb`.
- Original files remain unchanged. The generator verifies selected model, shared texture and licence hashes, retains texture transforms, and uniformly scales/places derivative instances.

Other researched candidates are [Majadroid's CC0 ruined city](https://opengameart.org/content/3d-apocalyptic-building-city-cc0) and [Keenan Crane's CC0 Abstract City](https://opengameart.org/content/abstract-city). They are candidates only: no asset from either is shipped here. A city silhouette alone does not establish accessible interiors, so this increment authors openings explicitly.

## Reproduction and inspection

Use the existing authoring dependencies. Pass a new output directory on a volume with adequate space; existing output directories are never overwritten:

```sh
node authoring/fpv-worlds/regions/urban-bando/prepare.mjs /path/to/new-study
node authoring/fpv-worlds/regions/urban-bando/verify.mjs /path/to/new-study
```

The generated `overview.html` uses the shipped Three.js loader and offers six camera views. Serve the output directory over HTTP. It renders the actual prepared GLB; it is an authoring inspection tool, without flight controls or gameplay progression. `design.json` describes districts, landmarks, source placements and collision probes.

`architecture-collision.json` is explicitly an **authoring-only** `FPVAuthoringMeshCollision.v1` triangle format. It is not silently admitted to the existing regional terrain-only manifest profile. Every collider comes from the serialized visible scene, including GLB transform rounding, rather than an enclosing box around an entire building.

## Verification and limits

The generator validates glTF and checks fourteen 500 mm diameter sphere sweeps using the shipped Rapier engine. Clear sweeps include the mill lane and atrium, loading doors and skylight, crane passage, parking entry and shaft, viaduct underpass, and tower approach. Negative sweeps confirm mill/parking slabs, warehouse wall, crane beam and viaduct pillar remain solid.

The separate verifier reloads the written GLB and collision JSON, checks the recorded hash, compares every transformed visible vertex and triangle against collision, then repeats the sweeps against the loaded artifact. This is representative geometry evidence, not exhaustive flight qualification. See `authoring/fpv-worlds/regions/urban-bando/preparation.json` for the exact generated receipt.

On 14 October 2026, two independent generations produced eleven byte-identical files. The saved-artifact check passed all 78 surfaces and all fourteen sweeps; the GLB validator reported zero errors and zero warnings. Desktop in-app browser inspection of the overview, warehouse doorway and parking-deck views confirmed recognizable openings. An initial dark-material issue was corrected by explicitly setting non-metallic building materials; the repeated warehouse/parking inspection showed distinct brick and concrete surfaces and readable deck gaps. This visual receipt covers geometry and preview readability only, without a device FPS or actual flight claim.

## Remaining work

1. Admit scenery collision and materials through an explicit regional runtime contract, with spatial ownership, streaming and disposal budgets.
2. Test actual flight routes, spawns, recovery and camera views through these openings using the real drone collider.
3. Develop production surfaces, district composition and readable connecting streets around the geometry.
4. Expand beyond this bounded representative only after runtime, memory, collision and visual budgets hold.
5. Qualify controller/mobile performance, offline installation/update, replay compatibility and Library admission before making it a default playable world.

No new physics, mission identities, rewards, recordings, catalogue entries, or offline package budgets are changed by this preparation.
