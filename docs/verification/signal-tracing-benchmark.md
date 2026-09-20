# P03 local color tracing: limited prototype benchmark

20 September2026. This is an unpublished development prototype, not enabled in
Studio and not an image-to-playable-map claim. Existing manual upload/crop/geometry,
Inspect and explicit Apply remain the supported UI path.

## Contract

`proposeColorTrace` accepts exactly216×108RGBA samples (3×3 per72×36board cell)
from a caller-owned decoded/cropped reference. The author, never the algorithm,
selects an RGB color and its proposed meaning: foundation, wall, slow or lethal.
Default tolerance24 and7/9 matching sufficiently opaque samples are bounded.
Partially matching cells are returned separately for review. The outer return
border is excluded. The function performs no decode, network, storage, publication,
collision conversion or project mutation.

Only identical horizontal runs on adjacent rows merge into rectangles. Holes and
diagonal gaps are not filled. More than128rectangles returns an explicit fragmented
result with no applicable rectangles; it does not truncate or simplify geometry.
The existing shared manual-inspection compiler validates any later queued proposal.
Pixel accessors, shared memory, malformed shapes, unbounded options and extra
authority fields are rejected. The fixed copied pixel buffer is93,312bytes.

## Reproducible synthetic measurements

Run `node scripts/content-tracing-benchmark.mjs`. This uses six clean-room,
cell-aligned synthetic fixtures, not reference artwork or real photographs.
Node20.19.5, seven repetitions perfixture; recorded median times below are local
observations, not browser/device performance guarantees or CI timing thresholds.

| Fixture | Correct/selected cells | Uncertain | Rectangles | Median ms |
|---|---:|---:|---:|---:|
| Flat diagram |50/50|0|3|0.416|
| Two outlier samples/cell |50/50|0|3|0.393|
| Minority speckles |50/50|2330|3|1.675|
| Transparent target |0/0|0|0, no match|0.128|
| Similar-colored background |50/2380|0|1|0.339|
| Checkerboard fragments |1190/1190|0|0, explicitly refused1190|0.488|

The ambiguous background produces2330false positives and intersection-over-union
of0.021. That failure is the important limit: color agreement is not semantic
confidence. Never advertise general screenshot/photograph recognition or infer
hazard meaning. The broad erroneous foundation proposal also fails existing map
validation without mutating the source. Exact flat/noisy matches do not override
the need for visible inspection and explicit Apply.

Five regression tests cover exact-cell geometry, uncertain/transparent samples,
fragment refusal, unchanged pixels/project, shared compiler inspection, accessor/
shape/option bounds and the deliberately measured ambiguity failure. No real-image
accuracy, browser resampling/crop/decode, accessible suggestion UI, correction-time,
device or human evaluation is established. Those remain required before exposing
assisted suggestions in Studio; manual authoring remains available meanwhile.
