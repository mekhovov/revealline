# World host explicit disposal

The final runtime is `d9ad2561ee1d7685ef97961478b7de30278c1e48`, based on
published main `72d6661b117e1cf1d76ac5de44381685c63d19b9`. Its only production
change is `world-app.mjs`, SHA-256
`6bd30bcd11caa83ccdb36d9bb7c826a9735b5d4549bb49008494921a6a0ba4cc`.
This fixes explicit host teardown; it does not change flight handling, content,
renderer ownership, package limits or the ordinary course-transition flow.

## Behavior

Disposing the host in its lobby used to remove the play shell before menu
navigation cleared its hint. The hint callback then appended to a missing
`main`, rejecting disposal and leaving four storage connections open. The
active-flight context did not reproduce that particular exception.

A separately reproduced native IndexedDB recovery-write abort rejected before
cleanup in both the original host and the initial ordering-only fix. It left a
live renderer with 154 geometries, 119 materials and 34 textures, four open
database connections and one scheduled frame. Previously saved recovery data
survived the failed transaction, but the host resources did not close.

The host now caches one disposal promise, marks itself disposed before queued
callbacks, cancels notebook hydration and waits for host readiness to settle
before removing its DOM or closing dependent stores. It performs one explicit
final recovery save. Cleanup runs even when that write rejects, and the original
write error remains the disposal result. Concurrent and repeated calls share the
same operation and rejection. Failed recovery is neither cleared nor reported as
saved. Menu navigation closes while its hint target still exists.

The disposal flag suppresses only disposal-time background recovery scheduling
and late error callbacks into the removed host UI. The ordinary pause still
saves recovery. An already queued error callback no longer attempts to update
detached status nodes; callers still receive an explicit disposal-save failure.

## Verification

- Full `npm --logs-max=0 run validate` passed on the integrated runtime before
  the final 26-byte disposed-error guard. That guard adds no content references;
  final syntax, focused lint and the affected existing terminal-Retry check pass.
- Existing physics and notebook checks: 25 passed. The existing World appearance
  suite passed 11 of 12; its pre-arm focus assertion fails identically when the
  exact unchanged main host is substituted through a read-only module loader.
  The same baseline also reproduced a late post-Retry status-node rejection.
  The final disposed-error guard removes that rejection; the isolated existing
  terminal-Retry check passes without asynchronous error activity. No assertion
  was weakened or new unit coverage added.
- The first local UI invocation could not resolve `fake-indexeddb`. Subsequent
  runs used the already installed pinned authoring dependency via `NODE_PATH`;
  no dependency was downloaded or changed.
- Frozen source v4 passed **83 checks across nine actual-browser cases**. It
  covers healthy lobby/flight teardown, concurrent/repeated disposal, failed and
  already pending recovery saves, retained prior recovery, and delayed native
  database-open/session-read delivery. Candidate storage, owned GPU resources
  and scheduled callbacks all close; observed Rapier worlds free exactly once.
- All three packages pass source-bound admission with **two identical builds**,
  committed input verification and ZIP member admission. The final World package
  has **95 original inputs, 16,770,740 bytes**, leaving **6,476 bytes** below the
  unchanged 16 MiB limit. The runtime change adds 742 bytes on current main.
- The complete **102-file admitted player** was extracted and checked against
  every manifest member. Ninety-seven immutable files were reused by verified
  hardlinks; five files required 559,631 new bytes.
- Final admitted-package browser v5 passes **94 checks across ten cases**, with
  an empty error list. This includes the nine source lifecycle cases and immediate
  Arm-to-dispose while asynchronous preparation may settle. Failed writes retain
  the prior saved prefix and original rejection identity; repeated disposal is
  inert, all measured resources close, and delayed hydration produces no detached
  DOM errors. The [actual fixture screenshot](evidence/fpv-world-disposal-packaged-browser-v5.png)
  and lossless receipt are retained. This is a local actual-player lifecycle run;
  deployment remains separately verified.
- The complete normal admitted player also passed a fresh-tab **Clearing
  check-in** render, Arm through **0.2 seconds** and Pause with empty warning/error
  logs. The [observation](evidence/fpv-world-disposal-normal-player.json) and
  [screenshot](evidence/fpv-world-disposal-normal-player.png) retain the earlier
  **Lift and land** briefing attempt separately: browser transport reported
  target-closed/focus-emulation timeouts, so that legacy launch is not counted
  as passed and no runtime cause is inferred.

The source receipt identifies the earlier `f31ef625…` host and pre-Solar fixture
modules. The final package adds only the bounded late-error guard to that host
and incorporates published Solar rendering. The package fixture uses all 102
admitted files with zero source overlays; its manifest makes that distinction
explicit. Historical source evidence is not relabeled as a new run on main.

## Retained diagnostics and reproduction

[Evidence provenance](evidence/fpv-world-disposal-provenance.json) records raw
lengths and SHA-256 hashes for lossless gzip archives. Restore with
`gzip -dc FILE.gz > RESTORED` and verify the recorded uncompressed hash.

- v1 reproduced the baseline lobby failure and healthy candidate cleanup. Its
  eleventh assertion incorrectly expected the same failure in active flight;
  that assertion failed because baseline active-flight cleanup already worked.
- v2 corrected that fixture expectation and completed 43 diagnostic checks.
  Both original and ordering-only candidates still leaked resources on a native
  recovery-save abort. This was a diagnostic success, not cleanup acceptance.
- v3 was not browser-run: a static audit rejected attempted reassignment of the
  frozen Rapier export. v4 transparently observes its writable prototype methods
  without changing vendor source or simulation behavior.
- v4 retains the complete 83-check source result. Later packaged qualification
  adds immediate Arm-to-dispose to exercise asynchronous preparation callbacks.

The manual preparer is
[`prepare-fpv-world-disposal-verification.mjs`](../scripts/prepare-fpv-world-disposal-verification.mjs).
It requires a unique output path, an exact complete-player receipt and a local
baseline commit. `--candidate-kind source` freezes explicit source overlays;
`--candidate-kind package` retains admitted bytes exactly. The harness uses real
WebGL, native IndexedDB and the real host. Only isolated database/settings names,
bounded failure/delivery observation and externally delivered RAF timestamps
belong to the fixture. The real performance clock and pause guard are unchanged.

No hardware FPS, universal raster determinism, full device matrix or public
availability is claimed. Protected CI/merge and deployed-player verification
remain separate publication steps.
