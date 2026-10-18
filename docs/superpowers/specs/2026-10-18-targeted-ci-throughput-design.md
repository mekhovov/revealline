# Targeted CI throughput without reduced qualification

Date: 2026-10-18

Status: conceptual design approved by the user; independent written-spec review approved with no blocking issues; awaiting user written-spec review. No CI implementation is authorized by this document's publication alone.

## 1. Outcome and boundaries

Make small, well-understood PRs merge-ready quickly by running changed tests and affected-consumer checks once in each required execution context, without scheduling unrelated suites or empty test runners. Use one versioned impact-planning contract across source, industrial, appearance and company/optional validation. This is one CI-routing improvement delivered in independently verifiable checkpoints, not an all-at-once workflow rewrite.

Literal "test only changed files" is unsafe: unchanged consumers, shared test helpers, generated assets, package formats and runtime loaders can break. The accepted rule is **changed files plus all affected consumers**, with conservative broad coverage whenever ownership or dependency closure is unknown.

Unchanged requirements:

- No gameplay, Studio, SIM, saves, storage, offline/editable transport, application URLs, Git originals or self-contained full-release changes.
- No assertion, timeout, memory bound, workload or failure-severity weakening to obtain green checks.
- No source-admission, security, preservation, deployment, native/browser qualification or capacity waiver. The 980,000,000-byte guards remain; measured 950 MB and 900 MB targets are still separate unfinished work.
- Every applicable exact-head check must finish successfully before merge. Existing explicitly provenance-bound policy skips remain skips, not passes. Draft status alone does not prevent an otherwise qualified merge.
- No candidate-controlled executable code with trusted write credentials. No automatic acceptance of a changed policy or workflow by that same candidate.
- No runner purchases, account-limit changes, blanket cancellations, new monitoring automation or background replacement of merge-blocking obligations.

## 2. Evidence and success measurement

Baseline is protected main `cb8dddd3d3c11d24c56b014fa48ac0e6417d6465`, collected 2026-10-18. External audit `ci-latency-audit-maincb8dddd3/REPORT.md` retains source identities and the complete frozen-head worksheet. It covers 66 PR path inventories, 396 associated runs and 1,214 unique jobs. Sixty-one path/head/base rows stayed fresh; the other five are historical, not current admission evidence.

Key observations:

| Observation                     | Measured result                                           | Consequence                                                                  |
| ------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Focused source gate             | Already selects changed-path commands                     | Preserve and extend it; do not claim all PRs run the entire repository suite |
| Two-file #1631                  | One command assigned 1/0/0/0 across four shards           | Three empty workers spent about 9.0 runner-minutes on setup                  |
| #1625 aggregate and ready jobs  | 25m24s wait/11s execution; then 61m35s wait/3s execution  | Queue admissions, not just test runtime, need reduction                      |
| #1631 aggregate                 | 79m02s wait/14s execution                                 | A fast final command does not imply fast merge readiness                     |
| Industrial workflow             | Six fixed feature phases after broad path matches         | Route affected obligations rather than always running all six                |
| Company candidate compilation   | All 18 editions compiled twice; median 14.5 minutes       | Omit or narrow only with a complete build-input proof                        |
| Three-file test/docs-only #1639 | Candidate about 27.1 minutes; optional about 11.4 minutes | Candidate for a proved test-only fast lane, not an immediate exemption       |

Timing uses GitHub job and step timestamps. Incomplete jobs are capped at their own capture time. Parallel runner-minute sums are not wall time, billing or entirely wasted work. Scheduling cause, quota and service incidents are not inferred from these measurements.

Measure two independent distributions: execution time and runnable queue wait. Also retain total first-current-head-event-to-final-gates time, job count, runner-minutes, rerun/supersession count and coverage-plan size. Report P50/P95 and sample counts by change class. An initial goal is 5–10-minute merge readiness for mapped small changes **under healthy runner availability**, not a promise for shared-runtime changes or an account-wide backlog.

## 3. Architecture and trusted boundary

Reuse the existing focused selector, admission packet, source-identity checker and receipt verification rather than introduce a second CI controller. Add a small versioned impact-plan schema and reviewed ownership/dependency data. Keep pure planning, read-only input acquisition, test execution and final admission separate.

