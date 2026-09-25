# Temporary fast-release mode

Fast-release mode is active by explicit owner direction from **24 September 2026**. It remains the
repository default until the owner explicitly asks to restore the full pipeline. Deferred checks
have not passed and must never be described as passing.

The repository Actions variable `REVEALLINE_FULL_CI` is the operational switch. Its fast-mode value
is `false`. A missing value is also treated as `false`, so deleting the variable cannot silently
restore blocking tests.

## What blocks a source pull request

The `Build and deploy GitHub Pages` workflow keeps only the minimum release path blocking:

1. exact pull-request head and tracked-source identity before commands;
2. dependency installation;
3. release-critical source and distribution-reference validation (`npm run validate`);
4. an explicit deferral of the complete artifact build to merged-source qualification;
5. exact tracked-source identity after the fast release gate; and
6. the aggregate `release-ready` result.

The preflight and build remain separate job names because frozen-release evidence binds those exact
contexts. Preflight records only the test policy; the build job is the sole PR source checkout and
performs validation plus required identity checks before and after the fast gate. It does **not**
assemble the several-hundred-megabyte distribution in fast mode. Superseded runs for the same PR
are cancelled by the workflow concurrency group. Pages previews use a partial sparse checkout of
the controller, workflow contracts, test policy, and two archive helpers while retaining all tags
and on-demand Git objects needed to verify frozen source identities. Production publications remain
serialized and are never cancelled by a newer run.

The staging workflow uses the same bounded maintenance paths as preflight. Documentation,
publishing/controller, workflow, and `game/test/`-only pull requests may remain ready without a
product version; mixed or runtime changes still return to draft until they receive an exact release
title or the explicit `release-train-approved` label.

Release-title pull requests also fail closed until the previous latest stable release is both the
reviewed selector on `main` and the version actually served by the public root and versioned game
bytes. Their title version, package version, lockfile versions, and game build version must match
before dependency installation. This prevents concurrent agents from merging a new source release
while its predecessor is still waiting for archive/selector/Pages acceptance, and catches partial
version bumps before the expensive post-merge freeze.

These checks are deferred from the pull-request workflow in fast mode and cannot block merge:

- all four full test shards;
- immutable-production test suites;
- ESLint;
- source and native Prettier checks;
- motion-lab syntax and extended Field Kit provenance checks; and
- focused Pages-controller unit tests.

The complete deterministic `npm run build` is also deferred from the pull request, but it is not
waived for release. Merged-source qualification builds it once from the exact merge commit, freezes
it, and independently inspects its original bytes before publication. This removes the duplicate PR
artifact assembly while preserving the authoritative post-merge release artifact gate.

Before an immutable release is frozen, manual source qualification still requires validation,
ESLint, source and native formatting, motion-lab syntax, Field Kit reproduction/readiness, and exact
tracked-source identity. Those bounded gates are release evidence, not long automated suites. The
full test shards and utility suites remain waived and must not be reported as passing.

The release workflow deliberately ignores `run_tests=true` while fast mode is active. This prevents
an accidental manual dispatch from starting four large test checkouts and delaying a release. Do not
use this workflow for ad-hoc test runs during the waiver; restore full CI first if automated suites
need to be re-enabled.

## What still blocks GitHub Pages

Fast pull-request previews validate the selector, highest stable release match, admitted archives,
metadata, and bounded extraction rules without assembling the complete Pages artifact. Exact
artifact assembly and the independent reread of every prepared byte are deferred to the main
publication, where they remain mandatory together with the final latest-release recheck and the
main-only `github-pages` deployment environment. These checks prevent publishing the wrong or
corrupt frozen release and are not waived.

The release event only routes an eligible tag to the sole publisher. It does not rebuild historical
source or rerun the full test suite. Source-qualification consumer changes, workflow, policy, skill,
documentation, evidence-only, and controller-test-only merges receive their bounded pull-request
validation but do not redeploy unchanged Pages bytes after merge. A reviewed selector change or an
eligible release event remains the production trigger.

## Restore the full pipeline

Restoration is a deliberate two-part change so one setting cannot unexpectedly make tests blocking
during an active release:

1. Open and merge a reviewed PR that changes `publishing/test-policy.json` from `waived` to
   `required`, updates its reason/restoration text, and updates any authorization constant required
   by that policy schema. Run the policy and Pages-controller tests in that PR. The tracked workflow
   already restores the PR artifact build automatically when `REVEALLINE_FULL_CI=true`.
2. After that PR is on `main`, set the repository variable:

   ```sh
   gh variable set REVEALLINE_FULL_CI --repo mekhovov/revealline --body true
   ```

3. Run **Qualify release source** once on current `main` with `run_tests=true`. Confirm all four
   shards, the already-mandatory static and production checks, source identity, and build pass. The
   request is honored only after the repository variable is `true`.
4. If branch protection is introduced, require only `release-ready`, not the individual shard
   contexts. `release-ready` requires tests whenever `REVEALLINE_FULL_CI=true`.
5. Update this document and `docs/deployment.md` in the same reviewed PR to state that full CI is
   restored.

Duplicate manual qualification dispatches for the same immutable source SHA are rejected before a
repository checkout. Qualify only a PR head that is stable and already has a successful
`release-ready` check; after merge, qualify the resulting `main` SHA once. Do not rewrite release
tags or published assets.
