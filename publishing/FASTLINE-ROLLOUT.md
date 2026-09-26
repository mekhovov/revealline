# Five-version fastline rollout

Do not restart or change the v0.132.5 publisher for this migration. Preserve its
failed qualification evidence and repair its source through the existing owner.

## Canary 1: admission foundation (not yet activated)

The PR preflight records head, base, workflow revision, validation-policy digest,
normalized classification/title, milestone, admission labels, dependencies and
the complete changed-path set (including rename sources). The privileged
controller reads only protected-main automation, verifies the checked revision's
policy Git blob identities, and treats the receipt as data. It rejects missing,
expired, stale or different-policy receipts. The newest pending gate supersedes
an older successful gate. A final metadata/review read precedes a merge request.

Preflight plans focused commands before source checkout. A zero-command plan
skips the focused job explicitly; required release validation and fresh
merged-source qualification are unchanged. Focused execution consumes that
same immutable path inventory, not a later API diff.

The first canary deliberately keeps metadata-triggered source reruns. Cross-run
source-check reuse, sparse dependency closure, version-only accepted-source
evidence reuse and end-to-end race tests are still pending. Do not describe
the foundation as completing admission efficiency. The four-value version-only
classifier is tested but is not yet used to waive validation.

GitHub's merge API atomically checks the head SHA, not arbitrary PR metadata.
Metadata events and the final reread narrow that race; they are not an atomic
metadata compare-and-swap. Do not claim instantaneous invalidation. Before
activation, exercise title/milestone/hold changes while checks are running,
concurrent pushes and draft promotion against disposable PRs. Policy-changing
PRs require independent review: the controller intentionally refuses automatic
admission under a policy different from protected main.

## Remaining independent canaries

1. Complete source-check reuse and measure admission time.
2. Add globally bounded five-release selection with legacy per-major support,
   remove comparison routes from the public index, and retain local evidence
   checks while bounding remote archive authority checks.
3. Deploy dual legacy/v2 source-contract readers before producing commit-plus-
   manifest releases. Preserve all existing nine-asset releases unchanged.
4. Shadow the new contract against a completed frozen distribution; test every
   stage's crash/resume path without duplicate tags, assets or dispatches.
5. Measure two successful public canaries before disabling any old entry point.

Required timing fields: queue wait, checkout, validation, freeze, inspection,
transfer, archive, deployment and public verification. Targets remain admission
under 3 minutes, publication under 12 minutes, verified Pages under 20 minutes;
no savings or acceptance is claimed until measured.