The trusted automation revision creates or independently reconstructs the plan. Candidate trees are read as data for paths, imports and input identities; candidate planner code is never the authority for omitting its own tests. Candidate tests execute only in existing read-only, credential-isolated validation jobs.

Each workflow consumes the **same planning rules and canonical obligation set**, not necessarily the same source-context execution. Existing exact-head versus synthetic-merge contexts and Node versions are distinct obligations until independently proved redundant. A plan instance is bound to its context. Moving a workflow to a different source context or runtime is outside this optimization.

Do not introduce an extra serial "plan workflow" ahead of every current workflow. Produce the source plan in the existing preflight where possible. Independent workflows use the same trusted planner and frozen inputs to reconstruct their plan, or consume a provenance-verified packet if it is already available without a new required runner admission. A delayed or missing packet cannot mean "no checks needed."

## 4. Immutable impact-plan contract

Versioned canonical data must contain:

- Repository identity, PR number, exact head, reported base ref and SHA, merge-base used for the path comparison, current protected-main/trusted-automation SHA, and execution-context commit/tree identity. Keep these identities distinct.
- Complete changed-path inventory, including status and both old/new names for renames, copies and deletions. Read every page, reconcile totals and reject truncation, unstable snapshots, duplicate identities, malformed paths or unsupported source contexts. Do not reuse the controller's former 100-check limit for any inventory.
- Schema version; planner, policy and owner-map Gitblob/digest identities; OS/architecture, Node/toolchain and dependency-lock identities relevant to each obligation.
- Sorted unique obligation IDs, command/argument vectors, owning package/suite, source context, setup requirements, required output artifacts and explanation chains from changed path through affected consumer to obligation.
- For each omitted formerly applicable suite/build: a typed non-applicability proof, its exact compared input inventory/digest and applicable owner rule. No inference from a filename suffix or empty text search alone.
- Deterministic shard assignments, expected receipts and a canonical plan digest. Plan artifacts bind repository, source, workflow/run/attempt and trusted automation provenance; a SHA256 supplied by an untrusted producer is not sufficient provenance.
- Explicit broad-fallback reasons, unsupported inputs and qualification still required outside this plan. Plans confer no merge, deployment, gameplay, native or capacity qualification by themselves.

Acquisition bookends recheck head/base/ref/path identities. Before final admission, recheck current main, source-policy identities, full exact-head check/status inventories and dependencies using the existing complete collection safeguards. An external main advance does not automatically require rerunning unaffected tests: unchanged trusted policy, plan inputs and source-context identities must be proved against the new state. If affected inputs changed or freshness cannot be established, mark the old plan historical and recompute; never silently relabel it current.

Malformed/incomplete evidence is a blocking planning error. Missing ownership for a valid path produces broad coverage; it is never an empty plan. Bounds are explicit and fail closed rather than silently truncating.

## 5. Affected-consumer selection

Start from all changed old/new paths and include the following closure:

1. Changed executable tests themselves and all tests using a changed helper, fixture, harness or generator.
2. Direct and reverse module consumers, package entrypoints and their existing regression obligations.
3. Explicit reviewed ownership edges for dynamic imports, computed fetch URLs, HTML/CSS references, embedded JSON/assets, generated files, build transforms, package exports and cross-mode storage/ownership contracts. Static JavaScript imports alone are insufficient.
4. Existing source, workflow, admission, identity and policy tests whenever their inputs change.

Every omission needs a main-owned rule with negative regressions. New/unrecognized imports, computed dependency shapes, generated projections or candidate owner-map edits cannot remove obligations: use a trusted known superset or the broad fallback. A changed helper can fan out to many unchanged tests. A small edit to shared `game/app` code can legitimately require broad coverage.

Default broad triggers include shared runtime/host ownership, compilers, schemas, package formats, locks/dependencies, shared setup scripts, toolchain or workflow/policy changes, and any unknown path or incomplete dependency closure. Narrowing a specific shared trigger requires a separately reviewed complete ownership proof; the default is not relaxed by this spec.

