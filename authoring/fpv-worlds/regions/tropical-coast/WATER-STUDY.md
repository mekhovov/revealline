# Coastal water surface study

The six-district study has a uniform cyan sea plane. This separate opt-in presentation prototype adds a shallow/deep colour transition based on the authored shoreline and lagoon sandbar, broad low-contrast colour variation, and pixel-footprint-filtered directional ripple detail. Performance keeps only broad cues; Balanced and Quality add bounded near detail. The appearance is static: no time uniform, animation, vertex displacement, extra texture, render target or reflection pass. Existing lighting and opaque source alpha are retained. Reduced-motion users see the same still surface.

The runtime profile is `tropical-settlement-water`, separate from the terrain profile. It is not applied by any current Library pin. Only the authored `sea-surface` material can opt in: visual-only collision, opaque single-sided four-vertex plane at zero height, upward normals, no vertex colours, exact original colour and embedded 1 × 1 white texel. Other surfaces, licensed props, ordinary/Urban materials and the original Tropical revision stay unchanged. This is a colour cue, not a water-depth instrument, physical wave or new navigable obstacle.

## Functional evidence

`verify-coastal-water.mjs` validates the exact districts-r2 manifest and every scenery source hash, then prepares the real production owner for plain, Performance, Balanced and Quality. All four retain identical geometry/UV/normal/index/placement digest and allocations: nine cells, 969,240 geometry bytes, 2,599,580 texture bytes, 18 textures, 105 meshes, 20 materials and 58 colliders. Eight authored collision probes per tier retain clear pier openings/under-deck passes, solid roofs/trunks/cargo, visual foliage and visual-only sea. Disposal twice frees each owned material/geometry/texture once and returns resource/world/collider counters to zero. Nine malformed/unrelated material identities remain plain.

Live quality switches reuse material and uniform owners. Same-tier selection avoids recompilation; unsupported tiers reject. A real verified mixed session passes the selected scenery quality through and prepares disarmed at tick zero. No source bytes are modified.

Existing regressions pass: five RGBA source/material/resource scenarios, seven sparse scenery scenarios including 2,200 actual fixed simulation ticks across four cell crossings, and the Urban material comparison (95 meshes, 14 identical collision queries). Scoped lint, syntax and whitespace checks pass. The resource accounting is unchanged; no runtime module or byte-budget increase is introduced.

## Native acceptance pending

The isolated manual comparison uses the same exact districts-r2 source and identical lighting for Original/Coherent water, with harbour, sandbar and shoreline views plus explicit disposal. Native shader compilation, appearance comparison and quality-tier review remain pending while the independent real elapsed-time endurance run owns the verification browser. No player-store, normal-Library, package/offline, sustained-GPU or device-FPS claim is made here. Flat physical water remains; this does not complete the final representative coastal art standard.
