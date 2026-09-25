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
- Documentation, Pages-controller, and workflow-only maintenance remains
  eligible without consuming a product version.
- After the promoted root merges, qualify/freeze/release it once, complete the
  separate Pages selector and public acceptance, then promote the next root.

This does not turn deferred tests into passing tests. The repository's explicit
fast-release test policy still governs the suites that run for a promoted root.
