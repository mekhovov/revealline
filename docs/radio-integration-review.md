# Radio integration review

## Scope and branch

The local `codex/radio-integration` branch combines the tested controller work
with the optional FPV simulator and its discovery dependencies. It is based on
`cd1ceff06`; original `codex/two-controller-support` and
`codex/discovery-rewards` branch references were preserved during consolidation.

## GitHub review and release schedule

[PR #797](https://github.com/mekhovov/revealline/pull/797) is a draft aggregate
input scheduled under **v0.150.0 — Unified native experience** (milestone 57).
The fixed review base `codex/radio-review-base-20260929` is discovery checkpoint
`2218f3cc21d82e23373e3324c75d27fa2fbe24a0`, keeping the entire 43-file radio delta
visible even as the discovery branch advances. The baseline is a review
reference, not another release input.

The discovery/optional-FPV dependency was previously tracked by closed,
unmerged PR #758. The release aggregate must reconcile that dependency and this
radio delta together. The pushed controller donor `600fe30db8669909169b9b233519db8a7c6c10bd`
is retained as original history; do not apply its changes again after integrating
this PR. The consolidated branch also preserves the local TX15 FPV commits from
`codex/discovery-rewards`.

The review checked input ownership, neutral/reconnect behavior, shared-channel
isolation, storage validation/concurrent-tab recovery, capture cleanup and FPV
compatibility. No blocking issue was found in those paths. Inherited discovery
work is not newly qualified by this scoped radio review. Cross-task coordination
was explicitly authorized: the repository audit owns other local worktrees and
the release task owns final aggregate qualification and publication.

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

- Fresh PR review run at `6d19567cc`: 645 integrated controller, Solo, couch
  navigation, Team host and FPV tests pass (zero failed, cancelled or skipped).
  This includes all eight restoration tests after the final recovery change,
  covering explicit forgetting of unreadable data and newer-tab protection.
- 40 desktop/iOS wrapper tests pass.
- Combined core build passes: version 0.142.4, 2,191 manifest files.
  The packaged restoration, session, setup, TX15 preset and Solo adapter modules
  match the tested source and manifest hashes.
- Optional-package build test passes; the development FPV ZIP has 44 files.
  Radio modules were compared byte-for-byte against the source.
- Localization check: English and Ukrainian, 11,463 messages / 8,625 references.
- Scoped ESLint, diff checks and the in-tree couch/FPV compatibility script pass.
- Browser inspection confirmed the consolidated game starts and its Controls
  panel exposes restoration guidance, forgetting saved setup and the action guide.
  No additional physical qualification is claimed.

## Local build artifacts

- Core: `.cache/radio-integration-dist/distribution.zip`
  SHA-256: `3bcc47936fe91aeb24f3847ffff4ad0cb2e1b2a9f4c0722133f63780554c4e93`.
- Optional FPV: `.cache/radio-integration-fpv/civilian-fpv.zip`
  SHA-256: `2b22d2dd24dbf5678a7f0a6fc3a2bcb3ce55f50105170db04dfcff89c0f83957`.

These are local development artifacts, not a publication approval. The sparse
checkout's missing tracked content dependencies were restored from the current
branch before the successful core build; this did not alter their source.

## Deferred items

Further real-device testing remains deferred by user request. Two radios and
radio/gamepad combinations have automated coverage, while the previously
confirmed physical results are TX15 FPV flight/arm/reset, regular Solo right-stick
movement, shared-radio Team movement and two USB PS5 controllers.

The previous iOS staging blocker and native installation/device qualification
remain outside this recommendation pass. Publication and actual user-specific
action-switch capture remain separate steps; keyboard/touch actions remain
available until switches are configured.


## Combined native candidate input (2026-09-29)

`codex/radio-release-input` starts from PR #796 source
`c99fbbac348691bb91bd16a7e1e281f5a9e2b69b` and applies only the radio delta
`2218f3cc2..6d19567cc`. Original radio source and qualification above remain
separate evidence. PR #797 owns scheduling for milestone v0.150.0; this branch
is a prepared integration input, not a standalone publication or frozen artifact.

Six content conflicts were reconciled without replacing the native shell,
spatial-audio hooks, controller confirmation lifecycle or cached-page recovery.
Both existing cached-page FPV tests and new axis-switch/default-profile tests
remain. The old Solo test's translated close-button label was replaced with its
stable settings-close hook. The donor shell-test hold workaround was removed
in favor of the aggregate's original Confirm pulse. Documentation now distinguishes
standard-pad rejoining from saved radio restoration and describes the included
optional FPV package correctly.

Focused checks on this combined source:

- 74 controller restore/session/setup, Solo adapter and FPV radio/UI tests pass.
- Three real Team host fixtures pass: shared radio, two radios, and radio plus
  gamepad; each verifies disconnect pausing and partial-profile touch fallback.
- English/Ukrainian catalogue completeness, interpolation parity and exact
  generated bundle match pass. Scoped ESLint and the couch/FPV compatibility
  check pass. Full localization content extraction was not run because the
  small checkout omits unrelated historical authoring inputs.
- The wider navigation/input/shell cohort completed with 73 passing tests and
  six failures: three missing sparse fixture imports (subsequently hydrated),
  two Sentinel route checks and one controller echo fixture. A Team host cohort
  passed 98 checks and failed its Extras test plus the then-missing Solo fixture.
  These partial cohorts are not a release qualification.
- Exact unmodified c99 baseline replay of the four substantive failing cases
  passed both Sentinel routes and the echo test; Team Extras failed identically.
  The baseline test confirms only Team Extras is pre-existing. Sentinel failures
  on the combined input remain open and must be resolved before promotion.
  A second run confirmed that the aggregate Confirm pulse fixes the echo fixture;
  both Sentinel cases still failed with an extra zero-time release sample. That
  ineffective sample was reverted; no route or checkpoint expectations changed.
- After hydrating Solo dependencies and correcting its close hook, the Solo
  radio host fixture reaches settings and saves calibration but does not start
  through the native shell; this combined-path gate remains open.

No default/optional full build or hardware testing was performed for this input.
Earlier donor build and hardware receipts must not be presented as qualification
of these combined bytes. Final controller/keyboard host regressions, source-bound
presentation/audio review, complete packaging budgets and frozen publication
remain coordinator-owned gates. No caps, assertions or simulation rules were
relaxed to admit this input.
