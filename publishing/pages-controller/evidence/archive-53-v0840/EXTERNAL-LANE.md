# Archive53 bounded PR lane

Coordinator authorization: create Archive53, empty bootstrap main, reviewed feature PR and hosted preview only. Merge and deployment remain held for explicit final review.

- Repository: https://github.com/mekhovov/revealline-archive-53
- PR: https://github.com/mekhovov/revealline-archive-53/pull/1
- Empty main: `b89b8d3b934764db37a8933ec7c84a3afcebb957` (no files or workflow).
- Feature: `codex/preserve-v0840-archive53`, head `c5d51ff845f09a24ed41c50f01a0a308978113bf`.
- Exact reviewed tree retained: `6abe465ee6775405df2441b2cda76f8c8bfd20d5`.
- Original local preparation `d6da4d645c117c0075173b54bb0bae5563b701a5` remains preserved on its original local branch; successor adds only the empty bootstrap parent, no tree changes.
- Fresh GitHub API verified feature head/tree/parent after push; prior repository GET was 404, post-create remote was empty, and PR deduplication returned no existing PR.

## Retained transport failure

Initial HTTPS push of the feature was rejected: `refusing to allow an OAuth App to create or update workflow .github/workflows/deploy.yml without workflow scope`. No feature ref was created by that attempt. The existing GitHub account git protocol and Archive52/main remotes were already SSH. After read-only remote/config verification and feature-absence readback, the same reviewed commit was pushed using existing SSH authentication. No token, permission scope or global configuration was changed.

The PR event is the only preview trigger. No manual dispatch, merge, Pages configuration or deployment has been performed. Tests are optional and not reported as passing; extraction/build/source identity/inventory checks remain mandatory.

## Subsequent authorized setup and successful preview

Coordinator subsequently authorized Pages setup. Pages now uses `build_type=workflow`, with a `github-pages` environment; raw creation and readback responses are in `external-authority/`. No deployment has been triggered by this setup.

Normal PR preview `35788945444` completed successfully without manual dispatch. Exact-head `c5d51ff845f09a24ed41c50f01a0a308978113bf`; hosted synthetic PR checkout `bd095f5033cd278d695102c621cdd3415fe60bcd` has the identical reviewed tree `6abe465ee6775405df2441b2cda76f8c8bfd20d5`. The 57,481-byte receipt artifact `10721022999` has SHA-256 `1c352bfeb2df0ccfdc4a4557dfabc077c546ec26c462941b0b25dbf51df69701`. Its exact three members were checked, including original hosted inventory identical to prepared inventory: 1,085 files / 590,842,992 bytes. Raw run/jobs/PR/commit/artifact authorities and ZIP are in `preview-evidence/`.

Tests were skipped under the user waiver, while extraction/build and complete byte reread passed. Merge and deployment remain held for coordinator final review.

## Coordinator-approved merge and production

Coordinator independently reviewed the exact preview and merged PR #1 with a merge commit, retaining the branch. Actual merge `9ebb2c397b6db59561129147b8758ad24e0489c2` has the reviewed tree `6abe465ee6775405df2441b2cda76f8c8bfd20d5`. Its automatic push run `35789096805` completed successfully; deployment `6601503691`, latest success status `18699469453`, names `https://mekhovov.github.io/revealline-archive-53/`.

Public GET `/releases/v0.84.0/release.json` returned the original version/source/source-archive/distribution/manifest identity. This spot check is not full public verification. Production receipt artifact `10721176839`, 57,482 bytes, SHA-256 `91363cf51fabdb56199cab656a2460443602321e97256735eaf4dce3ace74e45`, records full hosted PASS for 1,085 files / 590,842,992 bytes. Original production authority responses and ZIP remain in this cache root.

Local audit-only candidate: `audit-repository`, branch `codex/audit-archive53-http`, commit `671ea2f44ece7f4c9ab9467da1af22fe9be80edc`, tree `05a132ca547e5357e02ed1a70a4ffb58d7f2f0e8`. The candidate request is explicitly `reviewed:false`; no reviewed execution-request file exists yet. Added audit job is manual exact-ref only, contents-read only, with held actual deployed merge. Existing build and deploy jobs are false on its manual audit ref. No audit branch has been pushed or dispatched. Final public HTTP and browser admission remain pending.
