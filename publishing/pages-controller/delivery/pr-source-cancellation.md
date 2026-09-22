# Cancel superseded PR source checks

A failed, superseded PR source run can keep its repaired head pending because
`source-gates-${{ github.ref }}` previously disabled cancellation for every event.
This occurred in PR225: failed run35673216761 held the repaired run35676036012.
After an exact event/branch/head/failure check, cancelling the obsolete run let
the repaired head start. Old failures remain visible in Actions.

Change only source-workflow cancellation: a new `pull_request` run cancels the
previous run in that PR's existing concurrency group. Other PRs retain separate
groups. This is run supersession, not a commit-age comparison: a same-head rerun
or a manually rerun older PR attempt can also supersede an active run in that PR
group. Manual and release events still serialize, as do the independent
qualification and Pages publication workflows. All six source gates and exact
source/immutable artifact requirements remain unchanged. Cancellation is not a
passing check; the current head still needs its complete successful run.

The syntax is supported by [GitHub's workflow concurrency documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#concurrency).
The existing workflow contract tests cover the exact PR-only condition and
preserve publisher/release qualification cancellation protections.

This is publishing infrastructure and does not change a frozen game version.
Adopt through a separate infrastructure PR after its controller preview succeeds.
The merge triggers the existing serialized frozen Pages publisher; coordinate it
with selector changes and active publication. No game version is assigned. On the first
subsequent PR update, inspect the superseded run and current-head run in Actions;
local contract tests do not simulate GitHub's scheduler or certify that behavior.
