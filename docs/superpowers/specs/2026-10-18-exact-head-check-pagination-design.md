# Bounded complete exact-head check collection

Date: 2026-10-18. Status: proposed written specification; conceptual design
approved, implementation not authorized until written review is approved.

## Purpose and observed defect

Remove the merge controller's one-page check-inventory limit without allowing
an incomplete, changing or incorrectly combined inventory to authorize action.
This is one controller correction, not a new merge policy or a CI repair.

At current main `b7f65a138d34c8a62d58246f3be9de86564c4279`, installed
`publishing/fastline-merge-controller.mjs` has Git blob
`66bbea0885bc33368b34d4ccaa09efc5c73002fc` (31,489 bytes). Both its initial
read and final mutation read request only `per_page=100`. The observed
`#1544` head `c621886709157a969cf4ff1df52a328a5f94df92` returned
`total_count=142` and 100 rows in a dated single-page read; later complete
observations contained 144 rows. The controller correctly refuses an incomplete
inventory, but cannot obtain the remaining pages. Actual failing checks also
exist on that head: this correction does not make #1544 eligible by itself.

The existing name-only latest-result map is not a safe way to combine additional
pages: distinct workflows or matrix jobs can reuse a display name. Completeness
must not be gained by dropping a different failed or pending check.

## Chosen approach and alternatives

Implement a read-only, injected-API collector inside the existing controller,
with pure validation/canonicalization helpers and tests in its existing test
file. Use the same collector at the initial decision and immediately before
each merge-capable action. Retain the installed-main source-admission path.

Alternatives considered:

- Merely increase page size: GitHub's maximum is 100, so it does not work.
- Leave the controller unchanged and use fully verified manual merges: safe
  when every other safeguard permits, but does not remove the automation limit.
- Add a new workflow or service: unnecessary authority and operational scope.

## Hard invariants and non-goals

- No permission, token, workflow trigger, branch-protection or merge-method
  expansion. No candidate code executes in the privileged controller.
- No change to the seven protected policy-file identities, reviewed source
  approval records, receipt format, repository/head/base binding or dependency
  rules. No new source-approval exception.
- Draft, closed, unknown-mergeability, conflicted, stale-main or wrong-head PRs
  remain ineligible. Preserve exact-head merge requests and final source and
  dependency revalidation. No auto-merge waiting assumption or admin override.
- All applicable checks must complete successfully. Only the existing source
  workflow's `focused`, `test` and `build` policy skips remain allowed; no new skip or
  neutral/cancelled/timed-out allowance. Bind these exceptions to verified job
  provenance, not an arbitrary check with the same display name.
- Preserve the controller's necessary self-reconcile exclusion, but identify
  only this invocation's verified controller job, not every check named
  `reconcile`. Other jobs with that name remain ordinary gates.
- No runtime, fixture, deadline, assertion, host-retirement, capacity, deployment,
  browser/native or preservation qualification change. 980,000,000-byte guards
  remain unchanged. This correction establishes no Pages reserve or target.
- No CI dispatch/retry, check modification or check deletion. No cleanup of
  user data, development state, browser profiles or Git objects.

## Collection contract

Inputs: trusted repository identity, exact 40-character head SHA, injected
read-only GitHub API function and trusted invocation identity. All URLs use that
literal SHA and the same repository; never a mutable branch name or caller URL.

Output is either an explicit incomplete/error result with a reason, or a
validated inventory containing repository/head, canonical suite/check/status
records, counts, observation interval and `complete: true`. Completeness alone
is never merge authority. A thrown API error cannot become an empty successful
inventory. No partially accumulated array may reach the decision evaluator.

One full sweep consists of:

1. Enumerate exact-head check suites with 100 rows per page, a strict maximum
   of 1,000 suites, stable integer `total_count`, exact expected page lengths,
   globally unique positive suite IDs, matching repository/head and app
   identities. The suite list must be complete, not only the first page.
2. Collect exact-head check runs with explicit `filter=all`, 100 rows per page,
   a strict maximum of 1,000 records across the entire head, stable integer
   `total_count` and exact expected page lengths. Validate each positive unique
   run ID, exact head, nonempty name, app ID, listed suite membership, status
   and status/conclusion consistency. Do not use name/status/app filters to
   shrink this inventory. Reject conflicting identity fields or an unlisted
   suite. A suite that has created no check runs is metadata, not a successful
   check and not a new required gate. Suite enumeration detects truncation and
   validates run membership; it does not introduce a suite-success requirement.
   In particular, queued zero-run installed-app suites must not permanently
   block otherwise eligible PRs. A newly appearing run is detected by the full
   repeated inventory; the required release-ready gate remains independent.
