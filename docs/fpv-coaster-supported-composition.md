# Coaster Gardens: supported ride courts and connected ground

Native review of composition-r1 rejected the unsupported isolated loop and plain olive field as representative finished art. This source-only composition-r2 addresses those findings while keeping the old r3/r4 output, immutable review-r1 delivery and Draft Library pin unchanged. It remains a 2.048 km study, not a finished 4 km park or an operating ride simulation.

## Changes

Both loop landmarks now have ground footings, columns and crossheads that contain actual imported rim vertices. Parallel entry/exit track approaches meet the imported bottom endpoints and lead to buffered station courts with roofs, platforms and pillars. The loop opening remains a separate five-metre-wide flight corridor. Buffered ends make the static study's limits explicit; no working rollercoaster circuit is claimed.

Continuous paved routes and edged approaches connect the district courts and outer landmarks. Paver bands, planting beds and low borders add ground-scale motion cues. Paving is exact visible/collision geometry on the authored flat ground; no runtime shader, physics, schema or budget changes are introduced. Six new outer approaches and two elevated loop passes supplement all 22 existing routes.

There are 407 original architecture pieces and 97 accepted licensed model placements. One redundant river-court tree was removed to fit the existing 512 KiB per-cell GLB allowance after adding ground details. All eight accepted model types remain; the two rejected quantization cases remain excluded.

## Verification

The committed receipts are under `authoring/fpv-worlds/regions/coaster-park/supported-receipts-r1/`.

- Two independent output trees have 205 byte-identical files, 34,195,688 bytes including authoring receipts/provenance. Runtime source manifests/assets total 34,181,566 bytes, below the unchanged 64 MiB delivery limit.
- 64 terrain cells, 36 scenery cells, 28 explicit empty scenery cells; 100 canonical GLBs and 112 exact terrain seams.
- 1,146 production collision clearance sweeps, 14 actual footing/platform/track/path support queries, six wall probes, four non-grid terrain support checks and 417 prepared windows passed.
- All 60 commanded production routes passed in Self-level and Acro: 267,673 simulation ticks, 112 recentres and zero route contacts. Twelve separate commanded wall-impact cases still register collision. Twelve authored starts remain disarmed and usable.
- Peak window resources are 3,919,484 bytes; conservative retained-plus-candidate peak is 7,838,968 bytes, under the unchanged 8 MiB cap. Source/geometry reservations and owned resources reach zero after disposal.
- The initial revision attempt correctly failed the existing GLB cap; the first corridor pass caught a station pillar crossing an old link. The redundant tree and pillar location were corrected; the final receipts contain the passing output only, with earlier failed output/logs retained externally.
- ESLint, formatting and whitespace checks pass for the changed source files.

Exact final manifests:

- Terrain: `6dd2014a1f9ad96d81b2fb5fb76074b90b28c892660b6990c38805293ee1bb4a`.
- Scenery: `6267731197ea142b0cf4a99380953108aca11ae01db69aabda866388029b037d`.
- Revision: `composition-r2`.

The generator adds cell identity to bounded compilation failures and asserts physical rim contact using the accepted imported vertices. Collision checks also verify the new supporting surfaces independently.

## Remaining acceptance

New native visual review, first-flight quality judgment and any revised immutable delivery/Library pin are still pending. The old negative screenshot remains valid for composition-r1. Automated geometry and command receipts do not establish GPU performance, physical-controller behavior or final art quality. The original 160 m pack is unchanged.

External frozen outputs are `fpv-large-worlds-20261015/coaster-supported-r5` and byte-identical repeat `coaster-supported-r6`. The latter also executes the explicit imported-rim support assertion.
