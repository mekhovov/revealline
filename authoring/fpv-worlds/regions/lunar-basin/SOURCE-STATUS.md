# Lunar Basin: original 768 m composition source

**Source preparation only; native art, delivery and Library admission pending.**
The first bounded revision realizes six districts in a 768 × 768 m region. The
8.192 km ambition remains unbuilt. It uses the existing terrestrial flight model:
rotorcraft cannot fly in lunar vacuum, and this fictional training environment
does not simulate vacuum, reduced gravity or lunar aerodynamics.

| District           | Near-flight landmarks                      | Practice                                 |
| ------------------ | ------------------------------------------ | ---------------------------------------- |
| Mare apron         | Open shelter, three unequal grounded berms | Height consistency and open-sided return |
| Ejecta fan         | Split blocks, broken crescent              | Block weave and outside recovery orbit   |
| Sinuous rille      | Asymmetric elbow, elevated crossing        | Channel follow and over/under line       |
| Terraced crater    | Broken rim, displaced floor mound          | Saddle approach and controlled descent   |
| Fractured highland | Unequal slabs, branching rocks             | Forgiving shelf and precise slots        |
| Observatory ridge  | Supported shallow dish, open gallery       | Bay approach and outside return          |

Original continuous relief combines rounded impact rims, a depressed crater,
one sinuous channel and broad fractured shelves. Narrow structures use separate
exact solid triangles; no heightfield tunnels or box proxies fill the openings.

The earlier proposal remains intact in `design.json` and `README.md`.
`preparation.json` records the actual source. Clearance corrections expanded the
survey shelter to 48 × 48 m, narrowed the gallery to 48 × 28 m and moved blocks
out of the routes. The dish is currently horizontal on four piers, not the
proposed tilted tripod. Earlier rejected outputs remain preserved externally.

## Verified

- 36 terrain cells, 128 m per cell, 33 × 33 samples and 4 m spacing; all adjacent
  edges agree. Twenty-one scenery cells are populated and fifteen explicitly
  empty. All 57 canonical GLBs match their collision source and have zero
  validator errors/warnings. No texture images are introduced.
- Twelve terrain-resolved routes pass 2,724 centre/edge swept segments with a
  250 mm sphere and the planned 8–20 m corridor widths. This is sampled corridor
  evidence, not a claim that every possible path is clear.
- Twenty-four production command flights across Self-level/Acro complete
  380,830 ticks and 119 origin recentres without route contact. Twelve starts
  remain disarmed until explicit arm; four deliberate ground/roof contacts,
  paused-input isolation and disposal pass. Only scenario initialization sets
  position; subsequent movement uses ordinary commands and unchanged physics.
- Peak prepared resources are 548,808 bytes; retained plus staged is 1,097,616
  bytes, below the unchanged 8 MiB ceiling. Source payloads remain below 2 MiB
  and the 12 MiB pilot target. These numbers are not device FPS or GPU claims.
- Regeneration after formatting is byte-identical across 117 files; hashes are
  recorded in `determinism.json`.

Checks use the preserved production runtime from exact package
`e006821b9ce49d97e52ec9bdd9c2ae4725ce94b5`. Future player admission requires a
fresh exact package; these source tests do not replace that gate.

## Reproduce and remaining gates

Run `prepare.mjs` with a new external output directory, then both
`verify-preparation.mjs` and `verify-commanded-flight.mjs` against it. Existing
output is refused. The shared scenery viewer accepts `views=lunar-basin` and the
generated paired manifests. Its twelve views are source review cameras only.

Native review must inspect every approach, opening, support and escape line.
Current terrain still uses the existing plain profile: lunar regolith material,
broader composition, sky/lighting and final art remain unfinished. The seven
broad district connections also need their own commanded transit evidence.
Do not claim representative visual quality, hours of engaging play or a
physically accurate Moon from passing geometry tests.

FPV/Chase/Overview, all quality tiers, failed/cancelled loads, immutable delivery,
fresh package, ordinary Library install/reload/revision/cached launch, physical
controls and sustained play are separate gates. No Library row is added here.

## Provenance

All relief, layouts, rocks, structures and colours are original project source.
Repository licensing applies. No competitor scene, NASA image, logo, atlas data
or third-party mesh is included. The earlier design records primary morphology
references: [NASA facts](https://science.nasa.gov/moon/facts/),
[composition](https://science.nasa.gov/moon/composition/),
[craters](https://science.nasa.gov/moon/lunar-craters/) and the
[LPI rille atlas](https://www.lpi.usra.edu/lunar/rilles/).
