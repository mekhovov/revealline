# Railway ground readability study

The bounded Railway route study previously showed green terrain inside its maintenance hall and between its tracks. The optional `railway` terrain presentation now gives the hall a concrete floor, the freight lanes asphalt with restrained edge markings, the yards gravel and the track shoulders darker ballast. The cutting retains a natural surface. Colour transitions follow the authored global metre coordinates and the actual 14 m yard plateau; they do not paint a fictional road across the lower cutting.

This is a colour/roughness-only presentation. It adds no displacement, textures, network requests, mesh, collider, render pass or runtime module. The previous plain/Urban/Canyon defaults and existing source manifests remain unchanged. Railway is explicit opt-in, through `ground=railway` on the authoring scenery preview or the equivalent existing terrain-source option. It is not catalogue admission or a completed realism claim.

Performance retains the district surfaces and pixel-faded slab/edge marks; Balanced adds broad breakup and near-ground grain; Quality adds restrained ballast grain. These are presentation tiers, not named-device FPS guarantees.

## Verification

```sh
node authoring/fpv-worlds/regions/verify-railway-ground.mjs /external/railway-pilot-r3/terrain
node authoring/fpv-worlds/regions/verify-urban-ground.mjs /external/urban-loading-r1/terrain
```

Railway passes eight cases: plain plus three detail tiers at two render origins, with identical terrain vertices, normals, indices, source JSON and 24 real support/sweep queries per case. Each terrain window remains 456,408 geometry bytes, uses one material and no textures, and disposes once. The existing Urban eight-case check also passes with 26 queries per case. A direct comparison against the previous committed Urban material confirms identical generated shaders, uniforms and program keys for all three existing quality tiers.

The full paired Railway source receipt remains [the route study](fpv-railway-route-study.md): 1,233,144 geometry bytes plus 2,446,676 palette bytes. No limits are raised. Structural bridge detail and richer yard composition are still separate authored-source work and must retain or requalify their route clearances.