3. Enumerate legacy commit statuses for the same exact SHA, 100 per page,
   at most 1,000 records. Because this endpoint has no total count, require a
   short terminal page; exactly 1,000 records require the next empty page.
   Validate globally unique positive IDs, nonempty contexts and known states.
   Legacy failures/pending states are not ignored simply because check runs
   succeeded. GitHub returns statuses newest first; select the first row in
   that documented order for each case-insensitive context. Never infer
   recency from numeric IDs. Preserve exact original context strings, row order
   and the effective-context derivation; reject inconsistent chronological
   ordering or ambiguous context normalization instead of guessing.

Check-run and suite pages with totals require exact equality between unique
rows and the reported total, not `total <= array.length`. Reject a response with
more rows than requested, missing fields, changed totals, duplicates, missing
middle/terminal rows, foreign heads, unsupported states or a count above bounds.
Validate response pagination links when supplied: an unexplained next page after
the claimed end, or a different repository/resource, is an error. Requests are
bounded: at most 64 read requests and 120 seconds per sweep, no request timeout
above 30 seconds, and no increase to the existing controller job deadline. A
sweep stops when either budget expires. Metadata validation shares these limits;
excessive exception candidates are an explicit operational blocker, not a reason
to skip validation. Permission/rate-limit/network failures produce
an operational blocker, never a passing check or a fabricated code failure.

GitHub documents that the reference check-run endpoint includes only the most
recent 1,000 suites when a ref has more suites. The independently complete suite
inventory prevents interpreting that truncation as completeness: more than
1,000 suites is unsupported and fails closed. No attempt to silently expand the
bound or fall back to a partial endpoint is allowed. All run pages use `all`;
the record bound counts historical records too.

## Check identity, historical runs and exceptions

Keep every collected check-run ID. Do not collapse by display name, highest
global ID, workflow display name or result timestamp. In this bounded correction
there is **no new cross-ID or cross-suite historical-run supersession rule**:
every distinct returned non-exempt run must satisfy the success gate. A same-ID
result updated by its provider is evaluated at its freshly observed state.

This conservative rule can leave a same-head rerun blocked by a retained older
failed run. That is an explicit safety trade-off, not a reason to waive it or
retry CI. A future automated supersession design would require separate evidence
and review; an already-authorized manual merge still requires independently
proven historical/non-applicable classification and every other safeguard.

Resolve exception provenance using GitHub-owned Actions metadata, not by trusting
`details_url`, a PR body or an arbitrary check's name. Join a check ID to the
actual job in the repository and exact-head run/attempt, then to the trusted
workflow identity/path from installed main. Only the current invocation's
controller job may use the self-reconcile exclusion. Only `focused`/`test`/`build` jobs of
the existing trusted validation workflow may use its existing policy skip.
If this join is missing, ambiguous, foreign or changes, the exception is not
granted. Ordinary successful checks need no extra Actions-specific provenance.
Metadata reads share the sweep's finite operation/time bounds and stable-state
validation. Their result does not authorize any new privilege or check waiver.

The `release-ready` admission check must also be an identified job of the trusted
validation workflow. Ambiguous candidates fail closed rather than selecting an
unrelated greatest-ID job. The final receipt remains tied to that exact check ID,
head/base/source/policy identities under the unchanged installed admission logic.

## Freshness and action sequence

Perform **two complete sweeps** for one accepted inventory. Compare canonical
check/suite records sorted by immutable ID; legacy statuses preserve documented
row order and effective case-insensitive context selection. Compare every field used by gates or exception/admission
identity: repository/head, IDs, suite/app/job/run/attempt/workflow identities,
names, statuses, conclusions, relevant timestamps, totals and legacy states.
All pages are recollected in sweep two; refreshing only page one is insufficient.
Output/annotations text need not match because they cannot authorize a gate.

Any added/removed/replaced row, changed state/count or exception binding during
these sweeps rejects the observation. Do not blend an early state with a later
count, loop until green or automatically rerun CI. A later normal controller
invocation can collect a new observation. Record that the observation is not an
atomic GitHub transaction: two sweeps detect observed changes, not every
possible transient change between reads.

