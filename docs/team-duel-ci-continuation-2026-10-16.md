# Team and Duel CI continuation — 16 October 2026

The [reviewed continuation plan](team-duel-plan-continuation-2026-10-16.md) records
the latest main integration, original-byte/worker corrections and additional
gameplay-host/observer work. The older results below retain their actual sources.

## Latest completed hosted checkpoint

Exact source `afe63ce5d985a90a0b56fd65b1d0913a741a659e` subsequently passes
all **14 selected hosted checks**, with the same three broad test/build/assembly
skips. Its [check inventory](verification/team-duel-pressure-2026-10-16/hosted-afe63-checks.json),
[binding](verification/team-duel-pressure-2026-10-16/hosted-afe63-binding.json)
and [lossless focused log](verification/team-duel-pressure-2026-10-16/hosted-afe63-focused.log.gz)
retain that exact result. The final combined focused cohort passes 1,354/1,354,
with zero failures, cancellations or skips. The full real-source original-body
case passes in 751.885 seconds. Later pressure documentation does not
retroactively grant a newer head its own CI result or close missing full release
authorities.

## Earlier completed hosted source checkpoint

At exact source `85b2fd4f4b11e828947317400528d1e9bbd48f45`, all **14 selected
hosted checks pass**: focused verification, its scoped release-ready summary,
all six industrial feature jobs, appearance, candidate, optional practice,
preflight, utility verification and reconciliation. The
[retained binding](verification/team-duel-gameplay-audio-2026-10-16/hosted-85b2-binding.json),
[check inventory](verification/team-duel-gameplay-audio-2026-10-16/hosted-85b2-checks.json)
and [lossless focused log](verification/team-duel-gameplay-audio-2026-10-16/hosted-85b2-focused.log.gz)
record that exact scope.

The full real-source external case passes in **743.535 seconds**, including all
32 exact original bodies, selected Production originals/provenance, loose/ZIP/
manifest checks, worker ownership, core budgets and the installed-capacity tail.
The final combined focused cohort passes **1,354/1,354**, with no failures or
skips. Other selected cohorts also execute; these overlapping counts are not a
whole-repository total. Later documentation and native codec receipts do not
retroactively change the measured source or grant a later head its own CI pass.

Broad test, broad build and full-evidence assembly are the **three skipped
checks**, under the existing explicit fast-release policy. The scoped job named
`release-ready` does not supply the missing required full release authorities,
source-admission decision, canonical frozen artifact or native capacity approval.
Those release boundaries remain open. The following sections retain the earlier
failures and repairs that led to this completed source checkpoint.

