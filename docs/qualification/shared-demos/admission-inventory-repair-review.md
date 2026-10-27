# Complete PR changed-path inventory — applied repair review

The reviewed cache-only patch was applied after the parent released the source
freeze on 2026-10-18. It changes only publishing/admission-preflight.mjs and
adds its regression test. No workflow,
policy file list, privileged controller, permission, game, replay, or package
source changes are included.

## Why

GitHub limits the pull-request files endpoint to 3,000 rows:
https://docs.github.com/en/rest/pulls/pulls#list-pull-requests-files

PR #1615 exceeded that endpoint. The live proof captured head
ea2c2fce7d4c4ae9750f3aa796253c309196cc24 against base
461ace72e78f8cbd77c26549381d9e21d0a65e91 with 3,079 changed files.

## Behavior and completeness

For at most 3,000 files, retain exact row-count equality, bounded pagination,
duplicate/path validation and both rename endpoints. A full page below the
endpoint limit still requires a following page, so an incorrectly small count
cannot hide undeclared files.

For larger inventories, request the exact SHA comparison's second page only for
merge-base metadata; GitHub includes file patches only on its first page:
https://docs.github.com/en/rest/commits/commits#compare-two-commits

Validate the comparison URL, base SHA, status/counts, and merge-base shape.
An ahead comparison must use the supplied base as its merge-base. A genuinely
diverged comparison may use its older common ancestor. The head itself cannot
be the merge-base of an asserted nonempty PR diff.

Load Git commit metadata for that merge-base and exact head, then their
recursive Git trees. Each tree must be explicitly nontruncated, at most 100,000
entries and at most 32 MiB of JSON. Reconstruct every directory's native Git
object hash, including the requested root. Missing children, incomplete
ancestors, altered rows, duplicates, bad modes and false completeness claims
cannot pass this identity check. Directory ordering uses UTF-8 bytes and Git's
directory slash ordering, not locale sorting.

Git modes remain exact: ordinary/executable blobs, symlinks, trees and gitlinks.
Only leaves are diffed by path, mode, type and object identity. Both the deleted
and added paths of a rename are retained. No rename heuristic may omit a path.

The count interval is only a consistency check:
modified + max(added, deleted) <= changed_files <= modified + added + deleted.
GitHub counts a paired rename once, whereas the complete path set retains both
ends. The reconstructed tree identities establish completeness, not this count
interval. When no endpoints can pair, equality is required.

The original preflight guards still bind event head/base, returned PR identity,
receipt policy/dependencies, and a fresh post-read PR observation. The new check
also rejects a changed reported file count. No receipt or gate is written when
any guard fails.

API requests add a 30-second timeout and now stop reading beyond 32 MiB;
invalid UTF-8, malformed JSON, non-success HTTP responses and read failures
fail closed. There are at most 30 file-page requests for ordinary PRs or five
metadata requests for the tree fallback, in addition to the two PR reads.

## Live proof

admission-inventory-live-proof.json records exact equality between all 3,079 returned paths and
local Git's --no-renames, --no-ext-diff, --no-textconv comparison at those same
immutable revisions. Full preflight then selected the existing maintenance
classification and 43 focused commands. No Git checkout, blob download or PR
code execution is needed by the fallback.

The two live recursive responses contained 48,131 and 51,164 entries and
reported truncated:false. Their complete JSON bodies were approximately
13.8 and 14.7 MB. Although the GitHub documentation describes a 7 MB tree limit,
the actual JSON envelopes are larger, so this patch explicitly bounds the
whole response at 32 MiB rather than assuming 7 MB is the wire response size:
https://docs.github.com/en/rest/git/trees#get-a-tree

Authenticated API capture ran separately. The offline helper proof ran with
GH_TOKEN and GITHUB_TOKEN removed. Raw metadata remains in the task cache and is not part of the source patch.
The durable proof summaries bind only the immutable revisions listed above;
they do not claim to have evaluated a later PR head.

## Trust and bootstrap

The existing preflight checkout pins github.workflow_sha, not protected main.
For a pull_request event this can be the synthetic merge commit containing
the candidate policy change, so the corrected preflight can run on a new push.
The helper fetches metadata only and never fetches or executes PR blobs.

release-ready combines preflight/focused/test/build results and does not itself
compare candidate policy blobs with protected main. The privileged auto-merge
controller does perform that comparison from protected main. admission-preflight
is already in POLICY_FILES, so this patch changes its policy digest and cannot
self-authorize privileged auto-merge. No exception, bypass, approval, changed
permission or controller modification is included. A separately reviewed
protected-main policy bootstrap would be needed for that path; no merge or
deployment is requested.

The controller's existing independent 3,000-file cap remains unchanged. It is
used when checking a narrowly reviewed policy exception; it is a separate
limitation, not silently bypassed here.

No new executable dependency is added, so the existing preflight sparse
checkout and policy digest cover the complete implementation. The focused test
selector already discovers changed *.test.mjs files, so the new test is selected
without changing focused-test-map.json.

## Regression and single-commit checks

The combined preflight, admission-binding, source-workflow and unchanged
privileged-controller regression suites pass. ESLint and Prettier pass for the
two applied files. All 85 tests passed in the actual worktree; the durable TAP
receipt is admission-inventory-repair-regressions.tap.txt. The test oracle hashes fixture tree objects using Git
without writing Git objects, using a bounded temporary input file rather than
an unbounded subprocess pipe.

The actual comparison from e8f6f0ebd01f342d6a9b937f740e15a9bdb75f16 to
ea2c2fce7d4c4ae9750f3aa796253c309196cc24 has ahead_by=1 and total_commits=1.
Its second page returns an empty commits array but still supplies the exact
base, merge-base, status and comparison URL. This passed; see
admission-inventory-single-commit-proof.json. The raw API response remains
in the task cache and is not included in the repository.

## Remaining limits

An API-truncated tree or a repository exceeding the explicit metadata limits
fails closed. Supporting such a repository would require a separately bounded
subtree traversal. Unrepresentable UTF-8, control characters, backslashes and
unsafe relative paths are rejected rather than written to the line-based
focused-path inventory. Unusual rename behavior outside the documented count
interval also rejects instead of pretending exact count agreement.

The applied patch SHA-256 is
e816e105cdbfea98c28b5cb64e42a4d95f73f49ba5a89b3d6c95443a3cd48439.
The preceding 26-minute rotation was stopped and retained only as incomplete,
superseded evidence; it earns no two-hour endurance credit. A new complete
rotation and final packaging follow the combined source freeze. This repair
does not itself claim that the hosted CI run has passed; that requires the
next pushed head to run the checks.
