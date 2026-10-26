# Targeted-CI throughput implementation plan

Approved specification: commit `7b2a5954dd49f61b8454d1d486dc36fddcfe27b3`,
`docs/superpowers/specs/2026-10-18-targeted-ci-throughput-design.md`.
The user approved the written specification on 2026-10-18. Implementation is
authorized; no further conceptual or written-design approval is pending.

Current starting main: `237b405437def3c41b01165fe057af1ab06f618c`.
The 66-PR timing audit and reviewed specification remain dated baseline evidence,
not current merge qualification. Preserve every previous source and timing record.

## Execution boundary

Use only the approved external checkout and bounded external scratch capsules.
The checkout's old HEAD/index and unrelated user edits remain untouched. Do not
copy the stale local focused selector over current main. Start from verified
Gitblob identities in the existing source audit and freshly verify those against
current main before publication. Publish only explicitly reviewed paths via the
existing source-pinned process; no force push, reset, broad cleanup or bulk build.

The executing-plans skill is available; its companion writing-plans and
subagent-driven-development skills are unavailable. This explicit task plan is
the fallback, with independent review and bounded verification before rollout.

## Priority 1 — compact focused runners, unchanged coverage

- [x] 1. Pure plan and receipt contract — PRIVATE IMPLEMENTATION VERIFIED AND REVIEWED; no live rollout.
  - Implement a bounded, deterministic final-command assignment: zero workers
    for zero commands; otherwise `min(4, commandCount)` nonempty workers.
  - Bind the complete command plan, unchanged command arguments/deadlines,
    exact head/tree, reported base/ref, trusted automation/policy/manifest,
    runtime/setup and workflow run/attempt. A plan is never merge authority.
  - Require exactly the expected receipts, disjoint complete assignments,
    matching identities, executed IDs and successful outcomes. Reject empty,
    missing, duplicate, extra, stale, cancelled or incomplete execution.
  - Preserve the existing v1 four-shard path until the workflow migration is
    tested. New contract helpers remain unused by production during this unit.
  - Verify 0–4 and larger command counts plus adversarial receipt mutations.
- [x] 2. Prepare the final plan within existing preflight — PRIVATE ACQUISITION/CLI/WORKFLOW VERIFIED; no live rollout.
  - Reuse trusted selection, explicit test policy and existing exact package
    deduplication; never size a matrix from the earlier pre-dedup command count.
  - Acquire exact-head package/config/file inputs read-only and bind the source
    tree. Candidate scripts/planner code must not execute with preflight tokens.
  - Prove equivalent inputs and shell semantics to current workers; unknown
    configuration cannot authorize deduplication or an empty plan. Preserve
    selected obligations and existing package/lifecycle-hook semantics.
  - Upload a separate run/attempt-bound plan beside the unchanged admission
    receipt. Workers reconstruct and compare the final plan before execution;
    aggregation compares against the trusted preflight plan, not worker consensus.
  - Do not add a new serial workflow or test-runner admission just to plan work.
- [x] 3. Dynamic workers and status compatibility — PRIVATE MATRIX/READY/CONTROLLER VERIFIED AND REVIEWED; no live rollout.
  - Change only focused matrix construction, plan verification and receipts.
    Keep Node 20.19.x, exact-head checkout, max four shards/two command workers,
    90-minute job bound, all command deadlines, root and authoring installations,
    source checks, artifact retention and permissions unchanged.
  - Example zero-work case: a selector-proven docs-only path yields a typed
    `no-selected-commands` proof and no worker receipts. Both focused jobs stay
    skipped; the existing `release-ready` job authenticates non-applicability
    rather than adding another queued aggregate runner or claiming test success.
    The public `focused` and `release-ready` decision must validate this contract.
    A malformed/missing plan or skipped required worker remains a blocker.
  - Keep all existing independent feature/appearance/company/full-build jobs
    unchanged. Reconcile #1654's separate cancellation patch without replacing
    it or assuming it is already admitted.
- [ ] 4. Verify checkpoint 1.
  - Pin an obligation inventory: workflow path/revision, head versus synthetic
    source context, exact Node/runtime, install flags/locks, commands, artifacts
    and public check names. Preserve every original negative control.
  - Run focused plan/receipt/CLI integration tests, then relevant existing
    selector, waiver, workflow, admission and controller contract tests from a
    complete exact-current-source capsule. No full gameplay build is needed.
  - Replay the 61 frozen baseline rows: command union must be byte-identical;
    only assignment/worker count may change. Historical replay is not admission.
  - Independently review source and status/credential boundaries. Resolve any
    concrete defect without loosening assertions, deadlines or workloads.
