# Alpine Summit station: pilot-height material study

The reviewed Summit station is readable as a solid structure but its broad, uniform walls and roofs offer little sense of scale at pilot height. This bounded source follow-up adds original timber boards, a masonry plinth, opaque backed panels and roof seams to the existing station wings. It does not add another region or claim that Alpine representative art is finished.

The source compiler requires the exact refined-contour manifests. It creates a new `relief-r3-station-materials` revision; every earlier source, delivery and Library pin stays unchanged. Only two scenery cells and32 existing triangles receive new material bindings. All104 scenery cells retain the exact oriented triangle positions, normals and solid/visual classification. Terrain asset bytes, starts, routes and collision clearance are unchanged. The apparent panels are fully opaque, backed by the existing solid walls and cannot be flown through.

The two original pixel artworks are authored here under CC0-1.0, without third-party imagery. Wall repeat size is8×14m, with25cm timber boards and35cm masonry courses. Roof repeat size is8×4m with50cm seams. The wall uses256×128RGBA pixels and the roof128×128; including the retained white pixel, each affected cell uses49,153 pixels within the existing contract. No runtime module or budget is added.

## Reproduction and verification

Run `prepare-station-materials.mjs <exact contour source> <new external output>` and then `verify-station-materials.mjs <exact contour source> <new output>` from this directory. Existing outputs are refused. Receipts are in `receipts-station-materials-r1/`.

The finished source is22,578,814bytes. The conservative worst retained-plus-staged window charge is2,992,680bytes, below the existing8MiB resource allowance. Production preparation at Summit charges767,476geometry bytes and458,760texture bytes at every tier. Canonical GLB validation has no errors or warnings. Actual mixed-owner sweeps retain the clear concourse and solid backed walls at all three tiers; both flight modes prepare disarmed at564m and disposal releases all owned resources.

An initial oversized texture draft was correctly rejected by the unchanged aggregate pixel limit. The artwork was reduced; the limit was not raised. That discarded external draft is not a published source revision.

## Remaining visual gate

The shared authoring viewer has three additive pilot-height comparison views: Summit concourse, opaque wall detail and roof seams. Native before/after review still needs to confirm correct texture orientation, scale, filtering, wall opacity, retained openings and ordinary occlusion, followed by resource release. Current headings/package #1468 are independent and remain unchanged. No new Library row, public availability, hardware performance, offline or complete Alpine art claim follows from this source study.
