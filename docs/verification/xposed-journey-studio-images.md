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

The original session-only implementation is superseded by the durable tracing
follow-up below. Tracing remains separate from project backups and runtime maps.
Assisted tracing remains follow-up work, not claimed as implemented.

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
admission/build checks must use a complete hosted checkout. Assisted tracing,
public deployment and human/device qualification remain open.

## Durable tracing follow-up

`ContentImageTraceV1` retains the original bounded embedded reference bytes,
accepted crop, visibility and up to128 manually queued rectangles. It carries
project/mission/exact map identity but no preview, Apply or publication authority.
Malformed fields, remote/executable URLs, oversized files and decode mismatches
fail closed. Portable reads and image decode have bounded timeouts.

A separate local IndexedDB database saves per-mission tracing revisions. Autosave
coalesces edits during a write. Revision compare-and-swap rejects stale tabs;
explicit clears retain revision tombstones. Failed/uncertain writes retain the
session and require rereading the head before explicit replacement. Changing
missions never clears the previous stored trace, and late reads cannot update the
wrong mission's recovery controls. Pending work remains exportable, including an
unsaved prior mission's in-memory draft after returning to that mission.

Saved tracing is offered, not silently restored over current work. Backup import
inspects before explicit Restore. Restore decodes through the same bounded loader,
requires the exact matching map, rejects late results after edits/mission changes,
and always disables Play/Apply until a fresh geometry inspection. Pre-Apply traces
cannot be replayed onto a post-Apply map after a crash between independent saves.
For a mismatched trace, restore its matching project checkpoint first.

Native current-source check on port8779, project `trace-recovery-native-check`:
uploaded original first-return.png; accepted crop(200,100,1200,600); queued
foundation(40,20,5,4); observed tracing revision3 while project checkpoint1 stayed
at25foundation cells. Reload retained revision3 but did not automatically load
the picture or change the map. Explicit Restore recovered crop and queue with
Play/Apply disabled. Inspect showed45foundation/2335earnable cells; explicit Apply
saved project checkpoint2 with45cells and tracing revision4 with zero queued
rectangles. A second reload/Restore retained45cells and an empty queue, proving
the applied rectangle was not repeated. No console errors were reported.

This checks the actual local browser persistence and manual Apply path, not native
file-dialog export/import at that checkpoint, physical devices, full phase acceptance
or public Pages. The later portable-backup check below closes the scoped file-dialog gap.

The integrated image/recovery/Studio/structure/Team/Border cohort passes **82/82**
(16.0 seconds), including all84 complete Solo routes/replays and84 paired-board
repetitions plus the six Team route variants. New regressions cover storage
transactions, conflicting writers, clear tombstones, coalesced saves, failed save
retry, late mission reads/decodes/imports, separate portable export, fresh Apply
authority and exact-map crash protection. Full source lint and changed-file
format/whitespace checks pass. Local full source validation is not claimed: the
capacity-preserving sparse checkout omits required historical build assets;
complete-checkout hosted qualification remains the exact-source gate.

## Native portable-backup follow-up

The same owned `trace-recovery-native-check` project exported an actual
3,155,934-byte tracing JSON file. Its SHA-256 is
`20057c2df51bcb0e3c6ea3fa06f877d28ab54c68f82208fcf7b4f9fd17ec9a8a`.
The strict portable reader accepted the project/mission/map binding and crop
(200,100,1200,600), visibility and empty geometry queue. Its embedded 2,366,738-byte
reference matches the committed original first-return PNG byte for byte (SHA-256
`3acf496d9a6bc9db2f83ac01d8255223b3913e7ae0a157e48559ac981c80b95d`).
The browser download-event wait timed out, but the actual exported file was
independently verified; the UI only reported Download requested.

Native file-chooser import inspected that backup without changing geometry. After
changing the current crop X to 250 and saving tracing revision 5, explicit Restore
returned X to 200, retained the empty queue and kept Play/Apply disabled. The map
remained at 45 foundation cells and project checkpoint 2. Explicit replacement of
saved tracing then produced revision 6; no geometry Apply occurred. The exported
test backup remains available in Downloads. This verifies the local file-dialog
backup loop, not another browser/device, release availability or human validation.
