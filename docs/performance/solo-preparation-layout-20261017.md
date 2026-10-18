# Solo prepares its eventual layout before play

The ordinary Solo host previously prepared its board and quiet cadence while
`data-flight-state` was `briefing` or `paused`, then published `running`. The
handheld portrait, short landscape, music, full-chrome and feedback rules changed
board geometry only at that last step. A subsequently delivered canvas
`ResizeObserver` notification invalidated an already granted prepared board.
The display width used by the painter could therefore describe the earlier
layout. This is a demonstrated readiness ordering gap; it does not identify the
cause of the retained WebKit 307 ms interruption.

The host now gives the current Start/Resume attempt a presentation-only layout
lease. The same CSS geometry and eventual touch-control reservation apply before
board preparation, while the real flight state, clock and input scope remain
paused. Touch controls stay invisible during preparation; the existing command
and cancellation surfaces retain ownership. The lease ends after the real
running HUD has taken over the same geometry, or immediately on cancellation,
blur, hidden state, context interruption, replacement or page retirement. An old
attempt's finalizer cannot remove a newer lease.

Displayed width and height are reconciled at the paused activation and prepared
submission boundaries. A late size change requires another prepared submission;
a delayed observer notification for an already reconciled size does nothing.
Cancellation reconciles the restored paused geometry. Existing window-resize
invalidation remains intact. No geometry read was added to the normal active
frame loop, and the simulation clock, quiet-cadence baseline, 250 ms interruption
threshold and replay rules are unchanged.

The CSS audit covers all 170 running selectors in the six ordinary Solo layout
files. Reversing the same-specificity aliases and the explicit preparing-control
and paused-width exceptions reproduces the prior canonical CSS exactly; all
existing declarations remain unchanged. Ordinary Solo does not mount the
`runtimeContent`/`editionId`-owned edition layout. Its separate CSS is excluded.
The shared optional FPV shell's existing journey CSS projection was regenerated
with `refresh-fpv-play-shell.mjs`; no original FPV worktree was touched.

Evidence is retained under `.cache/solo-followup/solo-running-layout-audit/`.
`host-control.tap` first demonstrated the old invalidation on actual Start and
Resume. The same new regression against the verified original app fails with a
360 px cached width versus a 320 px eventual width (`before-regression.tap`).
The original app is 595,894 bytes, SHA-256
`b8d0c1044789a2289320043994a8a77112047aeb1706264f6b0dd3291969de99`.
The first complete nine-file group passed 71 tests. The final ten-file group
passed all 83 tests in 134.05 seconds, including the existing pause-layout
contracts and immediate cancellation reconciliation (`complete-v2.tap`). Scoped
lint, formatting and canonical shared-shell verification passed. An initial touch-control test fixture
used a nonexistent flat checkpoint field; that failed receipt remains retained.

These host tests use the actual app, preparation and Phaser submission owners,
with an explicitly modeled CSS-size/observer boundary. They prove ordering,
lease cleanup, late width/height invalidation and input preservation, not native
browser layout, compositing or device timing. A successor native observation must
compare actual prepared and first-running dimensions and layout attributes on
its exact package. The next Appearance gate includes the complete new host file
(118 files); the running 117-file producer remains attributed to its earlier
source.