- [ ] 5. Publish and qualify checkpoint 1.
  - Inventory all open old-policy heads and their workflow-bound receipts.
    Define old/new migration before protected-policy publication. Old receipts
    retain their old contract; no blanket rebases, retries or relabelled passes.
  - Use a newly reviewed exact-source main-owned admission path for changed
    protected policy files; old #1553/#1558 exceptions are not reusable.
  - Publish one scoped implementation PR after local verification/review; do not
    create a queue of tiny unfinished infrastructure PRs.
  - Require all exact-head gates and applicable production/source safeguards.
    Verify merge/main reachability, branch preservation and source-bound deploy.
  - Observe hosted one-command and multi-command canaries: no empty worker,
    complete receipts, unchanged coverage, valid final admission. Record actual
    execution and queue wait separately; do not claim savings before observation.

## Priority 2 — shadow affected-consumer planning

- [ ] Build the reviewed ownership/dependency obligation inventory across current
      workflows, keeping Node 20/22 and head/synthetic executions separate.
- [ ] Add changed-test, shared-helper, reverse/dynamic consumer, generated-input,
      rename/delete/copy, lock/config and unknown-path regressions. Unknown stays broad.
- [ ] Shadow the frozen 61 audit rows and fresh canaries while live selection is
      unchanged. Explain every discrepancy before enabling any omission.

## Priority 3 — prove the small-change fast lane

- [ ] Define a complete trusted shipping/build/toolchain input inventory and the
      accepted comparison context. Prove every relevant input byte-identical.
- [ ] Include a behind-main negative example: equality against an old merge base
      does not qualify a candidate if its combined current-main build inputs differ.
- [ ] Enable only reviewed allowlisted docs/test cases; retain affected tests,
      source/security/preservation and actual build/archive boundaries where required.
- [ ] Roll out one workflow/owner at a time. Never deduplicate different runtime,
      setup, lock or source contexts merely because tests have similar names.

## Priority 4 — measured throughput and remaining queue

- [ ] Compare job count, runner-minutes, execution time, runnable queue wait and
      head-to-ready time by canary class, with sample counts and honest P50/P95 limits.
- [ ] Consider aggregate co-location only if dependency/status/privilege rules
      remain unchanged; no new status-writing permission under this approval.
- [ ] Continue independent eligible PR merges parent-first. Draft status alone
      is no hold. Keep code failures, conflicts, pending checks, qualification and
      capacity blockers separate. Never merge while applicable checks are pending.
- [ ] Continue the approved capacity route independently. Latest accepted dated
      archive is 965,601,280 bytes; measured 950 MB and 900 MB remain unfinished.
      CI optimization does not create capacity reserve or waive the 980 MB guards.

## Current progress

2026-10-18 22:38 UTC (2026-10-19 00:38 Europe/Berlin): private checkpoint-1
integration now passes **227 tests, zero failures, skips or cancellations**.
Evidence: `ci-latency-audit-maincb8dddd3/targeted-ci-checkpoint1-migration-raw-bytes.json`
and `.log`. Counts overlap previous runs. Typed zero-work source/provenance/step
validation is implemented and independently reviewed. A fixed complete eleven-file
profile keeps the v2 authority dormant while the bootstrap still uses the old
seven-file policy. Migration acceptance cannot create ordinary v2 skip authority.

The private migration prototype supports only independently frozen complete
old-to-new implementation and new-to-old preservation records. Its installed list
is EMPTY. Exact source/head/ref/base, changed paths, dependencies, both policy
inventories/digests, workflow revision, run/attempt/job/check, artifact digest/size
and raw receipt bytes remain mandatory. Review found one receipt UTF-8 fidelity
issue; both actual migration fixtures failed first, then passed after reading and
hashing the original Buffer and rejecting invalid UTF-8 before JSON parsing.
Independent review found no further concrete defect in these private boundaries.
Original controller assertions, selector and nonfocused test/build jobs remain.

A tiny real Git three-way fixture now proves that the identical legacy-profile
fix shared by the implementation and bootstrap preserves every additional
bootstrap byte and synthetic main-only record. Evidence:
`targeted-ci-shared-legacy-fix-merge-proof.json`. This is a fixture integration
proof, not the final publication head, real approval record or merge authority.
The implementation carries only that compatibility fix in its controller; the
bootstrap carries the reviewed zero-work/migration controller and actual pins.

