# UX5 Settings and Help return candidate

## Scope

This unversioned local checkpoint is reconciled onto the exact post-soundtrack
Couch quick-start candidate `1fd63337ba1d1635d117877bf16c3e95d83a4167`.
It changes only player-facing Settings and Help ownership plus focused tests,
and it remains unpushed, unversioned, and unreleased.

- Solo direct gameplay Settings and Help first use the ordinary pause boundary,
  release gameplay input, and record the matching Pause action as their return
  target. Closing either child leaves the attempt paused; Resume remains an
  explicit separate action.
- Solo Home and More actions explicitly become the modal origin before the
  existing host control opens a child. Pointer activation therefore returns to
  the visible Settings or How to play command even on browsers that do not focus
  buttons on pointer down.
- Versus retains its existing screen owner: Pause exposes Settings and Help,
  Back restores the exact command, and neither child resumes or replaces either
  board.
- Team retains its existing pause owner: Pause clears physical input before
  Settings opens, Back restores the Settings command in the Pause tools, and
  Resume remains explicit. Team Help remains in the same lobby/Pause tools and
  cannot be opened over a running arena.

No simulation, preference, storage, media, campaign, creator, or admin contract
changes in this candidate.

## Changed paths

- `game/app.mjs`
- `game/ui/game-shell.mjs`
- `game/test/pause-menu-host.test.mjs`
- `game/test/shared-settings-solo.test.mjs`
- `game/test/shared-settings-versus.test.mjs`
- `game/test/coop-shared-settings.test.mjs`
- `docs/player-first-ux5-settings-help-return.md`

## Integration overlap

- UX2 Home/lobbies may edit `game/ui/game-shell.mjs`. Preserve the
  source-dialog lookup in the forwarding helper and the explicit Pause opener
  focus for overlay Help/Settings when reconciling.
- Couch quick-start may edit lobby actions and focused Couch tests. This slice
  does not change Couch setup, preparation, cancellation, or starting behavior;
  retain its Settings/Help opener assertions when rebasing.
- The UX4 failure flow may edit Pause/result behavior. This slice only changes
  child-dialog return ownership and must continue to leave Resume deliberate.
- The accepted quick-start and production-history delta did not overlap this
  slice. UX4 overlaps only in `game/app.mjs`; a three-way inspection applies
  both cleanly, so UX4 is not required by or stacked into this checkpoint.

## Focused evidence

- Solo, Versus, Team, Pause, Settings, Help and exact-opener behavior: 30/30
  focused cases passed.
- Team current77 and retained58–76 picture/history authority: 82/82 cases
  passed, preserving current production history.
- ESLint, Prettier, native Prettier, validation and motion syntax pass.
- The ordinary production build contains 1,138 files with SHA-256
  `1762a8495aafcb1539d436b6618b6f6c44fed1d43e09747c79761ddb503e6a4b`.

## Evidence boundary

The focused host tests model native dialogs, keyboard/controller routing, Team
frames, and exact simulation checkpoints. A browser review should still
exercise real pointer focus on Safari/WebKit, keyboard Back/Escape, and a
physical controller. This candidate does not claim physical touch/controller,
BFCache, offline, full-suite, or public-release qualification.
