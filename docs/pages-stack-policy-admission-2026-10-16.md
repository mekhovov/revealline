# Exact-source admission checkpoint for the bounded stack diagnostic

The user approved the bounded workflow and written design, and continuation of
the reviewed main-owned policy-change admission path. This checkpoint replaces
the historical PR 1553 singleton approval; it does not generalize approvals or
authorize a candidate to modify its own approval machinery.

## Frozen proposal

- Repository: mekhovov/revealline; PR 1558.
- Head: d69dfcdc853e99c2a727ef13e747334ffe7ef97a.
- Reported base and current main: 0597edff78fbec0faeccffae413ca48e7a5d91f1.
- Trusted policy digest: 533b2fbc30efdf12a2d5ea578a4360239e284ff8200107f1f7765b9f6210489b.
- Reviewed candidate policy digest: 083826bf415c8ff93e7801bfd7b35674547bcbb1acecf7f7734f4146a9eef475.
- Only changed POLICY_FILES member: publishing/focused-test-map.json, blob
  61a0b7a8f903a73a1ae5e5eeb26863b3b585f1f2 to
  61dda74f9db14d20b6055e725cf5836b3b539bfe.

All seven trusted/candidate policy blobs and all eighteen changed paths are
pinned in the controller. Digests were independently computed from the actual
GitHub source bytes, not copied as authority from the receipt. The real admission
artifact 12069041970 from run 38951304270 attempt 1 reports those exact source
identities, candidate digest, complete paths and no dependencies. An admission
receipt is not evidence that all checks, capacity or qualification gates passed.

## Narrow workflow boundary

The new manual diagnostic workflow is not a POLICY_FILES member. The previous
conservative guard rejected every .github path, so this bootstrap permits only
.github/workflows/measure-pages-stack.yml, only for the exact repository, PR,
head and reported base above. Every other .github path, controller modification
or executable policy difference remains rejected, including alterations made
to both a synthetic input and its supplied approval record. The exact head binds
the workflow bytes; its reviewed Git blob is
230d5f4070f4e69773885b80c4184652c7be772b. No new record field is claimed to verify
a blob that the verifier does not actually read.

The workflow remains manual, main-only, read-only and diagnostic; it has no
deployment or merge job. The existing final mutation snapshot reapplies the
same exact approval conditions and all existing source, dependency and check
gates. This bootstrap itself changes no POLICY_FILES member or workflow and must
pass ordinary source-bound admission from trusted main.

## Required sequence and remaining boundaries

Independent design review approved the narrowly pinned continuation. Concrete
implementation review, negative regressions, live read-only receipt replay and
all applicable exact-head hosted checks remain mandatory. Keep PR 1558 draft
until this bootstrap is merged and its source-bound production is independently
verified; then freshly validate PR 1558's own checks, admission, dependencies and
safeguards before readiness/merge. Verify its own production before any actual
stack diagnostic dispatch.

## Prepublication evidence

Independent implementation review verified all fourteen actual main/candidate
policy blobs, both computed digests, all eighteen paths, the workflow blob and
the new receipt ZIP digest. Replaying the proposed controller's actual admission
verifier accepted that receipt and rejected same-head base retargeting. Main
remained unchanged and PR 1558 remained draft. This is proposed-controller
acceptance, not installed-main approval or merge eligibility.

The controller/admission/policy suites passed 34 tests with zero failures/skips;
lint passed. The fresh PR 1558 hosted focused job 117143158034 in run
38951304270 passed all 353 tests, zero failures/skips, after the test-only Linux
argument-bound portability correction. Independent review accepted publication
of this separate three-file bootstrap. An interrupted concurrent Darwin fixture
run remains unaccepted historical evidence; it is not represented as a passing
run or a proven root cause. This bootstrap's own hosted checks and production
verification remain future requirements, not supplied by PR 1558's result.

No guard, permission, gameplay, Studios, SIM, save, offline dependency, release
source or live asset is changed here. No measurement grants merge, deployment,
qualification or capacity reservation. The measured 950 MB then 900 MB targets
and immutable 980000000 guards remain unchanged, with no savings claimed.
