# Exact saved Audio styles: current-main recovery

This recovery extracts the functional and regression-test changes from closed
PR #779, source `2c160ed7e8f291fcc80e35c8fa6192d72ce2dfa6`, onto accepted
main `094f483cb510ae07c494895ec3b1357004619c9d`. It does not restore the
closed aggregate or its divergent production revision 101 / audio revision 53.

The optional public-style selection is stored separately from the historical
exact-key library record, in the same atomic transaction and with its generation.
Older writers conservatively invalidate that selection without changing library
data. Generic Play/Start resolves the saved exact public styles; acquisition,
cancellation, mute and failed-save retry preserve explicit user intent.

Current-main Discovery recording export controls and their cancellation tests
remain intact. The newer bounded catalogue-response and compact Pause tests are
retained rather than replaced by the older donor versions.

## Verification of this composition

- Storage/player/taxonomy cohort: 38 passed, no failures or skips.
- Selected panel/host style and Discovery export cohort: 14 passed, 145 unmatched
  tests skipped. Separate from the first cohort; counts are not added.
- Solo reload and silent catalogue acquisition/retry: 4 passed, 21 unmatched
  tests skipped. Exact FPV Start and Fusion Play retain generation and preferences.
- Changed-module lint, formatting and whitespace checks passed.

These are bounded Node fixtures, not physical, listening, browser, packaged or
full-suite acceptance. Broad suites remain `WAIVED_SKIPPED_NOT_PASSED`.

## Production and publication boundary

Accepted production ledger, compiled manifest/runtime/Studio and producer bytes
remain unchanged. No producer, compiler or full product build was run. Audio
runtime inputs change here; this is not a fresh recipe-fingerprint or generated
production qualification. The accepted-main provenance gap is not silently
repaired by replacing historical inputs or refreshing a fingerprint. Any future
generation must reconcile the complete current source and preserve accepted
production history, rather than adopting the donor's divergent generated files.

Current-main source review, hosted required gates and actual Pages capacity must
complete before publication. #835's lossless packaging correction is independently
qualifying; do not infer sufficient capacity from an inspector's green status.
