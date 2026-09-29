# UX2 Couch secondary-navigation parity — v0.135.0 candidate

## Scope

- Reconciled base: `651b78756039f48d332a97528503193d9111c382`, the corrected local
  v0.134.0 Team quick-start candidate stacked on the compact gallery and Couch
  input handoff.
- Donor feature commit: `e5db202099eaffb3af32ad111066073fecb2e5c2`.
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
The focused feature cases pass 3/3 inside the Versus shell, and the shared Pause
and quick-start boundary passes 11/11. Original donor evidence also records a
194/194 Couch/player navigation boundary and a 103/103 controller binding,
confirm, lifecycle, and router boundary. `npm run validate` passes with 9,529
localized messages, 7,714 source references, 1,239 game files, and presentation
revision 88. Scoped ESLint, Prettier, version parity, generated-i18n freshness,
and diff checks pass.

These tests assert exact DOM parents, keyboard/controller/touch-modeled focus,
exact opener restoration, destination-specific departure copy and hrefs, the
paused clock, and the preserved collapsed quick-start setup. The stale
revision-79 fixture override from the old draft is removed.

The corrected v0.134.0 base supplies the genuine-`Blob` Team fixtures and actual
controller navigation. This replay takes only the Versus lifecycle correction
from the later host-contract commit: it releases the mirrored Enter gesture,
waits through the controller echo window, and then resumes with a later native
keyboard Confirm. Production validation and controller guards remain unchanged.

## Evidence limits

The stacked v0.134.0 base is not an accepted release. If its eventual merge SHA
differs, replay this single navigation slice onto that accepted source and rerun
the focused boundary. Automated controller and touch modeling does not replace
physical controller, Steam Deck, browser touch, or responsive visual review.
