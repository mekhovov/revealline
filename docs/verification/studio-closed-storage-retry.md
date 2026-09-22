# Studio recovery after a closed IndexedDB connection

Native source `bd4b0e91`, local8821, reported a closing database connection during
saved-project inspection. Inspection of `createContentDraftBackend` found its cached
open promise survived unexpected close and synchronous transaction
`InvalidStateError`, so later Retry reused the dead handle. The browser-level
cause of the close is not established; the reproducible cache/retry defect is.

Three added finite-IndexedDB regressions failed on the old code. Fix `cc9f6c81`:

- Forget a matching connection on unexpected close or version change.
- If transaction creation synchronously throws InvalidStateError, invalidate that
  handle and surface the failure. An explicit subsequent retry opens storage anew.
- Ignore delayed close notifications from an older connection once a newer one
  exists. Do not automatically replay writes or relax compare-and-swap checks.

The regressions prove a read retry succeeds without new writes; close notification
reopens once without stale-close invalidation; and a save retry still rejects a
newer writer while preserving the original immutable checkpoint. Existing atomic
conflict, write failure, autosave, export/history and checkpoint-restoration tests
also pass: **20/20 on Node20.19.5 and22.22.2**, lint/format/whitespace clean.

Native follow-up at exact `cc9f6c81` used the same origin after server restart and
page reload. A newly saved baseline checkpoint1 could be inspected/restored after
editing a separate study; study checkpoint4 restored separately; project-local
Undo/Redo worked. No warning/error logs on the fixed page. This normal-path browser
check does not replace the injected-close regression, nor prove that an unsaved
failed draft survives reload. Session-only edits still require successful Retry
or backup export before closing/reloading. No user draft or stored checkpoint
was deleted, and no public deployment is claimed.