Current priorities superseding the earlier remaining-work list below:

1. Verify the implementation-only controller against its complete new policy,
   refresh all publication inputs against current main, and publish one scoped
   draft implementation. No live routing changes until independently admitted.
2. Verify its actual source-workflow receipt and freeze eligible old-policy rows.
   Preservation is limited to rows passing the ORIGINAL complete check inventory;
   old zero-work skipped-shard rows are not relabelled v2 or granted a waiver.
   Changed/unlisted/incompatible heads integrate current main only when actionable,
   then qualify fresh. No blanket rebase, retry or inferred supersession.
3. Review exact main-owned bootstrap pins, prove final three-way composition,
   publish/qualify bootstrap and verify production, then recheck implementation
   head/base/ref/receipt/all gates before readiness/merge. An unchanged reported
   base is a condition to verify, not a promise; any mismatch fails closed.
4. Verify implementation production and hosted zero/single/multi-command canaries.
   Only observed complete canaries establish runner or time savings. Then proceed
   to affected-consumer shadowing and proved unchanged-build-input fast lanes.

Latest full queue at 22:35:36 UTC: 74 open, 52 drafts, 18 conflicts, 18 PRs with
failed checks and 33 with pending checks (overlapping categories), no uncertain
snapshots; protected main remains dd337c8120fd6f875544c1479713d3aa4299c323.
Its production run 39168765766 is still pending. No new verified merge or closure
in this interval. No implementation publication, live routing change or savings
has yet occurred. All old source/check evidence remains dated rather than erased.

2026-10-18 22:14 UTC (2026-10-19 00:14 Europe/Berlin): approved checkpoint 1
is implemented privately and has passed **218 tests, zero failures, skips or
cancellations**, including exact-current controller controls. Evidence:
`ci-latency-audit-maincb8dddd3/targeted-ci-checkpoint1-with-legacy-profile.json`
and `.log`. The earlier 162-case result excludes the subsequently added controller
suite; these totals overlap and must not be summed. All candidate JS passed ESLint
under the actual `publishing/` configuration; changed JS/JSON/YAML formatting passed.

Read-only Git acquisition, pure orchestration, strict CLI and tiny real-Git
end-to-end tests now cover zero, one and five actual commands. No dependency
install hooks ran in those fixtures; source, refs and indexes were preserved.
These are local fixtures, not a hosted Linux qualification. Missing exact objects,
malformed trees, escaping/invalid-UTF8 symlinks and changed root/authoring config
fail closed. Acquisition never silently lazy-fetches missing objects.

Independent review found and root fixed two integration defects before rollout:
the privileged main-only sparse checkout was missing the four new policy files,
and zero-work aggregation introduced an unnecessary runner admission. New negative
regressions failed first and then passed. All five policy-consuming sparse
checkouts now contain the complete closure; zero-work proof runs inside the
existing ready job. Seven new regression suites are explicitly registered in
the focused map; no old obligation was removed. Original controller assertions
remain unchanged. Its historical seven-file #1558 approval is recognized only
through its explicit complete ordered legacy profile, not an arbitrary subset.
This profile-shape compatibility grants no new live source admission.

The final scope proof is `targeted-ci-checkpoint1-final-scope.json`: all 105
workflow fixtures match exact main dd337c8120fd6f875544c1479713d3aa4299c323 except
the reviewed candidate deploy workflow and four added trusted paths in the
controller workflow. The original 934-line selector, nonfocused test/build jobs,
all original controller assertions and historical approval data remain unchanged.
No live workflow, permission, policy, source branch or application file was changed.

### Immediate remaining checkpoint-1 work, in order

