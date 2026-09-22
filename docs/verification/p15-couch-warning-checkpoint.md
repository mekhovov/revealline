# P15 couch save-warning follow-up: local checkpoint

22 September 2026. Separate from PR253; not delivery-ready, versioned or published.
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

1. Versus compact pause scrolls Resume to the bottom of the viewport, leaving
   Save options initially below the fold. It is reachable but has not met the
   intended simultaneous visibility target. Review compact menu placement.
2. One native AX Pause click left the visible running state unchanged; Escape
   paused normally. The cause is unproven. Reproduce with actual pointer and
   keyboard activation before acceptance; do not call Pause fully qualified.
3. Complete exact source CI, additional portrait/result/Legacy
   native checks, meaningful warning status transitions and geometry comparison.
4. Real durable retry/export, controller/device/screen-reader/zoom, cross-release
   persistence and independent review remain. No human enjoyment claim.
5. Release-owner scheduling, fresh baseline/version, reviewed PR, immutable
   freeze, Pages publication and exact public verification are all still required.
