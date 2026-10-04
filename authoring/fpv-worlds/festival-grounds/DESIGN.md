# Festival Grounds — original scene and challenge design

This independent D5 world follows Mountain Reservoir. The initial one-course
scene checkpoint is preserved; the current r5 candidate has all eight authored
challenges and sixteen qualified ordinary-control demonstrations. Actual
imported-player/editor and offline qualification, followed by protected
publication, remain release gates. [README.md](README.md) records current status;
the design and initial production bounds below remain the original scope.

The fictional Ukrainian community festival is an open racing contrast to the
Reservoir. A covered timber stage anchors the north end, four market kiosks form
two quiet side courts, a small clock/wayfinding tower identifies the east service
loop, and an entry arch frames the southern launch lawn. A continuous open lawn
and broad perimeter lanes provide recovery space. There is no audience crowd,
vehicle physics, animated cloth or new renderer style. The existing deterministic
actor system will provide the actual follow and observe subjects.

## Reference and original interpretation

Primary references read on 4 October 2026:

- [Glastonbury areas](https://www.glastonburyfestivals.co.uk/areas../) distinguishes
  recognizable areas around a major stage and smaller peripheral attractions.
- [Atlas Festival's Ukrainian schedule](https://atlasfestival.com/schedule)
  identifies multiple named stages. It informs bilingual event wayfinding rather
  than any copied stage shape, branding or real festival layout.

Our design inference is to distinguish stage, market and service areas through
their silhouettes, restrained blue/ochre canvas and clear lane connections.
Geometry, surface artwork and fictional names are original CC0 material. No
reference image, logo, mesh or competitor asset is included.

## Initial production bounds

- Shared playable ground: x/z −42…42 m, y 0…24 m. Flat land uses existing floor
  collision; flush worn paths and markings do not invent another collision layer.
- No more than 48 static collider records, 15,000 imported triangles, 16 material
  batches, two original 256-pixel textures and a 1.5 MiB source GLB. These are
  authoring targets, not changes to production limits.
- Stage floor, posts, closed back, roof panels, kiosks and clock tower use the same
  source dimensions as explicit solids. Roof openings and under-roof flight space
  are real. Flush artwork must not suggest an opening through a closed kiosk.
- Peripheral trees are outside the flight bounds. Decorative small lights and
  bunting stay attached above the stage or on closed wall faces, not across a
  playable lane. Avoid uncolliding obstacles inside the flight area.
- The unchanged loader/renderer owns imported lit materials, shared Themes and
  Pixel response. No custom rendering, physics, scoring or runtime file changes.

## Eight-course allocation after scene review

01 orientation: Entry check-in; 02 race: Main lawn loop; 03 race: Market slalom;
04 race: Stage-side sprint; 05 precision: Sound-desk landing; 06 follow: Service
cart escort; 07 observe: Festival guide; 08 capstone: Grounds circuit. Follow/observe
use real criteria and actor travel, not merely decorative motion. Both modes remain
selectable, with independent route arrays.

First review poses: entry/lawn FPV, close market facade, stage underside/roof,
clock/service loop and overview, plus low/Pixel readability. Freeze geometry only
after actual rendered acceptance, then author/requalify all sixteen final proofs.
