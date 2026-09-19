# Initial presentation recovery

A failed initial shared artwork/font load must be recoverable in the current Team visit. **Retry picture** retries that failed load, then prepares the exact selected arena picture. Readiness never starts or resumes a game. Both First Connection and Relay Yard follow this contract.

`mountPresentationPage` leases expose a current `ready` promise and an explicit `retry()` operation. Concurrent requests join one pending host load. A successful snapshot is retained: `retry()` never refreshes an accepted release or replaces its resources. Failed/empty hosts are retired before a new attempt. Closing the last lease prevents late application, painter adoption or status updates; one closing lease cannot cancel another owner's load. BFCache suspension preserves ownership until actual disposal.

The Team picture operation retains its existing selection, generation, cancellation and focus fences. Cancelling the picture operation stops its adoption and focus return; the shared page load may finish for other consumers. A fresh deliberate Retry can reuse that prepared snapshot. It does not change picture bindings, pack hashes, difficulty, saved data or progression.

Auxiliary page wrappers forward the current readiness promise and restart their loading notice after an error. Team applies the recovered snapshot to automatic menu appearance, including when picture adoption was cancelled; this changes no accepted gameplay or image identity.

Status callbacks can synchronously start another retry. An obsolete error must not overwrite the new preparing status or notify remaining listeners after that replacement begins. Independently pinned painters are never replaced by recovery.

## Verification

Mounted regressions exercise both real Team arena choices, initial load failure, repeated failure, successful retry, held retry cancellation and exact later picture adoption. Page lifecycle tests cover shared requests, accepted snapshot retention, independently pinned painters, lease closure, BFCache, observer reentry and failed-host disposal. These tests use the actual host with bounded DOM/image fixtures; they are not browser layout, physical-input or offline certification.

Native qualification should fail an actual first compiled manifest or presentation dependency request, use the visible Retry picture action, then verify the same arena becomes ready and only explicit Start begins play. Repeat with cancellation and restored availability. Retain the failed request and successful retry evidence separately.

This recovery feature does not introduce the later required-art policy for fresh curated Solo/Versus attempts, remove approved procedural content, change historical picture restoration, or complete P01/P08-A. Those requirements retain their separate acceptance gates.

## Maintenance prompt

> Verify initial presentation recovery after changing the shared page loader or Team picture preparation. Make the first resource load fail, restore availability, and activate the real Retry picture control for both starter arenas. Require a new shared load, unchanged arena/setup, visible progress, and readiness without automatic Start. Cancel a held retry and verify late completion cannot adopt a picture or steal focus. Preserve accepted snapshots, exact picture pins, independently owned painter state, final-lease cleanup and BFCache. Test callbacks that retry synchronously during error status. Report modeled, native browser, physical-device and public/offline evidence separately.
