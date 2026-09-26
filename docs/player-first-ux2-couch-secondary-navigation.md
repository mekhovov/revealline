# UX2 Couch secondary-navigation parity — v0.135.0 candidate

## Scope

- Reconciled base: `3c34b0122060c6850a811a933be41e588f31058f`, the rebased local
  v0.134.0 Team quick-start candidate stacked on the compact gallery and Couch
  input handoff.
- Branch: `codex/couch-secondary-nav-v135-local`.
- The package, root lock record, and build configuration identify this local
  candidate as v0.135.0.
- This source does not claim a merge, tag, release, Pages deployment,
  physical-controller check, browser-touch check, or public acceptance.

The effective feature remains seven paths. The old `couch.mjs` controller
activation hunk is already supplied by the input stack and is omitted. Team's
`relay-rescue.mjs` change only places the existing quick Sound control in the
paused action group; it does not duplicate the controller activation hook.

## Player behavior

Versus exposes **More** beside its primary lobby utilities. Home, About &
credits, and Releases no longer require opening How to play. Keyboard Back and
controller Back close More and restore its summary. During a live match, each
secondary destination keeps the paused attempt behind the existing discard
choice. Stay returns focus to the exact destination that opened that choice.

Team Pause exposes Sound directly in the Resume, Retry, Missions, Help,
Settings, Sound, Home hierarchy. Changing Sound keeps the arena paused. The
v0.134.0 quick-start behavior remains intact: Start owns initial focus, Arena &
team options starts collapsed, and passive picture preparation focuses that
summary rather than the hidden arena selector or Cancel.

## Focused evidence

The complete Versus shell passes 25/25 and the complete Team host passes 77/77.
The focused feature cases pass 3/3 inside the Versus shell. The shared Pause and
quick-start boundary passes 11/11, the Couch/player navigation boundary passes
194/194, and the controller binding, confirm, lifecycle, and router boundary
passes 103/103. `npm run validate` passes with 9,529 localized messages, 7,714
source references, 1,239 game files, and presentation revision 88. Scoped
ESLint, Prettier, version parity, generated-i18n freshness, and diff checks pass.

These tests assert exact DOM parents, keyboard/controller/touch-modeled focus,
exact opener restoration, destination-specific departure copy and hrefs, the
paused clock, and the preserved collapsed quick-start setup. The stale
revision-79 fixture override from the old draft is removed.

The host regressions now model the current contracts directly:

- Team file selection supplies a genuine `Blob`. Tests that deliberately hold
  a read use a narrow queued mock of the native `Blob.text()` boundary, while
  production still validates the genuine Blob and copies it with native
  accessors and `Blob.prototype.slice`.
- The already-paused Help cases use actual D-pad navigation to **Read controls**
  and controller Confirm. This proves reading ownership before blur, hidden,
  and persisted-pagehide suspension without asking an unauthorized synthetic
  click to bypass the controller echo guard.
- The Versus lifecycle case releases its mirrored Enter, waits through the
  controller echo window while proving the paused match cannot advance, then
  uses a later native keyboard Confirm. That later neutral gesture resumes once
  and does not leak an ability action into play.

No production validation or controller echo guard is weakened by these test
harness corrections.

## Evidence limits

The stacked v0.134.0 base is not an accepted release. If its eventual merge SHA
differs, replay this single navigation slice onto that accepted source and rerun
the focused boundary. Automated controller and touch modeling does not replace
physical controller, Steam Deck, browser touch, or responsive visual review.
