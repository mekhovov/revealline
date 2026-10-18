# Narrow Demo recovery observer re-entry correction

Date: 2026-10-18. Status: design only, awaiting independent review and the user's
written-spec approval. No runtime or observer implementation is authorized by this
document. The user approved preparing this narrow spec after reviewing the actual
repeated-entry failure. Storage comparison and process cleanup remain separate.

## Goal and non-goals

Correct the recovery observer's existing repeated public Demo entry so it does not
try to click Home beneath the already-open Settings modal, and so it must observe
a genuinely different, advancing, unpaused Demo owner before continuing.

Preserve the original public action sequence, workload, source/package identities,
fault arms, replay/state comparisons, deadlines, process ownership and all
qualification requirements. This is a tooling caller correction, not an application
runtime fix or proof that any native cohort is qualified.

Do not change gameplay, Studios, SIM, saves, web storage, IndexedDB, offline/editable
dependencies, Git originals, self-contained releases, origins/CSP, Pages guards or
the merge controller. Do not add force-clicks, DOM mutation, private runtime handles,
synthetic user clicks, cache clearing, automatic retries, installers or a new native
workflow. Existing synthetic context-loss probes are preserved, not broadened.

## Source and observed failure

The reviewed source baseline is main
`f6557a569599f920b47e55c179bdb664eacdd3f0`. Its observer is byte-identical to the
executed tooling source `ee9ece54bc9f484bc4179a20f8fd915d7933680b`:

| Source | Exact identity |
| --- | --- |
| `scripts/observe-solo-demo-recovery.mjs` | Git blob `e0c10ae20cbe1a552294b6c42a223a5c91be68ca`; 36,467 bytes; SHA-256 `3fbf0a483be011214d0f8e23d138ba65e53220fb0ee0d1d58736722b7084d253` |
| `scripts/test-solo-remote-demo.mjs` | Git blob `642a9ecc51d6fd75b2a5303ffe9bc5d7576ac9cd`; 40,907 bytes |
| `scripts/solo-demo-recovery-probe.mjs` | Git blob `3d07d59d83f36ffd15cecb6973a04a4e3159b2f7`; 5,900 bytes |
| Executed recovery declaration | `docs/performance/solo-demo-recovery-797e03-plan.json`; Git blob `f59fa87c18b8d8bad8f24c41c36410dd0b882a0f` |
| Executed resource declaration | `docs/performance/solo-demo-resources-797e03-plan.json`; Git blob `f17c46c52d332f33c6589b7d77f35160b51cee24` |

Recovery run `39123948345`, attempt 1, artifact `12136015967` is retained and
independently digest/namespace/CRC verified. ZIP SHA-256:
`c05991c48825f872f538528166b7f82ff442362f2a0640a0fe512f341fe1a2a8`.
Its report SHA-256 is
`7f4ea0527075c0ed167a3419113ea62b28dbc2d14746a7df1fdbb419818ac7f1`.
The candidate runtime was `797e03f28743921842df6aa57520a72016ba3dfc`, not the later
1590/1593 runtime.

The failure is a normal 15-second `#shell-options` click intercepted by the already
open Settings dialog. The actual observer helper at baseline lines 190–209 already
supports repeated entry: when a previous Demo identity is supplied and Settings is
visible, it uses that public dialog; its readiness predicate requires a different
Demo identity, positive tick and unpaused state. The recovery stale-painter sequence
at lines 712–719 retains the old painter, clicks `#demo-back`, then calls `openDemo()`
without that previous identity. It therefore chooses the initial-entry route and
loses the helper's new-owner comparison.

The existing final source test exercises the actual helper with identity 10 and
with no identity, but not this recovery call site. The missing caller regression
is material: passing an isolated helper test did not prevent the observed failure.

## Approaches considered

