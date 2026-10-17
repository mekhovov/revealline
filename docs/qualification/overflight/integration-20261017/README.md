# FPV Survivals — 17 October integration report

## What changed

The [updated researched plan](../../../fpv-survivals-completion-plan-2026-10-17.md) closes the current local implementation batch without expanding its scope.

1. Safely replayed all20 commits from PR1549's unmerged stack onto latest fetched main `b133a5ec8236c77d232d4fd26f34633649cf05d0`, in a new branch. No old branch was rewritten, deleted or force-pushed; no PR was closed or merged.
2. Reproduced and fixed accepted custom V4 Marathon previews which incorrectly promised new layouts or reversed columns. Projects without a battlefield sequence now describe retained authored geometry. When optional movement profiles do not permit reversal in an upcoming contract, its preview uses conservative authored-route wording. Built-in V4 and legacy V3 previews remain unchanged.
3. Refreshed developer research, inspected result persistence/input boundaries and consolidated completed/open/skipped items in the plan. No reproduced new save failure, combat retuning or records migration was introduced.

The source correction changes result guidance only. It does not rewrite custom projects or introduce a new gameplay revision. Preparing the upcoming contract to inspect its actual capabilities occurs only on relevant result screens, not during simulation ticks.

## Preservation receipt

- Original published source: `6bc79805ac49cdd409776484d2bd04e128bd8d8f` / `codex/overflight-research-qualification-20261016` / [PR1549](https://github.com/mekhovov/revealline/pull/1549).
- Old stack merge-base: `c4671fa2516407618b709970484f7000d42d4e66`.
- New main base: `b133a5ec8236c77d232d4fd26f34633649cf05d0`.
- New pre-fix head: `876698c37`; twenty [equal replayed patches](rebase-range-diff.txt), with [full replayed commit identities](rebased-commits.txt).
- The [pre-fix Overflight byte comparison](pre-fix-overflight-byte-parity.diff) is empty: runtime, Overflight tests and the combat editor retain their previous bytes. Upstream changes elsewhere are retained from main.
- PR1514/1524/1533/1534/1549 were all open/unmerged at inspection; PR1549 reported eight successful checks. Main's source workflow triggers only for main-target PRs, so its absence on the feature stack is not a failed gameplay check.

## Fresh verification

Corrected runtime source: `4d053f96f` (new preview regression included). The report and review-link update follow in a documentation commit.

- [Red regression](custom-preview-before.tap): the custom no-battlefield V4 mission compiled successfully, but contract2 claimed reversed columns despite only rotating its unprofiled routes.
- [Variant suite](custom-preview-after.tap):17/17 passed. New regression covers absent battlefield, absent movement on the returning original layout, contracts2–5, EN/UK/fallback locale, actual route geometry, source immutability and unchanged original identity. Existing built-in/V3 comparisons still pass.
- [Integration cohort](integration-checks.tap):101/101 passed, zero skipped. Includes Raid variants/records, battlefield progression, late pacing, Riy community packages, world audio, host transitions and crowd steering.
- Changed JavaScript passes ESLint with zero warnings; formatting and whitespace checks pass.
- [Content validation](validate.json) passed; its retained output inventories the checked content and navigation warnings.
- Independent read-only review found no blocking issue in the fix or tests.
- [Review entry screenshot](review-page.png) confirms the visible17 October plan link alongside the retained native captures and sound/build comparisons. This is a documentation navigation check, not new native combat evidence.

These are fresh local checks after rebase. There is no new native gameplay, audio capture, long soak or target-device benchmark in this metadata-only correction. Earlier [native qualification](../review-completion-20261016/README.md), [pacing](../late-pacing-20261016/README.md) and [spacing](../spacing-performance-20261016/README.md) keep their exact recorded sources, including rejected trials and failed active routes. Rebase does not rename those measurements as current-head qualification.

## Completed versus remaining

Implemented/local finite gates: worlds/layouts, five-operation family, shared content/Studios/input/audio/offline, bounded enemies/upgrades/armor/refits, later-choice correction, experimental spacing capacity, ten short retries, local fifteen-minute soak, native review material and truthful result previews.

Still review judgments: visual appeal, audible mix, enjoyment, ordinary-player challenge and provisional medal targets. Reference-device and five-player checks remain skipped at the user's direction, not passed. A short retry test does not establish ten full sorties or heap-disposal correctness; an M4 Pro soak does not establish Iris Xe performance.

Delivery still requires the main-target PR's exact-head checks and eventual maintainer merge. No policy bypass, automatic merge or deployment is part of this batch.

The complete successor is published as [PR1560](https://github.com/mekhovov/revealline/pull/1560), targeting main. Main's source preflight and the normal feature checks started successfully on creation; their final conclusions are reported on the PR. Existing PRs remain preserved. This is source publication, not a claim of merge or production release.