Record why each command is selected. De-duplicate only byte-identical command obligations with the same source tree, working directory, environment/toolchain, locks, setup and input identities. Similar names or overlapping test files are not proof of equivalence. Node 20 and Node 22, or exact-head and synthetic-merge executions, do not de-duplicate by default. Initial delivery need not reuse results across runs.

## 6. Nonempty test runners and dependency installation

For `N > 0` final de-duplicated focused commands, choose `S = min(4, N)` deterministic, nonempty assignments. Preserve the current per-runner process/worker limits; no extra CPU oversubscription is introduced. Duration-aware balancing can be considered later; initial stable assignment is sufficient.

For zero obligations, launch zero test runners and retain a trusted, typed no-work proof through the existing aggregate/status path. Do not manufacture a passing test receipt. Existing required/status contracts continue to be emitted and distinguish policy not-applicable from executed success.

Each worker records exact plan/source/setup identities, assigned IDs, actual executed IDs and outcomes. Aggregate verification requires:

- Exactly the expected `S` receipts and unique shard IDs, bound to this run/attempt and plan.
- Nonempty assignment for every launched worker, pairwise disjoint obligations and an exact union equal to the full plan.
- No missing, extra, duplicate, unsuccessful, cancelled, skipped-when-required, stale or foreign-source execution.
- Before/after tracked source identity and unaltered command/assertion/fixture semantics.

Install only dependency sets explicitly required by assigned obligations. If setup ownership is unknown, retain existing root and authoring installations. A dependency cache is an acceleration aid, not an admission result. Preserve lock, platform, install-flag and lifecycle-script boundaries; do not reuse mutable test databases, player saves or generated evidence as caches. Failure to restore a cache must allow a valid fresh install rather than suppress a test.

## 7. Fast lane and build proof

Docs, tests, test helpers and tools are not automatically nonshipping. First prove that **every shipping/build/toolchain input** relevant to the skipped obligation is byte-identical between the candidate context and the accepted comparison context, including transitive source, assets, generated-input definitions, configuration, locks, workflow environment and build scripts. Both the input inventory and its completeness rule are trusted and versioned. If the base is behind current main, unchanged-versus-merge-base alone is insufficient.

Only a complete unchanged-input proof permits a docs/test-only fast lane to omit unrelated package compilation or runtime suites. Changed tests and every affected harness consumer still run. A new test helper with unknown consumers retains broad coverage. Policy/provenance/identity/security checks still apply. Tools that generate shipped files are build inputs, not automatically fast-lane tools.

For runtime package changes, run all affected existing tests and output validations. Compile fewer than all 18 editions only after proving complete input closure per output and non-applicability for the rest. Otherwise preserve the current two complete compilations. Determinism checks, actual archive validation and publication/capacity qualification remain required at every boundary that currently requires them. Faster PR checks cannot substitute for a fresh deploy or create capacity reserve.

## 8. Integrating existing workflows and status contracts

Map industrial phases, appearance cohorts, optional-package checks and company candidate obligations into the same plan incrementally. Initially, selecting a phase may still execute its unchanged full phase command. Narrowing individual files inside a phase is a later checkpoint and requires helper/dynamic-consumer closure tests.

Every old applicable obligation must be either executed, shown equivalent in the **same** execution context, or accompanied by a reviewed typed non-applicability proof. Do not silently move merge-blocking work to a scheduled background run.

Preserve public aggregate/check contexts and the controller's complete check/status inventory. Where dynamic matrices remove individual checks, the aggregate must verify the expected plan and typed omissions; older heads keep their old workflow-bound contract. Do not add top-level path filters that strand a required check pending. Any necessary status-contract migration must be explicit, main-owned, versioned and independently tested before rollout.

Tiny aggregate/ready stages may be co-located only if their dependency semantics, public status reporting, final full inventory/freshness and privilege boundary remain intact. If that requires new trusted status-writing permission, do not broaden permissions under this spec: keep the existing stage and surface a separate design decision. Reducing queued work remains useful without that change.

Cancellation must not turn a failed required job into success. The reviewed lifecycle correction in #1654 and diagnostic-trigger retirement in #1633 are separate PRs with their own exact-source gates; this design does not auto-admit them. Superseded PR validation can be cancelled only after proving the exact old head and current replacement. Main, release, manual and frozen diagnostic runs are not blanket cancellation candidates. Evidence retention remains unchanged.

