# Coastal settlement ground treatment

The larger coastal source has valid textured props but still reads as isolated objects on flat green ground. This increment adds a separate `tropical-settlement` presentation profile, authored for the `districts-r2` layout. It paints soft earth paths between the five huts, worn courtyards around their footprints, varied dry grass and a wet/dry sand transition near sea level. Metre-scale shore ripples fade with pixel footprint to avoid distant shimmer. These are visual surface markings, not raised terrain, collision boundaries or objective indicators.

The original `tropical` colour layout stays unchanged. Both Tropical profiles now implement the existing live graphics-tier contract, so the Performance/Quality selector can replace shader detail without replacing materials, geometry or uniform owners. Performance omits procedural noise sampling; Balanced and Quality retain bounded near-detail layers. No textures, runtime module, geometry or collision cost is added. A new profile is not automatically admitted by the Library: exact-pin trusted appearance integration remains a separate gate.

## Verification

- Existing `verify-terrain-surface.mjs` passes 11 cases against nine exact source cells: identical vertices, normals, indices, support queries and swept collision for all profiles/tiers, and disposal once. Invalid material/origin inputs still reject.
- Existing `verify-live-surface-quality.mjs` passes 25 transitions across Canyon, Urban, Railway and both Tropical profiles. Materials, geometries and uniform owners remain stable; no textures are added, same-tier selection does not recompile, and disposal happens once.
- Scoped ESLint, syntax and whitespace checks pass.

The native comparison at isolated origin 9070 freezes production dependency closure `c1e08bb7c6007b44f2f43771bb81945b55d08774` with unchanged `districts-r2` geometry and identical lighting. It offers Original/Integrated ground and explicit Load, plus street, courtyard and shoreline views from pilot height. Native shader/appearance acceptance is pending until recorded below.

## Limits

This does not add water physics, animated water, architecture, new flight objectives or a larger world. It does not complete the final representative art standard. No GPU/frame-rate, real-device, package/offline or new default-Library claim is made. The existing 8 MiB retained/candidate resource ceiling and all source/scene limits remain unchanged.

## Native review — 15 October 2026

Root operated the isolated 9070 viewer through CUA against exact production source `c1e08bb7c6007b44f2f43771bb81945b55d08774`. Balanced Original/Integrated Street views used the same camera and lighting: the integrated paths and courtyards visibly connect the huts. Quality Integrated Shoreline rendered the sand transition. Performance Integrated Courtyard preserved the clear open under-hut approach. No warning/error console entries were observed.

The source owner reported 4,025,228 resource bytes, two collision worlds and 67 colliders while loaded. Explicit Dispose returned every resource/reservation byte count, collision world and collider count to zero. No geometry, water physics or flight-path change was involved.

| Preserved screenshot | SHA-256 |
| --- | --- |
| `coastal-ground-original-c1e08bb-20261015.png` | `f04f27f39e094637f952563df8076c609c22398d130dd8fb5e7a61475a44cd09` |
| `coastal-ground-integrated-c1e08bb-20261015.png` | `5d2d315007c24ae492136689859f8dc3a7e72bbc77a56a3ed67eca6740a85f34` |
| `coastal-ground-shore-c1e08bb-20261015.png` | `992ed98de69a30cb6a95734edcd5119546dd0010a1a72ded5727c0d19dbe562b` |
| `coastal-ground-courtyard-c1e08bb-20261015.png` | `b83f39957fd262a10a7317d7a15655b2d959015ddf5ea20a27293ac5d075ad2d` |

This accepts a bounded ground-composition improvement. Flat water and the sparse broader landscape remain explicit gaps; representative final art quality, normal player admission and exact package qualification remain unfinished. The native result is a shader/appearance and disposal observation, not sustained GPU or device-frame-rate evidence.