1. **Typed skipped-shard admission.** Actual current GitHub records include a
   skipped `focused_shards` check for zero work (examples #1656/#1623/#1545/#1543).
   The controller currently blocks that name. Do not add it to the blanket skip
   set. Collect its real Actions provenance without granting authority, and
   include validated step identities/outcomes in both full inventory sweeps.
   Only after exact v2 policy/admission authentication, recognize the uniquely
   successful `Require typed zero commands and no worker receipts` step in the
   same successful ready job, with both focused jobs completed/skipped in the
   same repository/head/workflow/suite/run/attempt. Bind a typed attestation to
   those identities; rederive/revalidate it from fresh metadata before mutation.
   Reject legacy policy, positive-work plans, missing/duplicate/skipped steps,
   wrong identities, cancelled/failed workers and changed final step outcomes.
   Independent review approved this evidence design; it adds no status-writing
   permission or controller-side packet download. Do not invent an independently
   observed plan hash: the trusted ready step attests to its own digest check.
2. **Versioned source-policy migration and implementation admission.** Preserve
   strict ordinary current-policy comparison. A distinct main-owned exact-source
   approval must pin this implementation's actual final head/base/path inventory,
   complete old/new policy blobs and independently derived digests. Neither the
   historical #1558 exception nor legacy cohort compatibility can authorize the
   changed workflow/planner. Build adversarial source/path/profile/race tests.
3. **Freeze the old-policy cohort without mass retries.** The source-only inventory
   `targeted-ci-legacy-cohort-dd337c81-inventory.json` captured all 72 then-open
   heads with fresh main bookends: 54 matching-policy source rows, 17 incompatible
   policy rows and one changed snapshot (#1621). Thirteen matching rows already
   had one observed source-ready run; the other 41 need source-run/receipt proof.
   This is not an installed allowlist or admission evidence. Complete exact
   original workflow/run/attempt/receipt provenance before freezing any eligible
   cohort record. A changed head/contract ends compatibility. Use just-in-time
   history-preserving integration for unlisted or incompatible actionable heads,
   followed by fresh exact-head gates; never mass-rebase or relabel old receipts.
4. Independently review the complete migration, rerun affected integration controls,
   publish one scoped implementation after its trusted admission path is ready,
   and observe hosted zero/single/multi-command canaries. Only measured canaries
   can establish runner/time savings. Existing independent workflow coverage stays.

No new implementation PR, commit, ready/merge command, workflow dispatch, broad
build or large artifact download was performed in this checkpoint. All changes
are private and production is still on the old contract. No further user design
approval is pending for this approved implementation/migration work.

2026-10-18 21:17 UTC: written approval recorded; current selector, preflight,
binding, workflow and policy source inspected. Task 1 started. No workflow,
production routing, merge-policy or test-selection change has been deployed.

2026-10-18 21:28 UTC: private capsule
`repo/.cache/targeted-ci-checkpoint1-main237/publishing/` contains the new pure
`focused-shard-plan.mjs` and its tests, plus an exact-current selector copy with
ONLY a new import and exported preparation seam. The original 934-line selector
is byte-identical after removing those two additions; existing v1 sharding,
selection, explicit-policy handling and exact-package deduplication are unchanged.
The copied `test-policy.mjs` is an unchanged fixture, not publication scope.

New test modules first failed for missing module/export, then passed. A concrete
additional negative case demonstrated that passing a self-consistent replacement
packet and worker receipts could otherwise evade an implicit caller trust rule.
The verifier now requires the separate expected digest from the trusted preflight
job output. That regression first failed and then passed. The upcoming workflow
must pass that authenticated output explicitly; a packet's own digest is not
provenance. No deployed helper or accepted prior measurement was affected.

Final bounded Node 20.19.5 verification: **51 passed, zero failures, skips or
cancellations**, exact source hashes unchanged. The same cases also passed under
Node 22; counts overlap and must not be summed. Evidence/log:
`ci-latency-audit-maincb8dddd3/targeted-ci-checkpoint1-unit-node20.json` and `.log`.
ESLint using the real `publishing/` rule context passed for all four candidate JS
files. Formatting completed. No application build, network or Git operation was
performed by these tests.

The assignment-only replay of 61 originally stable audit rows preserved every
selected command/argument/deadline, with 57 nonempty plans and 40 empty
assignments eliminated. Evidence:
`ci-latency-audit-maincb8dddd3/targeted-ci-checkpoint1-assignment-replay-v2.json`.
All four original selector/map/policy file identities match current main237 at
both replay bookends. This replay is BEFORE candidate-specific waiver/package
deduplication and uses explicitly synthetic execution identities. It is neither
actual hosted savings nor a complete final-source acquisition test. Preserve v1
replay evidence as dated; do not rerun either record without a new changed input.

Next: acquire the exact source/package/config inputs in existing preflight,
reconstruct the same final plan in workers, bind its digest through trusted job
outputs, wire the variable matrix and typed zero-work aggregate, then run original
workflow/admission/selector integration controls and independent review. All
changes remain private/unpublished/unwired; no PR or policy migration was started.
