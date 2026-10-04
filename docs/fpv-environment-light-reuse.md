# Reuse environment lighting and release graphics ownership before Retry

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
coverage remains D6. The four additional appearance/UI suites report 10 passes and 33 failures;
the exact baseline renderer substitution reproduces identical failure signatures.
These include existing DOM-fixture `null.remove` errors and unavailable
`fake-indexeddb` in archive fixtures. These suites do not qualify this change.

Candidate `083ac67bf68f33a03f01730c80dec39ee98a3654` passes full `npm run validate`,
changed-file lint/format and all three source-bound optional admissions, including
95 committed-input hashes, ZIP membership and two byte-identical builds. Only the
renderer differs among those inputs. The admitted renderer equals the source
bytes. Original inputs total 16,749,138 bytes, leaving 28,078 bytes under 16 MiB on
this baseline; the production edit adds 918 bytes. This does not include later
independent main advances. Actual WebGL acceptance remains required.

## Frozen browser procedure

After committing the source, run:

```
node scripts/prepare-fpv-environment-light-reuse.mjs BASELINE_SHA CANDIDATE_SHA /tmp/fpv-environment-light-NAME
python3 -m http.server 8859 --bind 127.0.0.1 --directory /tmp/fpv-environment-light-NAME
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
in a read-only DOM textarea. The v2 parent retains 12 bounded cycle-two/high
before/after image pairs after renderer disposal, selectable for visual review.
The runner and frozen runtime are byte-identical to v1; the unexecuted v1 fixture
remains preserved. The freezer optionally accepts a prior frozen root as its last
argument, verifies its pins and hardlinks its immutable bytes into the new root.
The reviewed v2 fixture manifest is SHA-256
`30a34c27da281958708a77724a51a808785864b4eac573e1bfddfa755f6c0398`. Preserve failures and original receipts; do not
weaken comparisons to make a run pass.

Actual browser acceptance and a focused PR remain pending.

## First actual WebGL run: rendering parity, restoration hold

The visible/focused v2 run (no visibility changes) produced 72 exact image pairs
with equal draw calls, triangles and registered resources. Independent receipt
analysis also confirms all 36 repeated texture/geometry comparisons per variant
plateau and at most one live PMREM target. Before context loss, baseline allocates
24 targets and candidate allocates 10. Those are allocation observations, not a
wall-time speedup or a fix for the historical stalls.

Both variants subsequently fail `WebGL error free restored/retry/high` after
actual context restoration. The original harness did not retain the numeric GL
error, so the reason is unresolved. Preparation returned true, and final catch
cleanup disposed every allocated target exactly once (25 baseline / 11 candidate),
but this is **not a lifecycle pass**. Publication remains held for diagnosis.

The full original receipt is preserved losslessly as
`docs/evidence/fpv-environment-light-browser-v2.json.gz` (32,825 bytes,
SHA-256 `f10c11005d413245f610b362f2c5c215171dfa3d14f8cf7cdd7c15d7c00f1f4a`).
Decompression produces the original 812,272 bytes with SHA-256
`2c47ca7e19036e8a0eff7c91692b6ef134885719a49af645643a9002a86f3464`.

A separate, bounded restore-only diagnostic keeps the runtime and v2 receipt
unchanged. Four cases compare baseline/candidate with an unconsumed versus
explicitly observed loss flag; raw GL error queues and a bounded API-call trace
identify the failing operation and pre/post-loss handle epochs. Its compact
summary is separate from the full read-only DOM receipt. The [WebGL restoration
specification](https://registry.khronos.org/webgl/specs/latest/1.0/#5.15.3) resets
the GL error state on restoration, so a later error must be measured rather than
assumed to be an acceptable lingering loss flag. Diagnostic browser results are
pending.

## Diagnosed pre-existing Retry cleanup defect and focused repair

The four restore-only observations identify `INVALID_OPERATION` (1282 / `0x502`)
from deletion of GPU handles created before loss. Baseline first deletes its old
PMREM framebuffer/renderbuffer/texture; the reuse candidate had released PMREM
while lost and first fails on other old textures. Explicitly observing
`CONTEXT_LOST_WEBGL` (37442 / `0x9242`) while lost does not change the result.
The trace retains the first 64 failing calls per case; that cap is not an exact
total-error count. All four post-restore images equal their pre-loss hash, but the
GL cleanup check fails. Both real hosts reuse the renderer on Retry: World pauses
at `world-app.mjs`'s loss callback and calls `setCourse` on its existing instance;
Academy likewise retains its renderer. This is a supported recovery path.

The restore diagnostic receipt is archived as
`docs/evidence/fpv-environment-light-restore-v3-browser.json.gz` (13,909 bytes,
SHA-256 `992403bfebbac22a4aef9e4fd5cafed35e1ded6d1496307b7d09845fa6e2d316`).
Its original is 437,880 bytes, SHA-256
`8df577915e0a8deb5a537314b034e2805398b4484fca73a5b943fdc133a9529e`.

Separate runtime commit `acc9ccbfc` factors the existing final scene cleanup into
`clearSceneResources` and invokes it during context loss, while preserving the
Three renderer's restoration listener. It invalidates pending preparation/import
generations, releases owned groups/imports/shadows/ghost/editor/Hunt objects, and
clears the course so no old scene can be prepared or drawn before Retry. The
normal course installation then recreates aircraft at the retained drone/quality,
retains cosmetic and presentation choices, and recreates optional Hunt ownership.
Ghost samples are reinstalled by the existing Retry flow as before. No vendor
patch or ignored GL error is introduced. This repairs a baseline recovery defect
identified while qualifying the cache; it is distinct from the PMREM reuse.

The updated manual qualifier passes 47 checks, including exactly-once disposal of
watched scene objects during loss, no second disposal of those old objects on
later final cleanup, pending compilation invalidation, and same-preset aircraft
and cosmetic reconstruction. All 30 existing art checks still pass. The next
bounded actual-WebGL fixture covers both imported and procedural scenes, visible
models and ghost reinstallation, full aggregate GL error counts (without truncating
the count), and final cleanup. Fresh source admission and actual recovery
acceptance remain pending; the original failed receipts remain unchanged.

## Source admission and recovery ownership follow-up

Source `8a2f700b468998f524027f491458b9049bce022b`, with renderer bytes exactly
`acc9ccbfc21e7f8f5f4a72283ad523a8f62d1fbd`, passes all three package admissions,
95 committed inputs, ZIP members and two byte-identical builds. Original inputs
are 16,749,524 bytes, leaving 27,692 bytes under 16 MiB on the recorded `0aeb`
parent. All 95 input hashes equal the runtime commit; only the renderer differs
from that parent. Full validate also passes. The full audit is retained in
`docs/evidence/fpv-environment-light-final-admission.json`.

The v4 actual browser run compares reuse-only `083ac67bf` with cleanup candidate
`acc9ccbfc`: all four candidate imported/procedural cases have zero aggregate GL
errors, exact restored images, visible rebuilt aircraft and retained cosmetics,
ghost and presentation choices. All PMREM targets and optional Hunt owners are
released once. Baseline still produces 1,073 procedural / 838 imported GL errors.
The candidate fails two overly broad assertions that treated every JavaScript
geometry object as an exclusive single-generation resource. This failed receipt
is retained; it is not relabelled as an all-pass run.

Exact CPU identity tracing with the real world visuals reproduced the browser's
466-object procedural census. Index 146 is Three's shared Sprite quad, used in
world, goal and ghost groups; it emits three disposal events per generation.
Indices 223/225 are Three's shared ArrowHelper line/cone, emitting one per
generation. These same three JavaScript geometry objects are used again after
Retry. Every other old object is disposed exactly once. The pinned vendor's
`WebGLGeometries.onGeometryDispose` removes its listener/cache entry after the
first event; `WebGLAttributes.remove` removes each buffer mapping. Uploading the
shared geometry again creates a new GPU allocation lifetime. A lifetime-wide
"already disposed" set would incorrectly suppress subsequent cleanup.

The separate v5 fixture identifies exactly these three vendor singleton objects
and preserves every original disposal event. It checks owned resources exactly
once and GL buffer deletion by allocation epoch. Both candidate cases pass all
ownership/epoch checks with zero GL errors. All observed handles are deleted
once: 793 per epoch for procedural and 612 per epoch for imported, with no unknown,
duplicate or stale-epoch deletion. These are observed API attempts, not a claim
that physical GPU memory survives context loss. Procedural pixels remain exact.
One imported restored image has a different hash despite identical resource and
model reports; that visual discrepancy remains open for the v6 retained-pixel,
semantic-scene and draw-order diagnostic. No pixel assertion is loosened.

The final normal matrix compares exact `acc9` committed source with the full
admitted `8a2` distribution. It passes all 72 image/draw/registered-resource pairs,
repeat resource plateaus and at-most-one-target ownership; no errors are recorded.
This is source/package parity, distinct from the historical `0aeb`→`083` comparison.
The static AST audit confirms that `acc9` preserves all 35 other named functions
and every operation/order after the two new `setCourse` lifecycle guards. Its
cleanup is the original final-cleanup sequence plus clearing the optional Hunt
reference and editor rows. This scope proof is in
`docs/evidence/fpv-environment-light-healthy-path-audit.json`.

Root review then identified the reachable notebook cosmetic setter while the
scene is cleared. Runtime commit `e76c07374` adds only optional chaining at the
live tint update while always retaining a valid `cosmeticColor`. The manual
qualifier now chooses a valid then invalid color while lost, checks that ownership
stays empty, and verifies Retry rebuilds with the latest valid color. All 48 manual
checks and the existing 30 checks pass. The frozen browser receipts above precede
this one-byte guard; new source admission and actual-host Retry acceptance follow.
No claim of new device FPS or resolution of the historical 15–17 second stalls is
made.

### Lossless receipt archives

All archives use gzip with zero modification time. `gzip -dc FILE.json.gz`
reconstructs the exact original JSON; verify the uncompressed SHA-256 below.

| Receipt             | Raw bytes / SHA-256                                                            | Gzip bytes / SHA-256                                                        |
| ------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| v4 recovery         | 630,827 / `71c4754f1926971db6ddd99f691f7cbbd31be63efb1588b6181d203e97a1bc20`   | 20,762 / `faa3fe0158c77d0a59834b1b4760658bbe1feb9bf9c7f7a5086e6262cdb1cf41` |
| v5 ownership        | 2,004,960 / `fe9c22928df4520dcae89c8900f2e2f230d31df6a7a932bc96089f3e9b9ed5be` | 56,261 / `56bf453f19b84c699a4207aff1366f0eec519fc91f59a4594539261125fcf286` |
| Final normal parity | 853,536 / `459ac5cd3654087a70cfdee0ba0402eb4e3ee1a2886889ab3ff9bd6b2d81ecb1`   | 43,712 / `2f236c7699077ad524ca2222e133280a755ba237d38aeb7f802d801fcfd8bb36` |

Archives are under `docs/evidence/fpv-environment-light-*-browser.json.gz`; the
v4/v5 and final normal harnesses are preserved separately. Larger raw receipts and
immutable local fixtures are not default Pages assets.

## Imported raster follow-up and final cosmetic guard admission

The one-case v6 follow-up, still at exact `acc9`, passes all 19 checks. Both
retained 640×360 images are bit-exact (zero changed pixels) and equal the prior
v4 imported hash. GL errors remain zero; resource reports match. All 601 semantic
nodes have equal geometry, materials, decoded textures, transforms and visibility
when compared without scene-child positions. The first 589 nodes already match
in place; the tail differs because the recreated Hunt group appends after the
lights. Captured draw order changes at 85 positions as material/object allocation
IDs change, yet this run remains pixel-exact. This does **not** establish a cause
or magnitude for the isolated v5 mismatch, whose original receipt has only image
hashes. The v5 observation stays recorded and is not silently converted to a pass.

The full v6 receipt, including lossless retained PNGs, is archived as
`docs/evidence/fpv-environment-light-recovery-v6-diagnostic.json.gz`: 709,027 gzip bytes, SHA-256
`9df39fb59bd7a8cd95805956ee572a55a191c1db917fdb9e77bdd532cec439bb`. Decompression yields 5,573,976 bytes, SHA-256
`7f4904690e568fc4ba9f5ebf3f1632a4fc327be201906c4ea33d1c705d379421`. The bounded analysis is
`docs/evidence/fpv-environment-light-v6-analysis-summary.json`.

Exact source `4f364314378400b22792074d7d0bb6aa292eb044` with the one-byte
`e76c07374` cosmetic null guard passes all three fresh package admissions,
95 committed inputs, ZIP verification and two identical builds. Original inputs
are 16,749,525 bytes (27,691 bytes under 16 MiB
on its recorded parent). Full validate, 48 manual checks and 30 existing checks
pass. The entire admitted 102-file player is frozen for a real host UI
loss/restore/Retry observation; acceptance of that run remains pending.

## Actual host acceptance and final editor lifecycle guards

The admitted `4f364314378400b22792074d7d0bb6aa292eb044` player now has actual
host acceptance: all 102 files verified, actual WebGL loss/restoration observed,
and zero non-loss GL errors or uncaught errors. The operator selected Clearing
check-in, Chase, Utility and authored appearance, then used the normal Menu →
Retry → Arm (0.2 seconds) → Pause flow. The rebuilt Utility was visible at the
pad. Moving focus to the outer loss control paused flight before the loss event;
this does not claim uninterrupted flight through graphics loss. The full receipt
is preserved losslessly in `fpv-environment-light-actual-host-4f3643143.json.gz`
with its raw/compressed identities in the adjacent summary. No physical-device
FPS or historical-stall improvement is claimed.

The final null-path review found that the existing spatial editor retains its
returned pointer/wheel/snap controls after reporting its reload requirement.
Cleared pick/snap/zoom controls now remain inert. A pending editor load captures
the scene generation and cannot install a new gizmo after loss; pending imported
scenes also reject and release ownership. New requests reject while the context
is actually lost. Initial blank editors and ordinary imports before a course
remain supported; a fresh scenery import after restoration tolerates the cleared
course. These are editor/import lifecycle guards, not automatic editor recovery.

Runtime `ec0273520` includes those guards. Integration `adcf64da7` incorporates
published main `47d2019d` and preserves its Lighthouse/Quarry work. The final scope
receipt verifies the entire renderer becomes byte-identical to host-qualified
`4f` after removing only the enumerated editor/import guards and the published
Quarry statements. It also verifies all 95 admitted source inputs against main:
only the renderer differs. Inputs total 16,758,039 bytes, leaving 19,177 bytes
under 16 MiB. All 59 manual ownership/lifecycle checks, 30 existing checks,
changed-file lint and formatting pass. The saved manual/scope receipts are
`fpv-environment-light-final-guard-manual.json` and
`fpv-environment-light-final-guard-scope.json` under `docs/evidence`.

The final admitted editor fixture preserves the existing host's explicit reload
contract. It will verify every admitted file, mount the real spatial editor and
TransformControls, observe actual loss/restoration, exercise the cleared controls,
and check final cleanup and GL errors. Current-source admission and this actual
editor observation remain pending at this checkpoint. Historical failed receipts,
including the isolated v5 imported image-hash mismatch, remain unchanged.

## Healthy editor initialization race correction

Independent review found that using `sceneGeneration` for the pending editor
load also rejected an ordinary course update during initialization. The host
retains its initial `ready` promise, so that rejection could leave the editor
without controls. The guard now captures a dedicated `contextGeneration` that
advances only on actual graphics loss. Normal course changes remain compatible;
a pending editor still rejects after loss, including when the context has already
restored before the loader resolves. Imported-scene generation behavior is
unchanged.

The manual qualifier now passes 63 checks, including both loading races and
final cleanup. All eight PMREM targets are disposed once; the 30 existing checks,
lint and formatting also pass. The context-generation scope receipt verifies
that the entire renderer differs from `a64afef45` only by the four enumerated
counter substitutions. Full validate passed at `a64afef45` before this correction;
current-source admission and the admitted editor browser observation remain
pending. Prior successful and failed browser receipts keep their exact historical
identities. The new bounded evidence is in
`docs/evidence/fpv-environment-light-context-generation-{manual,scope}.json`.
