# Radio integration review

## Current delivery checkpoint — 30 September 2026

Reviewed main: `908bc6b08`. The controller/radio and bundled FPV implementation
entered main through [PR #797](https://github.com/mekhovov/revealline/pull/797);
the updated menu assertions entered through
[PR #819](https://github.com/mekhovov/revealline/pull/819). Their v0.150.0
milestone is a planning target, not proof of a published or device-qualified build.
The older branch, build and test records below are historical checkpoints.

The previously reported iOS blocker in
`game/assets/field-kit/sprites/review.html` is resolved in current source: the
page has an explicit head, and the current `iosHTMLPolicy` staging transform
accepts both that page and `optional-practice/civilian-fpv/index.html`. This
source-policy validation does not certify a complete staged distribution,
Xcode compilation, native launch or physical controller access in WKWebView.

The subsequent [native staging checkpoint](verification/radio-native-staging-20260930.md)
closes another explicit-head problem in sound credits and completes a current
web build. Full native staging is now blocked by the existing 768 MiB inventory
limit; [issue #865](https://github.com/mekhovov/revealline/issues/865) owns that
capacity decision. It is not a native runtime or device pass.

### Remaining boundaries

| Priority         | Item                                                                                  | Next action / status                                                                                                                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1                | Publication of the integrated game                                                    | Release owner verifies current built/hosted bytes; use the current release queue rather than historical local ZIPs.                                                                                                          |
| 1                | Host picture-readiness failures                                                       | Keep with the existing deferred verification work in [issue #813](https://github.com/mekhovov/revealline/issues/813). The previous broad host rerun had 15 passes and 10 readiness timeouts; it was not a passing full gate. |
| 2                | Native packaging and device qualification                                             | Current source no longer has the reported missing-head blocker. Full current iOS packaging/launch and controller access remain unverified.                                                                                   |
| Deferred by user | Two physical radios, mixed radio/gamepad, Bluetooth/dongle, mobile and native devices | Do not repeat hardware requests or infer physical support from modeled Gamepad cases.                                                                                                                                        |
| Player setup     | Extra radio action switches                                                           | Map and verify each desired channel in Controls. Movement-only presets retain keyboard/touch actions; never guess unmeasured switches.                                                                                       |

The last focused source run at this main checkpoint passed 40 controller session,
restoration, Solo adapter, FPV radio-action and launch/return checks. Earlier
package verification passed seven checks after restoring local dependencies and
the sparse icon asset. These are dated evidence, not public-release acceptance.
Further automated test-only execution follows the current
[focused-suite waiver](focused-test-waiver-20260930.md); waived work is not passed.

## Historical bundled simulator and main update

At the user's request, the reviewed integration was consolidated and rebased
onto main `9957a6820ae9cc7b37942e21473948ea70752095`. The complete original
history remains at `codex/radio-before-main-20260929` (`4ce585fb6`). Replaying
intermediate pre-reconciliation discovery commits initially exposed obsolete
save-format conflicts; rebasing the final reviewed tree retained that completed
reconciliation and all current-main changes without conflicts.

The regular main menu now offers **FPV flight simulator** / **Симулятор
FPV-польотів**. It opens the bundled simulator in the same tab, with a localized
**Back to game** link to the exact original game route. Keyboard, touch and
saved radio calibration continue to use the existing simulator. Campaign
progress is separate from simulation drills. No published optional-package
catalog or separate installation is required for this entry.

The core build includes the explicit FPV package payload and retains its renderer
vendor dependencies in the regular offline cache. The optional standalone
package remains available independently. Its install/remove controls are hidden
when launched from the regular game, which owns the bundled offline cache.
Local preview links also work for both `/game/` and `/game/index.html`.

Validation for this update:

- 48 menu, optional-practice, flight UI and navigation tests pass after updating
  the two expected main-menu lists for the new button.
- Six entry/return/offline-closure checks pass, including source, hosted edition,
  file and native URL roots and rejection of foreign return destinations.
- The actual Solo host launch check passes; 18 unrelated cases were explicitly
  filtered in that focused rerun. The finite DOM location alias was aligned
  with the real browser before that check passed.
- The optional package build test passes. Localization validates 11,464 messages
  and 8,643 references across English and Ukrainian. Scoped lint passes.
- Full bundled build passes: 2,217 manifest files. ZIP SHA-256:
  `3cb16ee1552aad7015ccad5cc510218fd635d93925a87e5b26f71c9dd736c03a`.
  All 41 policy runtime dependencies are in `offline-cache.json`; simulator
  entry/app, both renderer modules and navigation helper match source and manifest
  hashes inside the ZIP. The initial packaging attempt ran out of disk space;
  the retry passed after removing only the previous generated expanded copy,
  retaining its ZIP/checksum until successful replacement.
- All 13 files changed between the original main baseline and latest main are
  preserved byte-for-byte from main after rebasing.
- Browser verification: Ukrainian main menu → FPV simulator → Back to game
  returns to `/game/?journey=legacy`; simulator and return labels are visible.

The sections below retain the previous review/build evidence. PR #797 is updated
to target main after the rebase; its original fixed review baseline is historical.
The v0.150.0 scheduling and separate final aggregate/device qualification remain.

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

The historical iOS missing-head blocker is superseded by the source-policy
validation above. Full native installation/device qualification remains open. Publication and actual user-specific
action-switch capture remain separate steps; keyboard/touch actions remain
available until switches are configured.