This continues the [acceptance register](team-duel-qualification-2026-10-15.md)
and [PR #1496](https://github.com/mekhovov/revealline/pull/1496). The branch
rebased without conflicts onto fetched main `b11745223`; the replayed checkpoint
is `69f0286a8`. Human balance playtesting remains waived, and the user's Duel
hardware deferral remains in force. This continuation adds no native audio,
controller, performance, public-edition or immutable-release acceptance claim.

## Actual hosted failures

At source `6dda880ca`, all six industrial feature jobs, appearance preview,
candidate and optional-practice checks passed. Broad test/build jobs were skipped
under existing policy. Two actual verification failures remained:

- [Focused validation](https://github.com/mekhovov/revealline/actions/runs/38809560980)
  completed the full real-source external build, then failed its expectation that
  Equipment Workshop belongs to mandatory core. The dependent readiness job also
  failed. The 72 MiB core regression target passed before that assertion.
- [Full-evidence utility verification](https://github.com/mekhovov/revealline/actions/runs/38809561146)
  ran 135 tests and reported two errors: its sparse checkout omitted
  `scripts/game-cli.mjs`, which the new original-writer integration tests imported.
  Assembly remained skipped; no release evidence package was produced.

The retained local logs are
`.cache/multiplayer-desktop/pr1496-6dda-focused-failure.log` and
`pr1496-6dda-full-evidence-failure.log`. These are diagnosed test/checkout failures,
not a whole-suite pass or a publication failure that should be retried blindly.

## Original writer in bounded checkouts

The same production `safeRelative`, CRC32 and ZIP32 writer now live in
`scripts/distribution-zip.mjs`, using only Node built-ins. `game-cli.mjs` imports
and re-exports those exact functions, preserving its existing public interface.
The Python original-artifact test imports that shared production writer directly;
it does not replace the writer with Python's independent negative-case producer.

The extraction retains the exact function bodies, default STORE behavior, adaptive
compression parameters, path/collision guards and ZIP64 rejection. In the same
Node 20.19.5 environment, retained before/after bounded archives are byte-identical:
STORE SHA-256 `60f41a31dfdb75d3f445c63451636eab48bfaa1060101c587e257b10d53b620f`
and adaptive SHA-256
`c09eb2d1a6b6e5ed3ba1e2b56aac8b72ed605f4f11db12ea6edf9a986edfbfd6`.
This is scoped compatibility evidence, not a newly built complete release or a
cross-zlib determinism guarantee.

The three sparse verification paths retain the shared writer and actual policy
files. Full-evidence verification explicitly selects Node 20.19.x rather than the
runner's ambient runtime. Inspection and original upload also retain both existing
workflow YAML files: their unchanged utility suite reads both when checking the
read-only inspection/write-authorized upload boundary. A narrow reproduction
confirmed the former companion-file omissions before correction.

`publishing/utility-sparse-checkout.test.mjs` creates fresh tiny Git repositories,
applies each workflow's actual sparse patterns, and executes the original-writer,
policy and workflow-contract tests without application sources or `node_modules`.
All three checkout cases pass. Each workflow's complete utility-discovery command
remains unchanged. Permissions, source binding, required policy, authentication
boundaries, artifact limits and publication behavior remain unchanged. No workflow
was dispatched by this continuation.

Explicit archived-CLI fixtures also retain the new real helper rather than
resolving it from the current checkout. Their existing historical-entry,
source-integrity and artifact assertions remain. These small fixtures are not
complete production edition builds.

The archived soundtrack metadata case also lacked older CLI dependencies. It now
retains the real build-entry writer and inclusion predicate. Its finite
optional-sample predicate stub follows the existing archived-CLI fixture. Only
that metadata case omits its artificial offline sentinel: its pre-existing
offline-content/launcher stubs were never complete offline qualification. All
existing reviewed-catalogue, source archive, distribution hash and absence of
installed formatter assertions remain; other cases retain their offline paths.

## Exact chapter ownership instead of mandatory installation

Equipment Workshop's retained body is **11,127,024 bytes**, SHA-256
`a015f79c47d8bac6cd09ba04e50c0c98d759e523eea7d225edbe62a8a5254054`.
The existing inclusion policy admits only small bundled mission packs, at most
64 KiB, into mandatory core. Larger illustrated packs have explicit selectable
chapter owners. Commits `d91c95a0a2` and `8c0b16d95c` established those contracts;
the external integration assertion predated them.

The full real-source integration test still builds and checks exact payloads. It
now requires the exact Workshop loose/manifest bytes, its `downloadFiles` pin,
the `chapter:equipment-workshop` owner and all three mission-to-package closures.
The pack index stays in core, while the large body is absent from core/shared
installation and legacy optional-pack metadata. Selecting the chapter resolves
the exact original body.

The new bounded regression calls production offline preparation with the real
Workshop bytes and source-index rows. Missing or same-length corrupt bytes must
reject before any offline metadata is emitted. The old core assertion failed in
that fixture before correction. **No payload was removed or moved by this fix.**
The 72 MiB regression target, production 80 MiB core bound, full real-source build
and existing external-original checks remain required.

## Verification and remaining acceptance

- The archive/CLI/frozen-consumer/policy/source-workflow/selector cohort passes
  **92/92**, with zero failures, cancellations or skips. This includes the
  independent Python original/new archive cases and required-policy regressions.
- The three actual sparse-checkout dependency cases pass, including both companion
  workflow contracts. They are bounded dependency checks, not the complete utility
  discovery repeated inside another test.
- Equipment ownership, the existing inclusion boundary and offline-publication
  cases pass **7/7**, with zero skips. Two bounded external-distribution cases
  also pass; their name-filtered run deliberately does not execute the real-source
  build and cannot qualify it.
- Both complete archived-inspector/soundtrack test files pass **16/16**, with no
  skips. Final focused routing passes **44/44** and retains the full real-source
  build as well as the new dependency and ownership regressions.
- A local attempt at full utility discovery encountered the unchanged **1 GiB free
  disk reserve** while this Mac had less space. That environmental failure remains
  disclosed. The reserve is not lowered or mocked to claim a complete local pass.
- Scoped formatting, lint and whitespace checks accompany the source change.

Hosted checks must pass for the final pushed source, including the full real-source
build and the complete utility discovery. Earlier source-pinned container and
native receipts remain historical. The missing production gate execution,
successful required release suites, exact-version source preservation, canonical
frozen artifact and independent native capacity decision remain open as recorded
in [release readiness](team-duel-release-readiness-2026-10-15.md).

After integration, the next player-facing acceptance is the fixed public
Next/retry/Studio flows and actual cross-version offline recovery. Sustained
pressure with a matched performance baseline, natural complete custom-cue gameplay
and acoustic listening remain separate work. Passing these CI repairs does not
complete those acceptance items.

## Hosted utility repair and current public delivery

At source `743a43b774bf6605235833e7354414de658b22af`, the repaired
[hosted utility job](https://github.com/mekhovov/revealline/actions/runs/38822653084)
passes its actual complete discovery: **135 tests in 25.330 seconds, OK**.
Assembly remains skipped. This is the utility suite, not a whole-repository or
release-evidence pass. The full focused build and other current-source jobs were
still running when this update was recorded.

The separate [16 October public dependency receipt](verification/team-duel-public/public-delivery-2026-10-16.json)
passes all **180 missions**, **357 dependency URLs** and **251,342,372 bytes**.
The rolling site stayed on source `b11745223861c3973ad4bf440cc536198b8e0371`
throughout the audit, with manifest SHA-256
`41d5ae845b2f78df91634850fed6f6f45ece01459476bb3e811547a5e6d301da`.
The receipt's UTC time, 15 October 23:21, is 16 October in Europe/Berlin.
That public source does not include the unmerged continuation fixes, so this
does not qualify their post-deployment Next, retry, Studio or update behavior.

## Later main integration

Main advanced during the desktop comparison. The branch subsequently rebased
onto `3e43dc1d73d7a6ba53b063ea1455f70900155e7b`. The only conflict was overlapping
test insertions in `publishing/focused-tests.test.mjs`: main's Pages capacity
regression and all archive/reader/observer registrations are retained. The
eight-commit range comparison shows unchanged implementation changes; only those
test insertion contexts moved. Incoming FPV delivery and capacity work remains
intact. No current-source complete archive or native capacity claim follows from
the historical container receipt.

The [four native initial-scene observations](team-duel-initial-scene-comparison-2026-10-16.md)
keep baseline `b11745223` and candidate `743a43b77`, the exact commits actually
served. They are not relabeled as this later rebased source. The Team pair matches
reported initial HUD/clock conditions; Duel's warning phases differ and its pair
is not a fully matched benchmark. Sustained pressured play remains open.

Post-rebase validation passes **114/114** top-level test nodes with no failures,
cancellations or skips. This cohort includes focused routing, the unchanged
observer, the real-Git transport wrapper (16 Python cases), incoming Pages
capacity tooling, three sparse dependency checkouts and bounded Equipment
Workshop/offline publication checks. The log is
`.cache/multiplayer-desktop/post-rebase-3e43-scoped.log`. Scoped lint, formatting
and whitespace checks also pass. These checks do not run the full real-source
external build; final pushed-source hosted verification remains required.

## Production originals and optional worker ownership

After rebasing onto main `2169552a0`, the local complete external integration run
passed the original-body, core-budget, selected-source and Workshop ownership
checks. It then failed an obsolete whole-text worker URL exclusion after
1,271.7 seconds. The [retained failure](verification/team-duel-public/continuation-external-build-failure-2026-10-16.tap.gz)
preserves three passing top-level cases and that one failure. The executed test
body is the `scripts/test-external-distribution.mjs` blob at `b7f54e275`; this was a
working-tree preparation, without a frozen artifact or final-source build claim.

The earlier hosted authoring-exclusion failure conflicted with main's existing
explicit Production admissions. The test now derives the exact selected source
pins from the build configuration and checks all matching manifest members,
loose originals and ZIP bytes. Missing/duplicate/corrupt members and unselected
neighboring authoring inputs fail. No original is dropped to satisfy the test.

The second failure came from the worker deliberately embedding the complete
optional `downloadFiles` inventory. URL presence alone does not establish core
installation. The corrected assertion requires exact worker/offline agreement,
source-pinned gameplay members, exclusive `chapter:<id>` ownership and correct
mission download resolution, while keeping those members out of core and legacy
optional packs. A small real generated chapter reproduced the old failure before
correction. Negative cases cover core/legacy/shared leaks, missing/duplicate/
corrupt pins, wrong mission selection and divergent worker metadata.

Four bounded external cases pass; their run excludes the unchanged expensive
full-build case. [Retained bounded result](verification/team-duel-public/continuation-external-worker-green-2026-10-16.tap.gz).
The independently executed remaining capacity tail uses all 32 canonical bodies
(130,442,755 bytes): twelve gameplay packs install, the thirteenth is refused,
and the existing owners remain unchanged. The source mission counts for all
sixteen chapters also match. Five selected worker/finalization cases pass;
fifty-five unrelated cases are excluded from that diagnostic run. These filtered
runs do not establish a complete file/suite pass. The corrected full build stays
mandatory in focused CI, with every original and budget retained.

The actual Studio gameplay-host cohort passes all six cases without skips or
cleanup errors; its [retained result](verification/team-duel-public/continuation-audio-host-green-2026-10-16.tap.gz)
complements the native receipts. Default Team picture/bootstrap hosts pass 24/24,
observer/routing 89/89 and the industrial verifier 7/7, each as a complete scoped
cohort. Counts overlap and are not a whole-repository result. Targeted lint,
formatting and whitespace checks pass. Final-head hosted results remain required.

## Completed integration check at `690a85f3c`

PR source `690a85f3c1fc62ea1142d635ac41d63d18b6b13b` now passes the
[complete focused job](https://github.com/mekhovov/revealline/actions/runs/38848553634/job/116804504229).
The corrected full real-source external build passes in 966.4 seconds, including
all 32 generated original bodies, exact admitted Production originals, loose/ZIP/manifest
equality, optional chapter ownership and unchanged core budgets. The final
combined focused cohort reports 1,354 passes with no failures or skips; this is
a scoped cohort, not the broad repository suite. [Retained job log](verification/team-duel-gameplay-audio-2026-10-16/hosted-690a-focused.log.gz)
and [check states](verification/team-duel-gameplay-audio-2026-10-16/hosted-690a-checks.json)
preserve the exact source result. All six industrial feature jobs, candidate,
preview and utility verification also pass. Broad test/build and full assembly
remain skipped under the repository's explicit fast-release policy.

The later [native custom-audio continuation](team-duel-native-gameplay-audio-2026-10-16.md)
then discovers and corrects a Duel semantic-cooldown defect. Its complete local
audio cohort passes 55/55; the complete actual-host cohort passes 7/7, including
a real keyboard-grown trail strike on each board and deliberate Restart.
Those later source changes require their own final-head hosted checks; the 690a
result is not relabeled as covering them. Publication and full required-evidence
authorities remain separate.
