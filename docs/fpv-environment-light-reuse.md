# Reuse the current environment light

The historical bounded D1 profile found repeated PMREM generation inside course
installation (up to 101.1 ms in that observation). This increment reuses one
renderer-owned target when its exact normalized sky/ground linear color channels
and indoor probe shape are unchanged. It does not claim to fix the earlier
unreproduced 15–17 second stalls or to establish device FPS.

The baseline is main `0aeb0c2b4342715ba9a19b976114d7d905fed7bd`. Only
`optional-practice/civilian-fpv/renderer.mjs` changes production behavior. The
world visuals, scenery, physics, collision, course identities and imported assets
remain untouched. There is no multi-entry or shared cache. A lighting change
releases the old target before creating its replacement; low quality still binds
no environment. Loss clears target ownership before notifying the host. A lost
context cannot populate the cache; restoration followed by the existing course
reinstall creates a fresh target. Failed generation leaves no reusable stale key.
Final disposal remains idempotent.

## Qualification in progress

`node scripts/qualify-fpv-environment-light-reuse.mjs` exercises the actual
renderer closure with real Three Color/Scene objects and controlled WebGL/PMREM
allocation. Its 36 checks pass, including equal normalized colors, sub-hex color
differences, quality binding, two independent owners, context loss/restore,
allocation failure/recovery and seven targets disposed exactly once. This CPU
fixture does not prove GPU resource release.

All 30 existing acceptance, world texture and workshop visual checks pass:

```
node --test game/test/fpv-acceptance-workflow.test.mjs game/test/fpv-world-textures.test.mjs game/test/fpv-workshop-visuals.test.mjs
```

The additional objective-label suite has five passes and one failure from its
missing `sharedActorAppearance` VM binding. The exact baseline renderer reproduces
that failure. No new unit coverage or assertion relaxation is included; additional
coverage remains D6. The real WebGL fixture and current-source package admission
are required before publication.

## Frozen browser procedure

After committing the source, run:

```
node scripts/prepare-fpv-environment-light-reuse.mjs BASELINE_SHA CANDIDATE_SHA /tmp/fpv-environment-light-NAME
python3 -m http.server 8858 --bind 127.0.0.1 --directory /tmp/fpv-environment-light-NAME
```

Open `/` and click **Run frozen comparison** in a visible browser with other GPU
work stopped. The immutable manifest binds every imported module. Identical
source files are hardlinked to keep disk use bounded. Baseline and candidate run
sequentially; each has an independent renderer and module closure. Two cycles
cover Yard, Woodland and indoor Warehouse, imported/fallback, same-course retry,
changed bounds, Pixel and a shared visual collection at low/balanced/high. Both
then lose/restore their actual WebGL context and reinstall the course. The harness
uses a fixed 640×360 canvas and device-ratio input 1 for a bounded comparison.

The 73 image pairs must be exact and preserve actual draw calls, triangles and
registered resources. Probe creation/disposal is instrumented at Three's original
`PMREMGenerator.fromScene`; every target must be released exactly once, no owner
may retain more than one, repeated texture/geometry counts must plateau, and the
candidate must create fewer probes. Wall timings are observations under readback
and fixture instrumentation, not hardware/GPU timings. The full receipt appears
in a read-only DOM textarea. Preserve failures and original receipts; do not
weaken comparisons to make a run pass.

Actual browser acceptance and a focused PR remain pending.
