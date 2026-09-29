# Radio integration review

## Scope and branch

The local `codex/radio-integration` branch combines the tested controller work
with the optional FPV simulator and its discovery dependencies. It is based on
`cd1ceff06`; original `codex/two-controller-support` and
`codex/discovery-rewards` branch references remain unchanged. No publication
or remote pull request is part of this task.

## Completed recommendations

- Consolidated regular Solo, Team/Versus controller sessions and optional FPV
  radio fixes on one branch. Localization additions from both branches were
  preserved and the generated catalog was rebuilt.
- Added separate bounded automatic-setup records for Solo and couch modes.
  Applied radio profiles, shared-stick side assignments and swaps restore
  after reload/reconnect when identity is unambiguous. Neutral release remains
  required; a paused game does not automatically resume.
- Identical radios require explicit assignments. Restoration does not take an
  occupied seat. Unconfigured ambiguous radios remain saved when another
  controller joins.
- Added an action-focused mapping entry and next-action navigation while
  preserving movement mappings. Action descriptions explain their game effects;
  unmeasured switches are never guessed. Shared players cannot bind the same
  physical channel.
- Added the FPV radio helper to the optional package file list. Source testing
  alone had missed its omission from the downloaded package.

## Verification

- 644 integrated controller, Solo, couch navigation, Team host and FPV tests pass.
- 40 desktop/iOS wrapper tests pass.
- Optional-package build test passes; the development FPV ZIP has 44 files.
  Radio modules were compared byte-for-byte against the source.
- Localization check: English and Ukrainian, 11,463 messages / 8,625 references.
- Scoped ESLint, diff checks and the in-tree couch/FPV compatibility script pass.
- Browser inspection confirmed the consolidated game starts and its Controls
  panel exposes restoration guidance, forgetting saved setup and the action guide.
  No additional physical qualification is claimed.

## Deferred items

Further real-device testing remains deferred by user request. Two radios and
radio/gamepad combinations have automated coverage, while the previously
confirmed physical results are TX15 FPV flight/arm/reset, regular Solo right-stick
movement, shared-radio Team movement and two USB PS5 controllers.

The previous iOS staging blocker and native installation/device qualification
remain outside this recommendation pass. Publication and actual user-specific
action-switch capture remain separate steps; keyboard/touch actions remain
available until switches are configured.
