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
