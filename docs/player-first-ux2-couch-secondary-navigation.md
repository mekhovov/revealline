# UX2 Couch secondary-navigation parity — v0.141.3 candidate

## Scope

- Reconciled base: `2904091ca99400529a39c1491b0770037fffc00e`, the local
  v0.141.2 Team quick-start candidate stacked on the final compact-gallery
  candidate.
- Branch: `codex/couch-nav-v1413-candidate`.
- The package, root lock record, and build configuration identify this local
  candidate as v0.141.3.
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
v0.141.2 quick-start behavior remains intact: Start owns initial focus, Arena &
team options starts collapsed, and passive picture preparation focuses that
summary rather than the hidden arena selector or Cancel.

## Focused evidence

The complete Couch shell and shared Pause host files pass 27/27. The departure,
markup and quick-start boundary passes 37/37. This includes the follow-up
lifecycle synchronization: controller Confirm and its mirrored native release
remain owned until neutral, while a later deliberate native Confirm resumes the
paused match. Scoped ESLint, Prettier, syntax, version parity, presentation
metadata revision 91 and diff checks pass.

These tests assert exact DOM parents, keyboard/controller/touch-modeled focus,
exact opener restoration, destination-specific departure copy and hrefs, the
paused clock, and the preserved collapsed quick-start setup. The stale
revision-79 fixture override from the old draft is removed.

The sparse preparation checkout omits production authoring assets required by
the aggregate localization/build validator, so `npm run validate` is not
reported as passing here. A broader audio cohort likewise cannot prepare Team
pictures without those omitted files. Its remaining Versus controller-slider
expectation also fails unchanged on exact base `2904091ca`; this feature does
not weaken or rewrite that unrelated test.

## Evidence limits

The stacked v0.141.2 base is not an accepted release. If its eventual merge SHA
differs, replay this single navigation slice onto that accepted source and rerun
the focused boundary. Automated controller and touch modeling does not replace
physical controller, Steam Deck, browser touch, or responsive visual review.
