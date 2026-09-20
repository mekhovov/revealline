# Authored opening: actual paired-board Versus host

PR172 source candidate, v0.69.0. Not a published or human-validated phase.

## Scope

`game/couch/?journey=opening` uses the existing `createDuel`, paired-tick
coordinator, controller assignment, race results and renderer. The shared
compiler resolves ten opening missions at three presets; each race retains
canonical Scout, the exact authored theme, one verified/decoded original shared
by both boards, equal seed/rules, and independent player state. Ordinary Versus
and existing releases are unchanged. It does not substitute Solo Practice.

Next and the flat searchable chooser atomically prepare the new race and image
before retiring either current board or its picture. Failed/stale/cancelled
loads retain the current race. Two-action Skip grants no clear. Nine core
missions continue across campaign boundaries; the Remix is voluntary. Ending
the route never claims skipped missions were cleared. Time-decided races remain
valid Versus results but grant no mission clear unless a board actually won its
level. Journey receipts/cursors occupy the separate Versus namespace, without
Solo or Team awards. Existing race format, controllers and steering persist.

Next-preset intent is shared with Solo, but cannot rewrite active boards. A
cross-tab change cancels stale preparation. Failed preference writes retain
session intent and expose retry/export; export does not imply a durable save.
Progress has its own warning/retry/export and optional backup chooser.

## Verification

- Actual authored Versus host: 10/10 passed. All three initial presets; failed
  Next original; two-action Skip and island selection; controller chooser/Back;
  timed decision without false clear; quota/export/retry; stale-preset held
  decode; all nine core races with direct continuation and nine durable Versus
  receipts, zero Solo/Team receipts.
- All-nine route test executes every actual paired simulation tick. Each board
  matches independently stepped authoritative reference checkpoints. These are
  host-model checks, not physical input timing or native performance evidence.
- Candidate picture owner: 8/8 passed. Stage/confirm/commit/retire, cancel,
  abort, disposal, interrupted handoff, late acquisition, exact row identity,
  foreign claimed owner, and reentrant cancellation.
- Final combined candidate host/owner, existing static-picture host/owner and
  board-footprint cohort: 92/92 passed (75.0 s), including the recovery additions.
- Lint, formatting, content validation (713 files) and whitespace checks passed.

## Native observations

Owned in-app browser tab 8, local mutable source at port 8778, desktop keyboard.
First return completed on Player 1 at 34.3%, 8160 points and three lives. This
was not a simultaneous equal-input native clear. Reload continued to Choose
your share, recognizing the first clear. The chooser showed ten missions and
entered Nearby shore directly with both boards at zero coverage and three lives.
Player 2 arrows captured 0.6% / 140 points. At the 90-second decision, the chooser
still showed Nearby shore Ready to play, not cleared. First return stayed Cleared.

The extra Journey navigation initially displaced the viewport grid and clipped
controls. Candidate-only named grid rows corrected it; native inspection then
showed the full navigation, HUD and both board areas inside the viewport.

## Open qualification

Whole-set artwork/contrast, thumbnail chooser, all-preset native clears,
physical controllers, touch/phone screens, native storage/export failure,
timing targets, public cross-release restore/rollback, Team host adoption and
human comprehension/enjoyment remain open. No agent-operated or automatic clear
is human evidence. Current compiler retains historical optional tactical actions;
the visible Tactical label is intentional until an explicit versioned Journey
action policy is qualified. Do not relabel this as direction-only Arcade.

Web originals remain online-only; core offline preparation does not save them.
The source repair has a separate hosted qualification in progress. No local
capacity-intensive full build or new Pages deployment is claimed here.
