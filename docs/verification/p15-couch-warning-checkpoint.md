# P15 couch save-warning follow-up: local checkpoint

22 September 2026. Separate source candidate from PR253; not versioned or published.
Parent: reviewed PR253 head `81729fc1ec979a88a7e4950570eae577d32f032e`.
Do not sweep this follow-up into PR253's post-P07 rebase.

## Implemented locally

- Shared presentation-only cue annotates the existing Versus/Team Pause control
  and offers Save options after primary play in the existing paused/result menu.
- Existing persistence, Retry/Export, input, pause and progression owners remain.
  No automatic pause, focus move or dialog on a failed save.
- Versus full recovery moved into race-main, outside the live board grid.
- Team recovery remains in its existing lobby/pause tools; shortcut focuses Retry.
- Background success preserves a focused shortcut until blur; its truthful saved
  action returns focus to existing play controls, without starting play.
- Badge uses `::before`; existing compact music `::after` is preserved.

## Current evidence and retained failures

- Versus host: all 13 cases passed in the restored-fixture broad run, including
  command-earned equal-board clears, Next/Skip and the added recovery/pause case.
  Shared cue: three cases passed. That overall run still failed Team import
  because its tracked `team-entry.js` was absent from the sparse checkout.
- Team full cohort after restoring exact tracked fixtures: **27 passed**, zero
  failed/skipped/cancelled, 183702 ms on Node 20.19.5. Includes twelve consecutive
  clears, failure/retry, exported progress, successful save focus restoration,
  two-action Skip and modeled controller recovery. Together the separate bounded
  runs establish 43 passing cases; this is not the full game suite.
- Initial broad run encountered missing Horizon/Border original pictures and
  was stopped after failures. A later run additionally exposed missing compiled
  starter-picture fixtures. These sparse-environment failures are not hidden.
- The new Versus test initially mistook a prepared run's `running` status for an
  admitted running match, and then expected per-board status to encode match
  pause. Corrected synchronization waits for the enabled Pause control and checks
  match UI plus both unchanged authoritative checkpoints over 30 paused frames.
  Product timing and pause logic were not changed to satisfy the test.
- Scoped lint and diff checks passed. Complete exact-source CI remains required.

## Native source diagnostics, not frozen/public qualification

Isolated localhost 8948 uses captured candidate files over accepted 0816c805 Git
blobs. Only Journey's backend is replaced by a deliberate refusal; no simulation
state injection. Team supplies a backend explicitly, so the initial Solo-only
refusal did not affect Team. The corrected diagnostic substitutes both modes'
backends (diagnostic profile SHA256
`221ce76a811de86628ef14b72d85838bf948dac7943a0fbe3a08a02659714c5d`).
This diagnostic module is not part of the shipping changes.

- Versus 600×400: live amber Pause badge visible; music caption intact; full
  recovery has zero live bounds. Escape pauses both boards. Save options focuses
  existing Retry without resuming. No browser warning/error logs observed.
- Team desktop and 600×400: live badge visible with compact music caption intact.
  Escape retains Resume as primary; compact Save options is visible below it and
  focuses existing Retry while the arena remains paused. No warning/error logs.
- All temporary tabs closed, viewport reset and diagnostic server stopped.

## Open issues / gates

The initial two source issues were followed up rather than waived:

1. Versus compact pause scrolled Resume to the bottom, leaving Save options
   below view. The existing transition-owned focus now centers primary play only
   in paused/results main menus with a visible save shortcut. Ready entry, Legacy
   and other controls retain nearest scrolling; status changes never focus or
   scroll. Native 600×400 shows Resume at y174.6–225.3 and the full warning at
   y229.3–279.0. At 320×568, they occupy y258.7–309.4 and y313.4–392.8. A temporary
   broader centering candidate exposed late initial-layout focus below view;
   centering was consequently restricted to paused/results, not initial entry.
   This does not claim full cold-launch/font-loading qualification.