1. **Use the existing helper correctly — recommended.** Capture the currently
   observed Demo identity before Back, pass it to `openDemo`, retain the existing
   visible-Settings/public-control branch and strict readiness predicate, and test
   the actual caller. Smallest correction with no added UI action or relaxed gate.
2. Close Settings and reopen it from Home. This adds public actions and changes the
   measured workload. It also hides the existing route instead of fixing the lost
   identity. Rejected for this scope.
3. Generalize/rewrite entry navigation or just retry the same run. A general rewrite
   is unnecessary; retrying unchanged inputs does not correct the demonstrated
   caller defect. Rejected. No force-click or timeout increase is an alternative.

## Required caller behavior

Only the recovery stale-painter reopen boundary changes. Immediately before its
existing Back click, read the existing `demoRecoveryProbe.readiness()` once through
the current observer boundary. Retain its integer Demo identity in a local value.
Require a positive safe integer, a positive tick and paused state, consistent with
the preceding completed recovery arm. Missing, invalid or unexpected state must
fail; it must never fall back to an initial entry without a previous identity.

Keep the old painter/surface retention and its ordering intact. Use the existing
normal `#demo-back` action. Invoke the actual `openDemo` helper with the retained
identity. Do not modify the helper's public selectors, click order, default initial
entry behavior, paused check, positive-tick requirement, new-owner requirement or
60-second readiness wait.

When Settings is visible, the existing helper must use `#settings-tab-extras` then
`#shell-demo` without touching covered `#shell-options`. When Settings is not
visible, its existing Home route remains required. Both routes must still reject
the old Demo identity and a new but paused/nonadvancing owner.

Keep `snap('reopened', true)`, the different-painter assertion, both retained stale
context events, the post-event identity/tick/pause checks, ordinary-parent equality,
quality checks, explicit pause/Back, parent recording equality and both final native
replay verifications unchanged. Explicitly compare the reopened Demo identity to
the retained previous identity. Retain that previous identity as one bounded integer
in `report.staleOwner` alongside its existing evidence; this is not proof of a new
owner unless the existing live readiness and painter checks also pass.

The resource-mode loop already supplies its observed `previousRun` to `openDemo`.
Do not change its actions, modes, cycle count, storage readings or comparisons. Do
not add full diagnostics export at active or retired-owner boundaries: the existing
retained-state versus paused-only-export distinction stays intact.

## Bounds and authority remain unchanged

- Existing normal clicks retain their 15-second control/click bounds; Demo entry
  retains its 60-second readiness bound. Observation remains 360,000 ms; each native
  replay remains 120,000 ms; browser close/process exit/drain bounds stay unchanged.
- Preserve the complete four spectator/practice display/concealment fault arms,
  5,000/2,500 ms quality windows and every existing fixed wait/action/input.
- Preserve the resource cohort's ten spectator plus ten practice cycles, exact
  before/after web-storage equality and bounded source-response accounting.
- Preserve helper/row/setup/evidence caps, reports' 2 MiB cap, concurrency, zero
  automatic retries, exact package/source/worker/CSP admission and clean-owner
  requirements. Do not weaken an assessor to accept an incomplete report.
- A passing functional substage, no survivors, unchanged parent replay or corrected
  UI route cannot override a storage, deadline, cleanup or replay failure.

## Source declaration and test integration

Do not edit either already executed declaration, original failed report or retained
packet. The shared observer's changed bytes require explicitly named tooling
successors for **both** Demo declarations and exact fresh driver/source hashes.
Use the existing reviewed immutable-source/successor pattern: preserve the historical
source/manifest witness, freeze every candidate/baseline/artifact/recipe/owner and
workload field, enumerate the necessary tooling identity changes, and reject stale
or partial bindings. Never point an old declaration at arbitrary current tooling.

The initial correction comparison remains on the exact original 797 candidate and
package. It does not rebind the old result to 9d, merged main or a different release.
Any later runtime cohort needs its own explicit exact-source declaration and gates.
Composition with #1595 or later changes requires a fresh source/closure inventory;
source identities in this design are a baseline, not perpetual execution authority.

