# Practice history selector repair — cache-only successor

Root observed Practice → home → Display Plain/Standard/reduced → browser Back load the correct body preferences, but leave the host size selector at its old Large value. A new child session was observed; this is not a confirmed BFCache finding.

The existing display subscription runs only when the owner notifies. History can restore the form value without a change event, including after `pageshow`, so neither ordinary subscription nor immediate-only resynchronization is sufficient.

`history-restoration.patch` changes exactly two paths against the current integrated e674+c79 candidate (input hashes in `handoff.json`):

- `game/ui/tool-display.mjs`: reconcile from `preferences.snapshot()` on pageshow and once in a cancellable zero-delay task. The callback rereads current owner intent. It does not save, read a restored selector as intent, affect focus, or operate the child game. Repeated show coalesces work; pagehide/disposal cancels it. The preference owner's earlier pageshow listener still governs persisted refresh and unsaved local intent.
- `game/test/tool-display-restoration.test.mjs`: seven new regression scenarios using the real display/preference owners and explicitly modeled history/task boundaries. They cover restoration before/after both pageshow forms, changed shared authority, failed-save ownership/warning, newer explicit choice, coalescing/departure and disposed callbacks.

## Bounded verification

Final expanded cohort: **61/61 tests on each of Node 20.19.5 and 22.22.2**, with 1024 MiB and test concurrency 1. It includes all three complete files: the new restoration regression, existing display-preferences, and existing practice-playground-display tests. See `runs/three-file-node20/receipt.json` and `runs/three-file-node22/receipt.json` plus original stdout/stderr. The earlier 38/38 two-file formatted runs remain preserved. The unchanged parent has 1/7 passing: four behavior discriminators and two lifecycle/task assertions fail; these are not six separate player defects. See `runs/parent-final-node20/`.

The complete host-display cohort uses 308 unchanged text dependencies (3,990,006 bytes) from the already pinned exact822f+e674+c79 fixture, recorded in `expanded-inputs.json`; the candidate display runtime remains the only changed production body. No large media or full fixture was copied. Earlier preformat runs remain unchanged. Formatting used the exact 822f prettier configuration retained as `prettier.original.json`. Existing source, index, version, browser and remotes were not changed. No full build or broad suite ran.

## Root integration / native check

1. Recheck the runtime preimage SHA in `handoff.json`, then apply the two-path patch to the current integrated candidate (not directly to bare 822f).
2. Re-pin/restart the served candidate and repeat the actual Practice → home → Display Plain/Standard/reduced → browser Back journey. Confirm body policy AND the host size selector agree; repeat the reverse explicit Large choice. The root owns actual child state observations and browser provenance.
3. Preserve earlier native failure and focused modeled proof separately. This packet does not establish BFCache, physical device, full release or phase acceptance.
