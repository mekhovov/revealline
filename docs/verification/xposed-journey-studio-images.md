# P02 Studio — manual image-to-map workflow

20 September 2026. Candidate source on `codex/xposed-journey-p02`, draft PR175.
This is not a completed phase, released feature or automatic image tracer.

## Implemented

Studio accepts a local static PNG/JPEG/WebP reference, bounded to 4 MiB original
bytes, 8192 pixels per side and 16 megapixels. Header checks precede decoding;
browser dimensions must match, failures/timeouts leave the previous reference
intact, and late decodes cannot replace a newer picture or another mission.
No image is uploaded to a server, added to a published asset catalog or executed.

Authors crop in original pixels, display the crop underneath the 72×36 board,
and queue rectangles using the existing cell coordinates/surface controls.
Foundations, walls, slow field and lethal field are explicit choices: colors in
the image never infer collision. Gameplay markers remain opaque over the image.
Non-2:1 crops stretch to the board; the interface states this explicitly.

Inspect compiles the entire proposed project and all supported mission modes /
three difficulty presets. The candidate canvas uses the same capture inspector
and map painter, including frozen enemy anchors, remote fills and diagnostics.
Exact Solo Practice can run before Apply without changing the active draft.
Apply requires the same inspected source, mission, queue and crop, revalidates,
then makes a copy-on-write map revision. Other consumers and historical maps are
preserved. Existing undo, checkpoint autosave, conflict checks and project export
cover the applied map. Failed inspections cannot partially change it.

The reference picture, crop and **unapplied** queue are session-only, clearly
labelled and cleared on mission changes. Pending rectangles trigger the browser's
leave warning. They are not included in project backups or crash recovery; keep
the original reference separately. Durable tracing sessions and assisted tracing
remain follow-up work, not claimed as implemented.

## Verification

- Seven focused tests cover byte/type/header/decode failures, timeout disposal,
  crop bounds, all-preset/mode compilation, shared-map preservation, undo/redo,
  explicit Apply, stale draft/crop invalidation, latest-upload ownership and
  failure recovery. No reference bytes enter exported map data.
- The final expanded content/foundation/Horizon/Border run passed **110/110**,
  no failures, skips, cancellations or todos. Exact committed-source hosted CI
  remains separate; this local run includes the preserved pending P01 artwork.
- Full lint/format and whitespace checks passed after the race regression.
  Source validation reports version 0.70.0, 701 source files and the same four
  navigation warnings.
- Native Studio restored the owned Border checkpoint, exposed the labelled image
  workflow, correctly disabled crop/queue/preview/Apply before a picture, and
  reported no console errors. Browser file-chooser upload/decoded rendering and
  end-to-end native tracing are **not** claimed by this check; decode/controller
  behavior currently has the automated coverage above.

No human playtesting, physical-device acceptance, public Pages availability,
immutable release qualification or automatic image interpretation is implied.

## Integrated workbench follow-up

P02 now merges the current P01 candidate through `3556e257` (merge `fe137d77`).
This carries the shared Team compiler/Studio template/export, Solo/Versus hosts,
original Horizon art and recovery changes; it is not accepted-baseline or release
approval. The import conflict was resolved by preserving both image-workbench and
Team/preset imports. The initial integrated compiler/Studio/Team cohort passed25/25.

Native inspection in the retained older P02 tab found that Undo restored geometry
but left an obsolete Applied message. A second regression proved that changing
difficulty left the old frozen inspection visible. Both tests failed before the
fix and pass now: source/preset changes retire the status/inspection without
discarding queued rectangles; Apply still requires an exact new inspection.

The integrated image/Studio/Team/Border cohort passes **52/52**, including all84
complete Solo routes with replays and84 paired-board repetitions. This is scoped
feasibility, not human pacing or full hosted qualification.

Fresh native current-source check at port8779, project `image-workflow-current-check`:
uploaded the existing original first-return PNG; manually queued a5×4 foundation
at(40,20); inspection showed45foundation/2335earnable cells while the draft kept25.
Switching Standard→Gentle hid the old inspected canvas, disabled Apply/Play and
retained the queue. Reinspect→Apply showed45foundation cells and a private revision.
Undo restored25foundation cells and truthful No geometry is queued status. No
console errors. The separate retained port8778 P02 observation also exercised
crop(200,100,1200,600), actual Practice first closure0.6%/150points/3lives and
Apply→Undo35→55→35cells; it is not an exact integrated-source runtime claim.

Source worktrees remain isolated; the P01 server and user/paused tabs are unchanged.
Historical evidence is sparse locally to preserve disk capacity, so full historical
admission/build checks must use a complete hosted checkout. Durable tracing sessions,
assisted tracing, public deployment and human/device qualification remain open.
