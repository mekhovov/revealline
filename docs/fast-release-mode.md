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
4. the ordinary deterministic static build (`npm run build`);
5. exact tracked-source identity after the build; and
6. the aggregate `release-ready` result.

The preflight and build remain separate job names because frozen-release evidence binds those exact
contexts. Preflight records only the test policy; the build job is the sole PR source checkout and
performs the required identity check before and after the build. Superseded runs for the same PR are
cancelled by the workflow concurrency group. Pages previews use a partial sparse checkout of
the controller, workflow contracts, test policy, and two archive helpers while retaining all tags
and on-demand Git objects needed to verify frozen source identities. Production publications remain
serialized and are never cancelled by a newer run.

These checks are deferred from the pull-request workflow in fast mode and cannot block merge:

- all four full test shards;
- immutable-production test suites;
- ESLint;
- source and native Prettier checks;
- motion-lab syntax and extended Field Kit provenance checks; and
- focused Pages-controller unit tests.

Before an immutable release is frozen, manual source qualification still requires validation,
ESLint, source and native formatting, motion-lab syntax, Field Kit reproduction/readiness, and exact
tracked-source identity. Those bounded gates are release evidence, not long automated suites. The
full test shards and utility suites remain waived and must not be reported as passing.

The release workflow deliberately ignores `run_tests=true` while fast mode is active. This prevents
an accidental manual dispatch from starting four large test checkouts and delaying a release. Do not
use this workflow for ad-hoc test runs during the waiver; restore full CI first if automated suites
need to be re-enabled.

## What still blocks GitHub Pages

Publication continues to require the reviewed main selector, the highest stable release match,
bounded ZIP extraction, frozen archive and metadata validation, exact artifact assembly, an
independent reread of every prepared artifact byte, a final latest-release recheck, and the
main-only `github-pages` deployment environment. These checks prevent publishing the wrong or
corrupt frozen release and are not performance-only validation.

The release event only routes an eligible tag to the sole publisher. It does not rebuild historical
source or rerun the full test suite. Workflow, policy, skill, documentation, evidence-only, and
controller-test-only merges receive their pull-request preview but do not redeploy unchanged Pages
bytes after merge. A reviewed selector change or an eligible release event remains the production
trigger.

## Restore the full pipeline

Restoration is a deliberate two-part change so one setting cannot unexpectedly make tests blocking
during an active release:

1. Open and merge a reviewed PR that changes `publishing/test-policy.json` from `waived` to
   `required`, updates its reason/restoration text, and updates any authorization constant required
   by that policy schema. Run the policy and Pages-controller tests in that PR.
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
