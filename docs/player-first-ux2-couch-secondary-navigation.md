# UX2 Couch secondary-navigation parity — v0.141.4 candidate

## Scope

- Exact parent: `218e76281e3bfa26f57b7aa0f7b98058f4bd05ad`, the main merge
  of PR #680 after the immutable v0.141.3 Team quick-start release.
- Audited feature donor: `e1dba137ad7fd16c874cb511cbc801ce6ce309f7`.
- Branch: `codex/couch-secondary-v1414-stacked`.
- The package, root lock record, and build configuration identify this local
  candidate as v0.141.4.
- This source does not claim a merge, tag, release, Pages deployment,
  physical-controller check, browser-touch check, or public acceptance.

The effective runtime/test feature remains seven paths. The old `couch.mjs`
controller activation hunk is already supplied by the input stack and is
omitted. Team's
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
v0.141.3 quick-start behavior remains intact: Start owns initial focus, Arena &
team options starts collapsed, and passive picture preparation focuses that
summary rather than the hidden arena selector or Cancel.

## Focused evidence

The complete Couch shell and shared Pause host files pass 27/27. The departure,
markup and quick-start boundary passes 37/37. This includes the follow-up
lifecycle synchronization: controller Confirm and its mirrored native release
remain owned until neutral, while a later deliberate native Confirm resumes the
paused match. The broader Team/Versus/generic navigation, Couch input and
English/Ukrainian localization cohort passes every applicable case. Its complete
307-case run records 302 passes and five failures, all inside the unchanged Solo
touchscreen host. Exact v0.141.3 PR head `c3582815d` reproduces the same five
failures in an isolated 18-case run (13 pass, 5 fail), while this candidate
changes no Solo runtime, helper or fixture path.

These tests assert exact DOM parents, keyboard/controller/touch-modeled focus,
exact opener restoration, destination-specific departure copy and hrefs, the
paused clock, and the preserved collapsed quick-start setup. The stale
revision-79 fixture override from the old draft is removed.

Repository validation passes across 1,249 files with 9,969 localized messages,
7,962 references and field-kit presentation revision 91. Full lint, game/site
formatting, native-platform formatting, changed-file formatting and syntax,
four-way v0.141.4 version parity and diff checks pass.

## Evidence limits

The candidate is rebased onto current main and still requires its own PR, merge,
immutable release, Pages selector and public audit. Automated controller and
touch modeling does not replace physical controller, Steam Deck, browser touch,
or responsive visual review.

The five parent-reproduced Solo touchscreen failures are not counted as passes
and are not corrected in this Couch-only slice. Their pause shortcut, deployment
ownership and three controller-to-touch steering expectations remain an
explicit upstream qualification concern.
