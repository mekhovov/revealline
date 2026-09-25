# Release train

RevealLine keeps development parallel and publishing serial.

- Keep exploratory features and dependent slices as drafts or stacked pull requests.
- Promote only one reviewed product root at a time by naming it `Release vX.Y.Z …`.
- The promoted root receives the hosted source build. Product PRs without that
  title are intentionally held before a costly build and cannot merge by the
  release-ready check.
- New non-release pull requests are automatically returned to draft status.
  For an exceptional non-product maintenance PR, apply the
  `release-train-approved` label before marking it ready for review.
- Documentation, test-only evidence under `game/test/`, Pages-controller, and
  workflow-only maintenance remain eligible without consuming a product
  version. A PR that also changes runtime remains product work.
- A promoted release PR may aggregate several independently reviewed roots when
  their dependency order is explicit. Review every merge delta, build the exact
  aggregate once, and preserve each source PR and its focused evidence.
- Frozen Pages previews run only when selector/controller code, its workflow, or
  an artifact-building helper changes. Ordinary product-build policy and docs
  changes do not rebuild the multi-gigabyte historical site.
- After the promoted root merges, qualify/freeze/release it once, complete the
  separate Pages selector and public acceptance, then promote the next root.
- Expensive source qualification is accepted only from merged `main`. Candidate
  and stacked branches keep their focused review evidence but cannot consume the
  freeze lane before their exact source is merged.

This does not turn deferred tests into passing tests. The repository's explicit
fast-release test policy still governs the suites that run for a promoted root.

## Restore the full pipeline

Keep fast-release mode in place until the repository owner explicitly asks to
restore the previous pipeline. Restore it in a dedicated maintenance pull
request, not in a product release:

1. Set the repository variable `REVEALLINE_FULL_CI` to `true`.
2. Remove the release-title admission condition from the `test` and `build`
   jobs in `.github/workflows/deploy-pages.yml`, and return `release-ready` to
   requiring successful preflight, build, and test jobs for every product pull
   request.
3. Retire `.github/workflows/stage-unallocated-pr.yml` if every ready pull
   request should again enter CI immediately. Remove the
   `release-train-approved` label only after no open pull request depends on it.
4. Restore any desired automatic source-qualification branch trigger in
   `.github/workflows/qualify-release-source.yml`; keep duplicate frozen-source
   protection unless there is a reviewed reason to permit repeated snapshots.
5. Expand `.github/workflows/publish-frozen-pages.yml` path filters only for
   files that truly change Pages output. Do not restore unrelated documentation
   or test-policy paths merely to imitate the former runner load.
6. Validate the workflow YAML, run one full-CI specimen on the exact restoration
   head, merge with a merge commit, and verify the first post-merge source
   qualification and Pages deployment before removing fast-release notices.

Record skipped suites as skipped until that restoration specimen succeeds; the
mode change cannot retroactively turn waived checks into passes.
