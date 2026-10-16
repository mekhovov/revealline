# Visual acceptance: construction language

## Source findings

The catalogue's semantic material groups were correctly selected, but most wide Toybox structures still shared the same drawing within a world. A glasshouse, planter and irrigation building could therefore become nearly identical painted rectangles. Alpine already had family fittings; the remaining worlds needed equivalent construction cues.

The native receiver and shelter branches also shared identical cabin-window stamps on every cell. That made distinct structure roles look the same and recreated the dense repeated machinery problem previously fixed for boilers and pump islands.

## Corrections

Toybox now carries the existing family identity through its construction geometry:

- Orchard: broad greenhouse glazing, planted troughs and an irrigation trunk with a valve.
- Freight: corrugated container panels, open plank decking and a connected dispatch window band.
- Foundry: boiler brace/inspection port, a pressure-door seam and a coolant trunk.
- Harbor: pump intake, floodgate slats and dock decking with a fitting.
- Basalt: vegetated terrace ledges, stepped excavation recess and reclaimed machine fittings.
- Observatory: retains the already-corrected indigo enamel, receiver vents, shelter window and antenna mast.

These are native-scale construction cues, not new simulation objects. Larger interiors stay quiet and focal fittings appear once, rather than stamping another complete appliance in every cell.

Native receiver buildings now have one equipment bank. Shelters and dispatch cabins use connected facades aligned with their actual component; dispatch retains its distinct service stripe. Existing accepted solid-cell clipping remains authoritative.

Cosmetic world revision advances to `snake-worlds-v6` for cache invalidation. No mission descriptor, gameplay recipe, creator-art override, new atlas, retained surface or simulation random stream changes.

## Verification

- 15 structure/composition/remaster-art tests pass.
- Seven world tests pass, including creator artwork authority, shared selector rendering, erosion/holes, palette behavior and bounded material/backdrop counts: 22 targeted tests total.
- New tests compare geometry with color assignments omitted: three families per world remain distinguishable in representative 3×3 structures across all four production looks.
- Footprint checks exercise 1×1, 1×5, 5×1 and 3×3 structures for all 18 families and all four looks. Every native construction rectangle remains within its own square cell.
- A separate test confirms the receiver equipment bank appears once in a 5×4 structure.
- ESLint passes for changed source and tests.

These are source and render-command checks. Root owns the bounded real-browser chapter comparison and will record its screenshots and findings separately. They do not establish all 960 visual combinations were individually inspected. Physical-device testing and player feedback are explicitly deferred by the user.