Initial decision: trusted-main/PR reads, accepted two-sweep inventory, source
receipt and dependencies, then the existing action decision.

Before each `update`, `stack`, `merge` or `arm`: re-read PR identity/draft/base,
collect another full two-sweep inventory, re-read dependencies and current main,
revalidate the same admitted release-ready identity and all existing source
approval/freshness conditions, and recompute the action. The previous complete
inventory is not reusable permission. Any action/identity change prevents the
merge-capable mutation. Existing protective disarm/status reporting may still
operate when ineligible; their purpose is not to authorize merging.

If an exact-head merge request is rejected and the existing controller considers
its permitted `mergeStack` fallback, that is a second merge-capable request:
collect and revalidate the entire final snapshot again before the fallback.
Do not reuse the snapshot preceding the rejected merge or assume failure means
no other actor changed the PR. Check current state first to avoid a duplicate
attempt if another actor already merged it.

API reads and a later merge cannot be made atomic by this change. Preserve exact
head matching and all existing platform/source safeguards; do not claim the race
window is eliminated. Publish bounded diagnostic reasons and counts without
credentials or candidate-controlled executable output.

## Verification required before qualification

Use deterministic injected-API fixtures and controller action-spies; no full
checkout/build, real merge, CI retry or large artifact download is needed.

- Counts 0, 1, 99, 100, 101, 142/144 and 1,000; reject 1,001. Check suites and
  legacy statuses have their own bound/terminal-page cases. Zero check runs
  cannot satisfy the independently required release-ready gate. An unrelated
  queued zero-run app suite is not treated as a failed check or a pass.
- A stable 144-record successful fixture reaches the same eligible decision as
  a small complete fixture; no page is omitted. Pending/failure on the last
  page blocks it. Actual current #1544's failed gates still block it.
- Duplicate IDs, page overlaps/holes, wrong head/app/suite, truncated tails,
  count shrink/growth, malformed states, wrong resource links and API failures
  yield no merge-capable action.
- Change only a later-page conclusion, replace IDs without changing counts,
  add/remove a legacy context, mutate an exception's workflow/job identity or
  change suite membership between sweeps: reject. A page-one-only recheck must
  demonstrably fail these regressions.
- A newer lower-ID legacy failure or pending state must not be shadowed by an
  older higher-ID success. `CI` and `ci` are the same legacy context; newest
  documented-order status wins, including failure-to-success and the reverse.
- Same display name in separate suites/apps/matrix jobs: failure/pending cannot
  be shadowed by another success. An older distinct failed run is not silently
  superseded. Spoofed `reconcile`, `release-ready`, `focused`, `test` or `build` names do not
  obtain exemptions or admission.
- Preserve all existing controller/admission/draft/main/head/base/dependency
  tests, including same-SHA base-ref retarget and final action races. Mutate each
  before each action-spy boundary and require zero merge-capable writes.
- Verify unchanged permission/workflow/protected-policy inventories and compare
  all actual changed paths. No hidden test-registration omission: prefer the
  existing controller test command; any protected-map change requires its own
  reviewed exact-source admission route, not self-authorization.

## Rollout and completion boundary

After independent spec review, publish this document alone for user written
review. Only after that approval, create the bounded implementation plan and
correction, independent code review, explicit focused routing, all exact-head
hosted gates and actual installed-main ordinary source admission. No current
branch or PR is automatically made ready by this specification.

Merge only when every existing safeguard permits; verify MERGED, main ancestry,
preserved source branch and source-bound production after any accepted controller
change. Then inspect a real >100-check PR read-only. Completion means the
controller can validate a stable complete bounded inventory and still refuses
all genuine failures/staleness; it does not mean every PR or capacity objective
is complete. If exact source or API assumptions no longer match, refresh the
evidence and review rather than substituting an old approval.

## Primary API references

- [Check runs: ref and suite listing, filter and page bounds](https://docs.github.com/en/rest/checks/runs?apiVersion=latest).
- [Check suites: exact-ref inventory and re-request semantics](https://docs.github.com/en/rest/checks/suites?apiVersion=2022-11-28).
- [Legacy commit statuses](https://docs.github.com/en/rest/commits/statuses?apiVersion=latest).
- [Actions jobs and workflow-run identities](https://docs.github.com/en/rest/actions/workflow-jobs?apiVersion=latest).

References explain API contracts, not proof of this repository's admission,
completed CI, deployment, historical-run equivalence or capacity qualification.