2. Intermittent native Pause failure reproduced with both AX and pointer clicks.
   Temporary source tracing captured pointerdown and pointerup on race-pause
   while running, but no click event or Pause handler. The shell unconditionally
   replaced its unchanged label every frame. A regression test failed because a
   label child was detached between pointer edges. Using its existing `setText`
   helper preserves the label; the regression passes. Five consecutive traced
   native cycles and three uninstrumented cycles then paused successfully. This
   supports the DOM-churn correction, not universal hardware/browser proof.

Final expanded cohort: **72 passed**, zero failed/skipped/cancelled, 76872 ms
on Node20.19.5 across couch-shell, resize-focus, initial-focus, candidate-versus
and shared cue tests. Together with the unchanged Team cohort, 99 distinct
focused cases pass. An additional Ready-versus-paused scroll-policy assertion
passes separately in its focused case. Initial red tests and sparse failures
remain recorded above. Scoped lint/format/diff checks pass.

Final uninstrumented native result: ordinary keyboard down-cuts produced a
Sunflower win at 34.3%, three lives and 8160 points; Skyline remained 0%, three
lives (sequential inputs, not a simultaneous tie claim). Rematch and Save options
were visible together, with Next visible in the sticky Journey row. Save options
focused Retry; a refused retry retained the result; one Next opened Choose your
share. Portrait running badge and subsequent pointer Pause worked. No warning
or error console entries. The final shell SHA256 is
`939be9744c7befd606fdc5cfb4c4b1f89f6394c3b77f1e8726806e5f271576f7`.
Pointer tracing and the refused backend are diagnostic-only, not shipping code.

## Additional independent review and native recovery

Independent review of source `a37a651bce4ed8263943ae44a84257b4adff60f0`
against parent `81729fc1` found no actionable regression. Six scoped Node20
checks passed independently: three cue checks, stable Pause gesture, Versus
recovery, and Team failed-save/export/successful-retry preservation. Fifty-seven
unmatched host cases were intentionally filtered; this is not full-suite proof.

The same unchanged source was inspected on isolated localhost8949. A diagnostic
gate rejects Journey backend operations until explicitly restored, then delegates
to the actual browser IndexedDB backend (including Team's supplied backend).
Diagnostic profile SHA256:
`a115819ef5cef14b7e835be9c2e962d63f62a3e6e70c99ceddfbe05597884644`.
No simulation state, completed mission or browser storage was injected. This
tests recoverable refusal, not recovery from actual disk exhaustion.

- Versus: an ordinary down-cut earned First return at34.3%, three lives,
  8160points while saving was refused. Save options focused Retry. Restoring
  backend availability and activating Retry reported saved locally, retained
  Retry focus and left the result intact. One Next started the next mission.
  Reload retained Choose your share; the chooser showed First return Cleared.
- Team: two-action Skip moved Twin landings to Stepping exchange without a
  clear. An initial Escape while the transition was pending correctly cancelled
  it; the repeated deliberate transition was allowed to settle before Pause.
  Save options focused Retry. After backend restoration, Retry removed the
  warning and returned focus to Resume together without starting play; elapsed
  time remained0:06, coverage0.0%, reserves2. Reload selected Stepping exchange;
  the chooser marked Twin landings Skipped and Stepping exchange Not cleared.
- Legacy: bare Versus opened Orchard Crossing; native Start, pointer Pause,
  explicit Resume and Escape Pause worked without Journey recovery controls.
  Its existing Team link and discard confirmation opened First Connection.
  Team Start, pointer Pause, Resume and Escape Pause likewise remained explicit,
  with no Journey controls. This is the existing bare-entry behavior, not the
  separately planned current/legacy alias implementation.
- Team browser warning/error log was empty. Both test tabs were closed and the
  diagnostic server stopped. No product source changed for these checks.

Remaining gates:

1. Complete exact source CI, broader Legacy and cold-entry native checks,
   meaningful warning status transitions and geometry comparison.
2. Native export/file recovery, real storage-exhaustion recovery,
   controller/device/screen-reader/zoom and cross-release persistence remain.
   The bounded same-origin durable retry/reload and independent review above
   do not establish those broader gates. No human enjoyment claim.
3. Release-owner scheduling, fresh baseline/version, reviewed PR, immutable
   freeze, Pages publication and exact public verification are all still required.
