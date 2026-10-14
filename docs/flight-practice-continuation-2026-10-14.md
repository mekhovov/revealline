# Flight practice publication continuation — 2026-10-14

## Scope and integration boundary

The original directory work (PR #930) is already on main. The continuation branch
`codex/flight-practice-publication` was rebased from that work onto main
`5f126d6105be5708948dbaff6907ca5cd7e15baf`. The primary checkout's unrelated work
was left untouched. SIM owns flight mechanics, controls, training and rendering;
this change only owns publication wiring, its verification and maintainer help.

SIM PR #1193 handles deliberate arming after recovery and Library progress/language.
It was still open when this continuation was prepared. Do not release an older
candidate as though it contains that safety fix. Rebase onto the merged fix and
reproduce the final candidate before qualification. Active SIM worktrees and their
uncommitted files are not release inputs.

## Changes

- Restore the existing `stage-pages` publisher in `publish-main-pages.yml`, after
  the main build and before the combined 950,000,000-byte capacity inventory.
  Empty selection still emits a usable explicit empty directory.
- Verify the live practice site from the exact deployed source and selector.
  Reject missing catalogue/details/directory assets, mismatched IDs or selected
  versions, changed dependencies and changed stable launcher copies. Preserve a
  verification receipt in Actions, keyed by source SHA.
- Add production-workflow ordering and sparse-import regression coverage, plus
  selected synthetic-release staging, stale-version and tampering checks.
- Refresh obsolete maintainer workflow references and package-limit guidance;
  current generated preflight output is authoritative. Document concurrent SIM
  integration and the restored required test policy.

## Verification record

Environment: macOS ARM64, Node v20.19.5 (within the supported local engine range).
Production CI pins Node 22.22.2; a local pass is not that CI result.

- Initial focused directory/bundle/publisher regression run: 20 passed, 0 failed.
- Full practice suite: **290 passed, 0 failed, 0 skipped**. Includes the new
  publication checks and existing offline, input, replay and fourth-app fixtures.
- Main Pages publication-profile tests: **3 passed, 0 failed**. Changed JavaScript
  passes ESLint; workflow and changed JavaScript pass Prettier; whitespace checks
  pass. The workflow's sparse verification checkout is reconstructed/imported by
  the regression suite.
- All three packages were built twice, byte-compared and admitted from source
  `449344bcbd800c2c2fdc67829cdfbf8062925564`, tree
  `752a6d8faae955cda705cb23e9cae0fccedd8718`. Original input and ZIP-member checks
  passed. [Candidate receipt](flight-practice-publication-20261014/optional-candidate-verification.json)
  and [artifact byte/hash inventory](flight-practice-publication-20261014/optional-packages.json)
  are retained in the repository. The development candidate uses the checkout's
  `v0.151.1`; this does not allocate a release or authorize reuse of that tag.
  `publicEligible` remains **false**.
- Candidate output is retained at
  `/Volumes/alex/CodexMigrationStaging/flight-practice-publication.sMOWmR/candidate`.
  Gym uses 85/87 files, Flight Studio 91/96, World Studio 126/128. Upcoming SIM
  dependencies need explicit allowance and admission; no limit was relaxed here.
- Complete main-site build/capacity verification: pending while this report is
  being updated. Initial local attempts stopped before a build due to an
  abbreviated revision argument and omitted tracked documentation in the sparse
  checkout. The retry uses a full SHA and complete tracked checkout.
- Physical devices, screen readers, installed-app OS restart, human learning and
  performance qualification: not performed by this publication change.
- No release allocated, uploaded, published or selected. No existing review gate
  was marked passed or waived.

At the initial live check, `main-deployment.json` identified
`460169d79f17fca76a7ee5902caf129c6a7bd729`, and `practice/index.json` returned HTTP
404. This repair is not publicly effective until its reviewed merge deploys.

## Remaining order

1. Merge this publication repair through normal checks; verify that the empty
   directory is actually reachable on Pages. This fixes the missing endpoint,
   not the absence of reviewed releases.
2. Include accepted SIM safety changes in a new, clean, committed-source candidate
   for all three apps. Record exact source/tree, artifact hashes and limitations.
3. Complete source-bound player, installed/offline, update/rollback, preservation,
   input/accessibility, performance and human-learning evidence required by the
   existing admission policy. Reuse SIM evidence only when its source and scope
   genuinely match; do not substitute old or synthetic fixture receipts.
4. Through the existing release owner/process, allocate the correct version,
   upload/download-verify originals, publish and commit the reviewed selector.
   Confirm all three public one-Play journeys and genuine offline relaunches.
5. Extend the fourth-package recipe from its automated registration/update/
   retirement fixture to a real browser journey, without publishing the sample.
   Continue wider device and first-time-player testing after the baseline release.

The explicit empty selector is intentional until review and release evidence
exist. Filling it with development previews would bypass admission rather than
complete the feature. See [the maintainer workflow](flight-practice-maintainer.md)
and [historical evidence](flight-practice-verification.md).