## 9. Safe rollout, policy admission and rollback

Deliver in this order; every checkpoint is independently reviewed and verified before expanding:

1. Finish eligible existing lifecycle PRs through their own unchanged safeguards; do not make unrelated PR merges wait for this design. Prototype the pure plan/assignment contract with adversarial tests, without changing live selection.
2. Compact focused runners while preserving the selected-command union and existing aggregate/status/source semantics. No suite omissions in this checkpoint.
3. Shadow the shared impact plan against frozen path inventories and current old selectors. Keep existing live coverage until negative proofs and discrepancy review pass.
4. Enable a small, explicitly allowlisted docs/test-only canary with complete input-identity proof. Then roll one workflow/owner at a time. Unknown/shared cases remain broad.
5. Measure actual runtime and scheduling reductions, then consider safe stage co-location only if still necessary and within unchanged permissions.

Protected workflow, focused map and planner changes use the repository's independently reviewed, **exact-source main-owned** policy-admission process. The historical #1553/#1558 exceptions are not reusable. Before publication, inventory all open old-policy-bound PR heads and define an explicit migration preserving their existing gates: accept only the matching old trusted contract or perform legitimate history-preserving integration and new exact-head qualification. Do not relabel old receipts as new-policy evidence or trigger mass rebases/retries merely for bookkeeping.

Rollback means a reviewed, source-pinned restoration of the old broad routing/contract for future plans; it does not delete branches/evidence, rewrite history or grant already-green status to in-flight heads. Maintain explicit old/new automation compatibility until those heads complete or are safely requalified. A false-negative selection or invalid receipt immediately disables the new omission fast lane; broad fallback remains available. External main/source changes are re-audited before each protected-policy publication.

## 10. Verification and acceptance

Required controls before enabling narrower live selection:

- Deterministic planner fixtures for changed test, shared helper, direct/reverse import, dynamic asset, generator, schema/lock, rename/delete/copy, unmapped file, new ownership rule and non-main stack contexts.
- Malformed, oversized, truncated, duplicate or changing path inventories; old/new ref retargeting; same-SHA metadata races; changed main/policy/source context; missing input identities. Reject ambiguity or use broad fallback as appropriate.
- Assignment counts 0, 1, 2, 3, 4 and more than 4; stable union; rejection of empty launched shards, duplicate/missing/extra/wrong-attempt receipts and failed/cancelled/unexecuted commands.
- Fast-lane negative cases where a nominal doc/test/tool path changes shipping input through generation, fixtures, build config or runtime use. No build omission if completeness cannot be proved.
- Cross-workflow parity: all obligations have execution or explicit non-applicability evidence; no cross-Node/cross-source-context de-duplication; altered lock/setup invalidates reuse.
- Real tiny-repository integration fixtures for input hashing, renames, dependency closure, non-mutating acquisition and source-preserving execution. No full local build or internal bulk artifacts.
- Workflow boundary tests for required status continuity, cancellation/failure handling, old/new policy compatibility and candidate-code credential isolation. Preserve all original negative cases, workloads and deadlines.
- Shadow all 61 originally stable audit rows with their frozen identities, plus adversarial fixtures. Historical rows remain dated replay, not current queue qualification. Explain every old/new selection difference before enabling it.
- Hosted canaries on fresh exact heads, at least one single-command case, a docs/test-only case, a package change and a shared/unknown broad-fallback case. Verify complete logs/receipts and actual final admission, not just a green matrix row.

Report distributions for each canary class with exact sample counts; do not claim a stable P95 from a few observations. Acceptance requires no lost obligation, no silent missing/ignored failure, no source or qualification weakening, no empty scheduled test worker and measured reduction in unnecessary jobs/setup for the narrow cases. A longer shared-runtime run is acceptable when its coverage is genuinely required.

## 11. Next approval boundary

After independent review, publish this specification alone on an exact-source `codex/` branch and request the user's written-spec review. Then prepare a bounded implementation plan beginning with nonempty focused runners and their receipt contract. No production CI, merge-policy, permissions or test coverage changes occur before that review. Existing approved queue work and periodic progress reporting continue meanwhile.
