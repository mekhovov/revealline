# Offline plan status and ownership recovery batch

## Baseline and release position

This batch starts from freshly fetched main
`bb9b3640270dc26633d37cfdf4a306aecda277b6`, reusing the clean isolated worktree.
The original checkout is untouched. PR #750's neutral pilot recording fix is
merged into this baseline. No published release or saved content identity changes.

At this review, GitHub's latest release is v0.141.7. The separately authorized
v0.141.8 controller patch (#751) is open, and #746 holds the prepared feature
integration queue. This batch is a separate product input for subsequent review;
it does not allocate a version, enlarge #746 or dispatch another publisher.
Its focused-test-map addition must be retained alongside the queued map categories
when the release coordinator integrates it. Required checks apply to that exact
integrated source, not merely this independent branch.

## Completed foundations and remaining work

| Phase | Completed or submitted | Remaining gate |
| --- | --- | --- |
| 1: Inventory and preservation | Ownership/lifecycle reports and historical route retention are implemented. Team refresh #726, frozen size measurement #729, company inventory #738 and company artwork screening #747 are submitted, still open. | Review complete visual ownership findings; demonstrate old saves, suspended flights, replays and earned-picture restoration across retirement. This batch closes one corrupt-metadata deletion failure. |
| 2: Distinct gameplay | Five neutral pilots and briefs exist; #750 fixes Versus input and verifies bounded recordings through real engines. The next Journey bucket (#730 → #733 → #735 plus #732) passed bounded source review. | Complete replacement-pilot runs and meaningful alternatives, failure/difficulty observations and human review. Source review and the control mission clear do not approve replacements. |
| 3: Unique artwork | Exact, transformed and perceptual comparison tooling exists; company comparison awaits integration. | Approve compositions, produce unique replacement originals with provenance/accessibility descriptions, and visually review flagged matches. No bulk originality claim yet. |
| 4: Smaller offline packages | Direct install/download entry, starter/chapter selection, optional music, verified file resume, launcher preparation and conservative played-package retention are implemented. One-action Couch start #752 is queued. | Externalize embedded artwork; split remaining mode internals; qualify rendition descriptors and lossless encodings; measure storage/update peaks and safely reclaimable bytes. |
| 5: Qualification and release | Focused downloader, host-admission, preservation and pilot evidence exists. Release publication is serialized. | Exact-candidate blocked-network complete journeys; eviction/quota and interrupted update/migration/rollback journeys; physical iPhone/iPad/Android and installed desktop evidence. |

All five phase gates remain open. The frozen #729 measurements are 63.47 MiB for
the Solo starter, 567.39 MiB for current gameplay and 346.78 MiB for optional music.
They describe v0.141.7, not a new measurement or a reduction delivered here.

## Failure and repair

The download state cache records ownership by installed edition, played chapter,
saved reference and soundtrack group. Previously its reader silently omitted
unreadable JSON. Removal and deselection then calculated the remaining owners
from that incomplete list and could delete bytes still needed by a damaged
owner record. A same-input reproduction against the baseline deletes the shared
dependency; the changed source rejects cleanup and retains its verified bytes.

Reclamation now reads and validates every existing ownership checkpoint while
holding the existing download lock, before altering metadata. Invalid JSON,
missing hash lists, invalid hash identities and unreadable responses prevent
cleanup. Well-formed incomplete download records still own their verified bytes.
Readiness browsing may omit invalid records; it cannot use them as readiness
evidence. The cleanup path never interprets their omission as permission to delete.

The replacement owner set is calculated before the metadata mutation. If that
mutation fails, no asset deletion follows. Restoring a valid owner record permits
a later cleanup to retain shared dependencies and remove only unreferenced bytes.
No automatic reset, ownership erasure, network repair, save rewrite or import
removal is introduced. Unknown ownership intentionally favors preservation over
space reclamation.

This cannot reconstruct a checkpoint already evicted entirely, authenticate a
well-formed but falsified record, or make browser storage permanently durable.
Those cases and exact save-aware reclamation remain separate work.

## Validation

- Focused download/admission/Team retention cohort: 30/30 passed.
- Focused-test selector suite: 27/27 passed. Final combined run: 57/57 passed
  with zero failures, cancellations or skips; earlier runs overlap this result.
- Repository validation, lint and formatting checks passed, as did final changed-file
  lint/format and whitespace checks.
- Baseline comparison: removal accepted and deleted the dependency; fixed source
  rejected removal and preserved it, with network access disabled in both cases.
- Tests cover corrupt metadata, restart with blocked requests, repair/retry,
  incomplete owners, metadata mutation failures, existing quota recovery,
  shared-edition retention and preservation of user imports.

These are automated cache-model and host-fixture checks, not physical browser
storage or installed-device qualification. Full-suite and release-build evidence
remain pending for the integrated candidate; no full-suite pass is claimed.
Local logs are `/tmp/revealline-retention-focused.log`,
`/tmp/revealline-retention-validate.log`, `/tmp/revealline-retention-lint.log`
and `/tmp/revealline-retention-format.log`. The disk has approximately 1.1 GiB
free, so no local distribution build or media generation was started.

## Next batches

1. Integrate the already prepared release inputs in dependency order; carry this
   bounded recovery fix as a separate reviewed input without delaying a frozen batch.
2. Record complete replacement-pilot routes and alternatives; retain their input
   files and review observations before approving artwork production.
3. Externalize official runtime image bytes with legacy import/export parity,
   then measure real package changes before selecting encoding conversions.
4. Qualify full recovery/update journeys and collect physical installed-device
   evidence before publishing broader offline-support claims.
