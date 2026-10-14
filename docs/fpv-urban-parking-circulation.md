# Urban parking circulation study

The original parking block had open floors and a shaft but little visible connection between its levels. This immutable `mixed-r4` source adds three opposed ramps and an upper turning landing, creating a readable ascending route from the north approach to the roof. Blue, amber and pale guardrails distinguish the three segments; the cues use position and shape as well as colour.

## Authored geometry and access

The ramps are 8 m wide with 30 m runs. A 4 m wide flight corridor is checked above the ramp surfaces, including the level turns. Supports sit outside that corridor. The original side entry, central vertical shaft, all 108 existing scenery surfaces and all 18 terrain assets remain unchanged. The ramp and landing triangles are actual collision surfaces; there are no invisible corridor blockers or decorative shapes omitted from collision.

This is original geometry made with the existing pinned Three library. Existing licensed resources and provenance are copied unchanged. It adds seven surfaces and 516 triangles, below the explicit 600-triangle addition budget, with no new textures or runtime code. Both layer manifests retain the shared grid/spawns and identify a new immutable revision of the same 384 × 384 m study. Earlier source directories are retained.

## Verification

- 18 generated GLBs validate with zero warnings/errors.
- 43 generated files are byte-identical across independent runs.
- 490 real paired-owner collision queries pass: 480 sphere sweeps across the centre and both edges of the ascending route, retained shaft/side-entry checks, four intended surface hits, one under-ramp clearance and three ramp support checks.
- Exact old-surface and terrain-byte parity, source hashes/lengths, disposal and source immutability pass. The full nine-cell window is guarded below 2 MiB of geometry.
- The optional inspection page adds `Parking ramp approach` and `Parking upper turn` views.

Terrain manifest SHA-256: `66ef229f0812c31432bb8b3daac6f16e3dcaea19f44be00395a614bfa587afd7`.
Scenery manifest SHA-256: `9ae41033e9a73261eeee3ff2339ceaa0e2f6b47367b212fc1f2de470ca8dacb6`.
Source assets total 2,257,275 bytes. The parking inspection window uses 689,508 geometry bytes.

```sh
node authoring/fpv-worlds/regions/urban-bando/prepare-parking-circulation.mjs /external/urban-hall-r4 /external/urban-parking-new
node authoring/fpv-worlds/regions/urban-bando/verify-parking-circulation.mjs /external/urban-hall-r4 /external/urban-parking-new
```

## Remaining

Native approach and upper-turn views show connected ramps, readable open floor entries and the retained shaft, with no console errors. The six-cell window reports 103 matching meshes/colliders and 689,508 geometry bytes. This is a bounded architectural preparation, not a completed playable course, scored challenge, demonstration recording, final art standard or default catalogue admission. Device performance and package/offline qualification remain separate.
