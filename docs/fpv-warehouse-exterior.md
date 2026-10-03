# Warehouse exterior composition

This D2 increment turns the isolated exterior window panels into connected bays
and gives the two industrial backlines different depths. Pilots see these
frontages through the existing perimeter glazing and above the interior beams.
The warehouse shell, racks, floor, glass and collision volumes remain unchanged.

## Bounded scope

Only the `warehouse` scenery composition changes, across 29 current courses and
four bounds: 19 Snake challenges, eight Warehouse challenges and two school
lessons. All 57 licensed placements remain in their original order. Six buildings
and 32 window panels translate; their geometry, scales, rotations, textures,
materials and shadow flags remain unchanged. Two containers, two trucks, ten
pallets, four lights and the tank retain exact placement. No new asset, material,
texture, collision, decoder, network request or shadow caster is introduced.

Each side has two four-panel runs at a 6.04 m pitch. The existing panels are six
metres wide, leaving a four-centimetre construction joint. Their height, lower
edge at 2.5 m and half-metre flight-envelope setback remain unchanged. Asymmetric
run centres retain at least 3.30 m corner margins and 4.04 m between runs even at
the 64 m minimum supported span. Smaller creator arenas retain the entire prior
layout. Six backline buildings keep their heights and move into staggered
positions/setbacks; the nearest northern building also clears the existing tank.

The Pixel palette and nearest filters remain unchanged. Shared Themes continue
through their existing imported-material binding path. Imported placement changes
apply to all appearances; an unchanged Pixel image is not claimed for this
composition increment. Resource ownership and disposal stay with the existing
world renderer. The GLB still reports 57 source meshes, six batches, 42 instances,
15 unbatched meshes and four spatial groups.

## Functional qualification

The manual qualifier compares current output with main
`e40809f25ea8fe248dea6f8443876d811d21a777`. It passes 416 checks across all 29
Warehouse courses/four bounds, 16 unaffected scenery cases covering the five
other supported environments and eight translated creator cases at and around
the 64 m cutoff. Only the intended 38 translations differ in actual GLB node and
instance buffers. The library, mesh/material data, all other transforms and
original asset files remain exact. No positive AABB overlap involves a moved
model. All 18 installed Warehouse World recordings replay exactly through
44,168 ticks. Other recordings retain exact input bytes and are not claimed as
freshly replayed.

Two offline generations produce identical runtime and provenance bytes under
Node 22.22.2, using the existing pinned authoring dependencies. The embedded
Kenney CC0 library remains 861,504 bytes, SHA-256
`6153c9c7e5dbe571e91a1ba54d021a95bf618db13873e7e661f1ea593c71573e`.
The current runtime is 1,167,023 bytes, SHA-256
`1191d5ce7df7ae6a80a30bcf49094baa1ad8e2ad5148aabadc915caf36f949da`.
No source-budget or package guard changes. Full `npm run validate`, scoped
lint/format, browser-module syntax and all nine existing acceptance-workflow
checks pass under Node 22.22.2. No new unit coverage is added before D6.

The frozen browser fixture explicitly calls the actual renderer's `loadScene`
with each side's GLB before preparation and drawing. It checks four bounds,
low/balanced/high, authored/Pixel/Industrial Workshop, FPV/chase/overview, views
through glazing and above beams, actual imported vertex clearance, exact
interior geometry, unchanged imported resource counts/filtering, five unaffected
scenery controls and repeated disposal. It retains full source inventories and
all per-view hashes/counts. Static observations do not certify flight completion,
physical-device performance or final artist acceptance.

The frozen source fixture is
`dist/fpv-warehouse-exterior-verification-source-v1`, with 31 modules per side
and 19,723,725 bytes. Its complete inventories bind the runtime hash above.
Actual visual acceptance is pending. Inspect the four-centimetre panel joints
obliquely for distracting light slits before package admission. Source/package
WebGL qualification, actual player, protected publication and public deployment
remain separate outstanding steps. No ready PR is published for unfinished work.
