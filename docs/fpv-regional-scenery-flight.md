# Regional Urban scenery flight adapter

This increment connects the verified scenery preparation from #1231 to the existing
regional authoring flight authority. It does not create another flight model or
admit a public playable region.

`createRegionalFlightPrototype` accepts an explicit `geometryProfile`:

- `terrain-v1` is the unchanged default, using verified terrain cells.
- `scenery-v1` uses verified canonical scenery triangles for both rendering and
  collision. Urban's authored ground belongs to that same scenery profile.
- Unknown and mixed profiles are rejected. Two independent transitions are not a
  safe implementation of combined terrain and scenery; that still requires joint
  staging, combined resource accounting and one synchronous adoption.

The adapter only normalizes readiness and hit/clear result names. It preserves
unknown or missing geometry as unavailable. The existing flight authority keeps
its global pose, shared production free-air transition, provisional 220 mm sphere,
collision response, paused recovery, neutral arming checks and atomic local frame
update. `snapshot.terrain` remains the host compatibility envelope, with the exact
profile recorded in both the body snapshot and geometry snapshot. Source hash,
canonical triangle equality, support-pose checks and allocation ceilings remain
owned by the verified preparation pipeline.

## Authoring preview

In `authoring/fpv-worlds/regions/flight-preview.html`, choose **Scenery with
ground**, enter the generated Urban `region.json` URL and load. Preparation stays
paused until deliberate arming. FPV, Chase and Loaded area use the shared production
view framing and aircraft. `?profile=scenery-v1&manifest=<local-region-url>` selects
the same explicit profile; it never bypasses source or geometry validation. Reset
retains the selected profile through the existing input session. Terrain remains
the default; mixed profiles are not offered.

The preview now offers every authored spawn after the first manifest load. Choose
a start and **Load / restart region** to apply it safely. New preview loads face
the region centre by default, with explicit North/East/South/West alternatives;
the underlying constructor still defaults to north. `initialHeading` accepts
integer centidegrees or `region-centre` and uses the shared fixed-point rotation
helpers. It changes only the initial authoring pose, not flight dynamics or source
geometry. Reset retains the chosen spawn, heading and appearance.

For terrain, **Authored appearance** chooses the Canyon study material only for
the known `canyon-badlands-study` identity; other regions stay plain. Plain/Canyon
and Performance/Balanced/Quality overrides pass into the existing verified terrain
source options. These appearance controls are disabled for the scenery profile.
No manifest, source hashes, collision triangles or runtime default materials change.

## Verification

The controlled Urban flight verifier uses the exact generated r2 sources and native
HTTP fetch. Controlled spawn positions are copied into an in-memory manifest for
specific architecture checks; original source assets, hashes and generated files
are unchanged. It exercises actual stick commands through loading doors, into a
solid wall, down onto an elevated roof, up the parking shaft and across two local
origins along the open road. It also verifies
pause/disposal, corrupt-source rejection and unsupported profile rejection.

Run `node authoring/fpv-worlds/regions/urban-bando/verify-flight.mjs <regional-output>`.
Retain the existing `verify-flight-prototype.mjs` and `verify-input-session.mjs`
functional checks for terrain and shared-input compatibility.

Measured results: warehouse doors 1,706 ticks with zero contacts; wall stops at
x145.280 m; roof settles at y12.402 m (surface 12.400 m); shaft climbs to 25.026 m
without contacts; road crosses two local origins over 150 m without contact or
global-state reset. Both unchanged authored spawn candidates prepare paused with
zero ticks and contacts. Six existing terrain-flight scenarios and eight
shared-input lifecycle scenarios pass. These are controlled Node v20.19.5 checks,
not device FPS measurements.

## Remaining

This is the bounded 384 m architecture study, still a colour/material blockout.
Production collision semantics, mixed terrain/scenery ownership, actor/mission
migration, scored proofs, package/offline admission, sustained performance and real
device qualification remain separate. A passed commanded path is not evidence
that the whole map is production-ready or that a physical radio was tested.
