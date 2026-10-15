# Release evidence compatibility, 15 October 2026

This bounded compatibility correction does **not** make the full-test release
pipeline ready. It changes two readers, without modifying workflows, repository
variables, production gate requirements, evidence records, or publication behavior.

The later [16 October CI continuation](../../docs/team-duel-ci-continuation-2026-10-16.md)
repairs verification-only sparse checkout dependencies and selects an explicit
test runtime. That does not restore the missing production commands or qualify a
real release. The reader correction's original scope remains as recorded here.

## Supported authority and policy

The full assembler now accepts the historical `actions/checkout@v4` log contract
and the exact current immutable action
`actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09`. It does not accept the
moving `@v5` tag, other tags, branches, or arbitrary hashes. The actual automation
checkout must still have one allowed path (`automation` or
`.source-gate-automation`), one exact reviewed workflow-commit ref, and that commit
in its own checkout output. Missing, duplicate, unsupported, or conflicting
checkout authorities fail. Before/after raw source identities remain required
inside their exact command regions.

The Python release consumer now recognizes the same authorization/mode pairs as
`publishing/test-policy.mjs`:

| Authorization                    | Accepted mode                     |
| -------------------------------- | --------------------------------- |
| `explicit-user-request-20260922` | Historical `waived` or `required` |
| `explicit-user-request-20261004` | Restored `required` only          |

All exact policy fields, format, scope, and bounded nonblank reason/restoration
requirements remain. Unknown authorizations and a waiver under the restoration
authorization are refused. Required policies still require four successful source
test jobs; skipped jobs do not become passes. The current committed policy is the
October restoration profile. The correction does not alter its bytes.

The PR/manual/inspection run IDs must remain distinct. Exact commit/tree,
source-byte equivalence, eight distinct shard jobs, complete partition discovery,
terminal TAP with no failures/cancellations/skips/todos, original artifact hashes,
inspection closure, and execution by the exact frozen consumer remain enforced.

## Remaining workflow incompatibilities

`assemble_full_qualification.py` still requires the following existing authorities.
They were deliberately not removed or substituted:

- PR `preflight`: before/after raw source checks, `Validate, lint, and format
source`, `Verify Field Kit production ledger and compiled output`, and `Verify
immutable production sources first`. Current `deploy-pages.yml` preflight only
  performs policy/admission work. Source checks and release-critical validation
  are in its `build` job; that is not the same evidence contract.
- Manual `qualify`: `Reproduce production collection when available` and `Require
reviewed production slots in the committed ledger`. Current
  `qualify-release-source.yml` does not execute those named steps.
- Full PR shards and the ordinary PR build require
  `vars.REVEALLINE_FULL_CI == 'true'` in the current PR workflow. A successful
  focused or fast-mode PR run does not satisfy the assembler's full-test contract.
- Fastline still refuses required-policy publication because its coordinator only
  routes to the waived adapter. This correction does not change that guard or
  route a required source through a waiver.

A separate reviewed change must reconcile these actual gate authorities while
preserving the required source checks and proving their executed commands. Merely
renaming a workflow or deleting missing requirements would not provide evidence.
No complete-pipeline compatibility or real hosted qualification is claimed here.

The current workflow trace distinguishes moved checks from missing execution.
PR raw source observations, validation, motion syntax and immutable production
source tests moved into `build`; they are not evidence from `preflight`. Commit
`15fe3e2c5` explicitly removed the PR commands `npm run lint`,
`npm run format:check`, `npm run format:native:check` and
`node scripts/produce-field-kit-theme.mjs --check`. Manual qualification likewise
no longer executes that reproduction command or
`node scripts/check-field-kit-readiness.mjs`. Current `npm run validate`/build
do not invoke these missing commands. The presentation-readiness test exercises
a temporary synthetic Git fixture, which cannot certify the real committed
production ledger. A reader-only relocation adapter must still refuse those
absent authorities; it cannot turn them into successful execution.

## Separate qualification and inspection already exist

The standalone `qualify-release-source.yml` dispatch offers `operation=qualify`
and `operation=inspect-artifact`. Qualification is restricted to merged `main`.
Its `freeze_snapshot=true` path waits for successful required shards and creates
one source-pinned artifact. A later, separate inspection dispatch takes that exact
artifact ID/run/size/SHA binding; it executes the inspection job and skips the
qualification/freeze path. The deduplication guard does not block inspection.
These modes can provide distinct manual and inspection run IDs without changing
the workflow or merging the two evidence roles.

The manual workflow passes `--force-tests false` when full CI is not enabled;
that flag does **not** waive a committed `required` policy. The policy reader still
returns `runTests=true`. This differs from the independent PR full-suite variable
gate. The workflow's fast-mode warning alone is not evidence that required manual
shards were skipped. Always inspect the actual job outcomes and retained TAP.

These are existing capabilities, not dispatched operations. All missing-step,
source equivalence, capacity, and exact-artifact requirements still apply.

## Regression evidence

Before this change, a valid historical checkout fixture passed with `@v4` but
failed with only its action changed to the exact current v5 pin. The Python policy
parser rejected the committed October `required` policy while the JavaScript
parser accepted it. Both cases now have direct regressions, including an
independent JavaScript/Python policy-admission comparison.

The baseline full-assembler tests also had one stale assertion: it expected six
serialized gates, while production emitted three. This change asserts the exact
existing gate tuples (`validate` / `npm run validate` / `Validate source`,
`motion-syntax` / `node --check authoring/motion-lab/app.js` / `Check motion lab
syntax`, and `test` / `Run test shard 1/4`) instead. The production gate list was
already `['validate', 'motion-syntax', 'test']` in commit `13d9f95c26`; commit
`2204a6d54b` documented that contract. No runtime gate requirement changed here.

The focused fixtures cover both checkout contracts, both authorized policy eras,
wrong/moving pins, wrong refs/output/paths, duplicate authorities, restored-policy
skip rejection, and a full synthetic frozen-consumer roundtrip. Removing any of
the absent historical production steps still fails before producing a package.
Synthetic passing fixtures are not release evidence.
