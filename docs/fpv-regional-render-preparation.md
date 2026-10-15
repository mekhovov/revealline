# Regional graphics preparation before adoption

This increment extends the continuously streamed, explicitly unscored regional review host. It does not promote a region into the player catalogue or change World.v1 physics, scoring, recordings, source hashes, collision geometry or package limits.

## Runtime boundary

All three verified geometry owners accept an optional trusted `prepare` callback. It receives the detached, already verified candidate group and may await graphics preparation. The old committed frame remains queryable in continuous mode. Once preparation finishes, the owner samples the current body pose and performs the final support/overlap checks before the existing synchronous commit/rollback boundary. A callback cannot return replacement geometry. Cancellation, failure, stale generations and disposal release staging without publishing it.

The regional flight runtime passes an AbortSignal to the shared production renderer for both initial preparation and continuous background transitions. Pause aborts background preparation; explicit cancellation, replacement and disposal abort their corresponding operations. Simulation ticks do not await graphics preparation. Movement still stops before unavailable collision data rather than travelling into unknown geometry.

## Shared renderer work

The existing production renderer prepares detached scene copies in batches of at most eight renderable objects and 512 KiB of geometry buffers. An individually larger verified object occupies one batch; its size remains bounded by the existing source/geometry profile. Copies share the candidate's exact geometry and materials; no second geometry or physics authority is introduced.

Each batch compiles the visible framebuffer shader variant against current lighting, compiles its offscreen variant and submits geometry through a disposable 1 × 1 render target. A frame yield separates batches. The current visible scene continues rendering. The callback restores render target, cube face, mip level, viewport, scissor, clear flags and shadow-update flags before awaiting or returning. It borrows current shadow inputs without rendering a second shadow map. It checks context, scene, presentation and quality generations, has a 30-second preparation timeout and cleans up its target, listeners and callbacks on failure or cancellation.

Receipts distinguish compilation wait, CPU upload submission and elapsed renderer preparation. They explicitly do **not** measure GPU completion. This work reduces first-use preparation at adoption; it does not guarantee hitch-free rendering, eliminate source/geometry CPU costs or prove hardware frame rates. Shadow-map generation and other ordinary visible-frame work remain the existing renderer's responsibility.

No additional shipped runtime module is introduced. The Worlds source envelope remains 156 files / 20 MiB; exact package qualification remains a separate cloud artifact check.

## Verification

The actual pinned Three/Rapier fixtures passed:

- **9 continuous checks:** includes 2,200 accepted ticks through four crossings/five origins with exact shared-body parity; old queries during delayed preparation; a fresh body-pose rejection after preparation; rejected shader preparation; forbidden replacement; twenty accepted flight ticks while graphics preparation waits; pause/cancel/dispose aborts and releases staging.
- **14 frame transaction checks:** terrain and scenery preparation precede adoption; cancelled preparation retains old queries and frees staged geometry; existing adoption/rollback/generation checks remain intact.
- **6 manual flight checks**, **8 mixed-owner checks**, and the real Urban production-session check in both flight modes.
- Scoped lint, syntax and whitespace checks. No proof fixture or threshold changed.

The authoring-only `authoring/fpv-worlds/regions/renderer-preparation.html` uses the shared production renderer, actual verified mixed owner and the Urban mixed-r2 fixture. It offers Load, Stage neighbour, Cancel and Release; it has no simulated flight or scoring authority.

Native browser review on local origin 9034 observed:

| Operation             | Objects / batches | Geometry submitted | Compile wait | Upload CPU | Renderer elapsed |
| --------------------- | ----------------- | ------------------ | ------------ | ---------- | ---------------- |
| Initial verified area | 59 / 8            | 260,472 B          | 173.7 ms     | 11.9 ms    | 235.4 ms         |
| Neighbouring area     | 71 / 9            | 543,756 B          | 1.9 ms       | 1.8 ms     | 82.2 ms          |

The neighbouring operation's largest batch was 306,288 B. Its current scene continued rendering during preparation. The study counted 103 visible frames across the **whole source, geometry and renderer operation**, not across the 82.2 ms renderer interval; those values must not be divided to infer FPS. The final study receipt labels the counter scope and supplies a separate whole-operation elapsed time.

Native Cancel retained the previous 543,756 B scene and rendering continued. If cancelled before renderer preparation starts, the final receipt now reports no renderer preparation for that attempt instead of showing an earlier successful receipt. Native Release reported zero committed and reserved geometry. No browser errors were observed. These are measurements from one browser workload, not mobile/controller hardware or broad performance qualification.

## Remaining admission work

Immutable regional content delivery, normal catalogue selection, offline regional data installation and full player qualification remain outstanding. Runtime installation alone does not make separately fetched region sources available offline. Continuous streaming and this preparation boundary must be qualified against the next exact package independently of the earlier frozen 9033 candidate. Public catalogue availability is still gated on that delivery and qualification work.