Prefer extending `scripts/test-solo-remote-demo.mjs`, already selected in both fixed
Demo prerequisites, rather than adding a new workflow. Preserve complete existing
source-test files and their execution; no reduced selection, removed registration
or hidden/renamed test. Update only the necessary existing declaration selection
and explicit sparse source/test read-set for the named successors. Any unexpected
controller/policy/permission/runtime scope stops for review.

## Regression and verification requirements

Before implementation, add a failing regression that reproduces the **actual**
recovery caller omitting the previous identity while Settings is visible. Build on
the existing Acorn/actual-driver-function extraction style, not a parallel fake
navigation implementation. A source-only model must be labeled as such; it is not
a native browser pass.

Required regression coverage:

1. The initial visit keeps the original Home → Extras → Demo sequence.
2. The actual repeated recovery caller captures the old live identity before Back,
   passes it to the actual helper, and does not click Home under visible Settings.
3. Hidden Settings retains the normal Home route. The helper refuses the old
   identity, a paused new identity and zero progress. The repeated caller rejects
   invalid/missing captured state before Back; the helper's initial no-identity
   visit remains valid and unchanged.
4. Reverting the caller to `openDemo()` causes the new regression to fail, even
   while the existing isolated helper test still passes.
5. Different painter, retired-event isolation and unchanged parent assertions stay
   required; the extra bounded integer fits the existing full report-cap test.
6. Resource actions/storage comparisons/source caps and strict deadline, cleanup,
   replay, incomplete-arm and owner-failure controls remain non-passing for the
   same negative fixtures. Do not change their assertions to accommodate a result.
7. All successor driver/adapter/frozen-input references, historical witnesses,
   complete sparse closure and existing workflow/read-only/manual fences verify.

Run the whole unchanged affected Demo source-test files, their current prerequisite
set and scoped lint/format checks, not just the new test. Obtain independent source
and integration review. Hosted exact-head checks and ordinary installed-main source
admission, comments/dependencies/preservation/qualification gates remain mandatory
before Ready or merge. Conditional native skips are not silently waived.

After any separately approved implementation is safely installed and its own
publication verified, a separately admitted manual observation may test the new
tooling. Do not duplicate an existing run. Every actual package member/source pin,
report, strict replay and owner receipt must be checked. Both shared-driver Demo
cohorts require regression verification; old failures remain failed and historical.
No fresh native dispatch is authorized by approving this design document alone.

## Independent blockers not solved by this correction

Resource run `39123950010`, artifact `12135028960`, failed exact web-storage equality
on `revealline.suspended.journey-opening.v1`. Its narrower parent replay equality
does not override that failure; the changed fields and cause remain unproved.
Do not ignore the key, clear/migrate storage or relax equality.

Both original Demo scenario commands also forced cleanup with a deadline violation;
their reports retain `observation process exit deadline`. Empty survivor arrays do
not establish clean successful exit. Fixing entry navigation does not establish the
cause of the cleanup failure or authorize longer deadlines/process-owner changes.

The Pages archive is still 965,591,040 bytes at the accepted f655 publication,
15,591,040 above 950 MB and 65,591,040 above 900 MB; guards remain 980,000,000.
Internal free space remains below the 3 GiB browser reserve. This observer design
supplies neither capacity savings nor physical/native/offline qualification.

## Acceptance and handoff

The **design** checkpoint is complete only after independent spec review, an exact
document-only Git commit and the user's written-spec review. Implementation planning
is the next stage only after that approval. No observer code, workflow, manifest,
test assertion, source history, runtime content or stored player data is changed by
this document.

An eventual implementation is not qualified merely because its new caller test
passes. All existing failure evidence, exact source and full prerequisites, native
functional/replay/owner results and the independent storage/deadline holds must be
reported separately. The original broad capacity/queue goal remains active.
