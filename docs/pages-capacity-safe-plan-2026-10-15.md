# Safe Pages capacity work — 2026-10-15

## Current verified status and next implementation

PR #1484 merged as `6bca80b42c788160c06aad60a7a7fdbc412880b6`.
Checkpoints 1 and 2a subsequently passed on production. For example, successful
publication run `38797214892` deployed `d6f93f71d889912832abeec74dc5efc3e626c857`
and its build, deploy and verify jobs all succeeded. Its receipts report 3,422
files, 963,235,849 staged bytes and an actual 966,215,680-byte archive. The
inventory checksum was independently matched to both receipts. Archive headroom
under the unchanged 980,000,000-byte guard was 13,784,320 bytes. Later main
revisions require their own measurements; this is not a capacity reservation.

The historical checkpoint sections below retain their original verification
boundaries. Their then-pending production execution is now complete; durable
recovery was subsequently verified as recorded below; capacity reduction is not.

The recovery checkpoint's isolated branch started from refreshed main
`d452bda9e22acf705751f11584cdcd5b0a0d4640`. It adds a manual, main-only recovery
workflow, separate from production deployment and Flight package publication.
It requires a successful source-bound main publication with successful build,
deploy and verify jobs and the matching current public deployment identity.
It downloads the existing artifact, binds its GitHub artifact identity to the
accepted archive receipt, validates every member and rehearses an exact restore
into a fresh directory. Only then may it create a separate draft recovery
release, redownload and checksum every asset, and publish it without changing
the latest game release. Existing releases are never overwritten.

This checkpoint does not change repository-wide release immutability. A
checksum-verified durable release is not a claim of GitHub-enforced immutability,
browser gameplay qualification or an executed production rollback. The latter
boundaries remain explicit. Actual runner execution and representative startup
are recorded below. Production rollback execution remains separate.

After recovery acceptance, add a parent-first pending-PR capacity forecast and
review consumer-proven download-only reductions. First reach a measured 950 MB
archive, then a 900 MB operating target. Consider 800 MB as a longer-term target,
not a promised saving or authorization to remove shared content. Do not lower
the working guard before reductions exist. Independent content-delivery or
origin changes require separate approval; existing Studio/SIM and player storage
boundaries remain unchanged.

## Reviewed scope and baseline

The user approved starting the lower-risk plan after reviewing module splitting.
Keep Studios, SIM, gameplay, source originals, installed content and existing
application URLs intact. Do not add a package installer, move origins, rewrite
editable-scenario transport, clear caches, delete branches or rewrite history.

Implementation starts on an isolated branch based on main
`859d5cfc927daff2a350318b2325486a58959648`. The shared human checkout is not edited.
The first checkpoint was then rebased cleanly onto refreshed main
`75bbcf576e757a1a2b6fcb96a524b2ab6199b05d` and verified again there.
At this baseline the publisher uses a 980,000,000-byte final-file guard. The
previously observed public `227deb2b` manifest totals 962,683,818 bytes, but that
manifest is not a complete later workflow-staging measurement. No threshold is
raised or lowered by this evidence-only checkpoint.

## Checkpoint 1: preserve evidence without changing the site

- Inventory the complete final staging tree after optional release overlays and
  rolling identity metadata. Preserve hidden files; reject links, nonregular
  files, unreadable directories, empty staging and uploader-excluded files.
- Hash each staged file and bind the sorted inventory bytes into the existing
  source-bound receipt. Preserve the existing receipt fields and format version;
  add explicit completeness, raw-capacity acceptance, errors and the 20 largest
  files. This is not release qualification or an archive-size measurement.
- Write both diagnostic files outside the site before capacity assertions. Upload
  them after successful or failed inventory execution, unless canceled. All
  source checks, capacity failure exits, upload/deploy success dependencies,
  permissions and deployment serialization remain active.
- Test the actual workflow's Python block with tiny isolated directories. Test
  final overlays/metadata, hidden files, exact hashes, the size boundary, oversize
  failure, links, unreadable directories, empty staging and upload exclusions.
  Register this regression in focused publishing verification.

No storage savings are claimed by checkpoint 1. Native game testing is not
required for an unchanged site payload; production workflow execution remains
necessary to confirm receipt upload on GitHub.

## Following checkpoints, in order

1. Verify the actual uncompressed archive emitted by the pinned Pages action
   (checkpoint 2a below). Then preserve an explicitly uploaded durable
   last-known-good deployment bundle with checksum and source/build identity.
   Rehearse exact-artifact rollback; short-lived Actions artifacts alone are not
   durable backup. No reduction batch precedes that recovery checkpoint.
2. Produce a consumer/ownership allowlist for download-only originals. Verify
   exact pinned GitHub Release downloads before changing any site link. Keep
   every runtime, editable and offline dependency; do not weaken catalogue path
   validation or change original identities. Full releases remain self-contained.
3. Review the 16 gallery images outside the 38 editable-background matches as
   candidates only. Do not remove the 14 industrial themes from the existing
   offline workshop package. Do not treat the 166 MB workshop grouping as a
   deletion list.
4. Measure complete final staging after each small batch. Work toward a 950 MB
   safety ceiling and then a 900 MB operating budget without making the working
   publisher fail merely by lowering its guard first. If low-risk reductions
   cannot create sufficient headroom, report the measured gap and stop; do not
   delete gameplay, discard rollback URLs or invent a waiver.

The 38-scenario image-sharing proposal and executable optionalization remain
deferred. Browser caches, application storage and service-worker activation
protocols are unchanged. Evidence of improved publication diagnostics must never
be presented as completion of the overall capacity or rollback plan.

## Checkpoint 1 verification

- Reproduced missing failure receipts and absent hashed inventory before the fix.
- Nine new regression cases pass. Combined capacity, source-workflow,
  focused-selection and test-policy suites: 62 passed, 0 failed, 0 skipped on
  Node 20.19.5 and Python 3.14.4. Production CI uses its separately pinned runtime.
- Independent read-only review found an unreadable-directory enumeration gap;
  explicit scan-error handling and a real permissions regression fixed it, and
  the second review approved this evidence-only checkpoint.
- Changed JavaScript lint, scoped formatting and whitespace checks pass.
- Earlier sparse-checkout misses were resolved by materializing only the exact
  tracked fixture metadata and workflow/playbook inputs; no dependencies or
  source assets were reinstalled or changed.
- No full site build, live Actions evidence-upload run, archive measurement,
  durable rollback rehearsal, capacity reduction or deployment is claimed.

## Checkpoint 2a: verify the actual uploaded archive

This checkpoint is composed with checkpoint 1 on refreshed main
`51f5af07e188f48e9704c47110a8cc71180bd856`. The pinned
`actions/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9`
leaves the exact uploaded uncompressed `artifact.tar` in the runner temporary
directory. Verify that file after upload, before the build job may authorize
deployment; do not substitute a separately constructed archive.

- Bind the upload artifact ID, source identity and hashed staging inventory.
- Stream-check every regular archive member against its inventoried path, size
  and SHA-256. Reject missing, extra, duplicate, unsafe or linked members. Never
  extract archive-controlled paths onto the runner.
- Record actual archive bytes, raw staged bytes, archive overhead and SHA-256.
  Apply the unchanged 980,000,000-byte budget to the archive as well as staging;
  this is an additional conservative gate, not an increase in allowance.
- Preserve the archive receipt after acceptance or rejection. Failure leaves the
  build unsuccessful and therefore cannot enter deployment. Keep existing
  source checks, permissions, action pins and deployment serialization.

Verification: 75 scoped capacity/archive/source-workflow/focused-selection/policy
tests pass, zero failures or skips. Thirteen new archive tests execute the actual
workflow Python block on tiny synthetic archives. Independent read-only review
found no concrete safety issue. JavaScript lint, scoped formatting and whitespace
checks pass. This is not a full build or live Actions upload test. The action ID
binds the locally retained archive under the pinned action's behavior; remote
artifact re-download verification has not been performed. No actual production
size, rollback readiness or capacity savings are claimed.

## Next checkpoint: durable recovery before any removal

1. Choose a successfully deployed and publicly verified revision, not merely a
   successful build. Preserve its exact archive and source-bound receipts.
2. Verify checksums and complete member equality before publishing a recovery
   bundle. Keep it outside the Pages payload and outside expiring Actions-only
   storage. Use an explicit, separate GitHub release publication path; do not
   repurpose the optional Flight-package selector or broaden its acceptance.
3. Audit release-immutability compatibility before any repository-wide setting
   change. No such setting change or extra write permission is part of 2a.
4. Rehearse restore in an isolated directory: validate before extraction, verify
   restored hashes, metadata and representative startup/dependency behavior.
   A rehearsal does not replace production or clear/migrate player storage.
5. Only then review a separately gated production rollback procedure and the
   first consumer-proven download-only reduction batch.

A checksum receipt alone is not a durable backup, and a source rebuild is not an
exact-artifact restoration. See the subsequent execution record below.

## Recovery execution record — 2026-10-16

PR #1522 merged as `4bb1cde4028509ff3c084a7306f9a383d674cb27`.
Recovery workflow run `38815404958` successfully preserved publication run
`38809373274`, source `836263fa3926bd23a68d67892829203f9931935c`.
The separate, published, non-latest recovery release is:
<https://github.com/mekhovov/revealline/releases/tag/pages-recovery-836263fa3926bd23a68d67892829203f9931935c>.
Its tag was independently resolved to that source. This is checksum-verified
durable preservation, not GitHub-enforced release immutability.

- Runner restoration verified all 3,423 files byte-for-byte in a fresh directory;
  the workflow redownloaded and verified all published assets before acceptance.
- A separate public download of the complete 966,225,920-byte archive matched
  SHA-256 `76fc76b57176395791a86dbe794f879ef15cff939f25b6bc0fec4025cf1c2ad1`.
- Representative browser startup used a read-only localhost server serving the
  exact verified archive. Every response was checked against its inventoried
  size/hash. Normal authentication, main menu, 240-mission chooser, settings,
  return navigation and reload passed. No warnings/errors were logged. The
  network-idle wait timed out; the subsequent ready main-menu state was observed
  directly, so that wait is not recorded as a passing test.
- No flight, full gameplay, offline/device qualification, production rollback,
  cache clearing, save migration or user-settings change is claimed. The second,
  supplemental external-drive restoration subsequently completed: all 3,423
  restored files and 963,249,020 bytes matched the preserved inventory. Browser
  startup above still refers to the verified archive server, not that directory.

## Capacity comparison checkpoint and remaining gates

The read-only `scripts/pages-capacity-report.mjs` compares two complete publisher
inventory/staging/archive receipt packets. It checks their internal identity,
checksum and arithmetic consistency and reports file-level raw deltas separately
from measured archive deltas and target headroom. It does not fetch archives,
reverify archive bodies or GitHub provenance, isolate a PR's contribution, forecast
a combined queue, qualify gameplay, or authorize a merge/removal/deployment.
No workflow or capacity limit is changed by this diagnostic foundation.

Production run `38817575550`, source
`b11745223861c3973ad4bf440cc536198b8e0371`, reports 963,255,988 raw bytes and
966,236,160 actual archive bytes. Comparison with the preserved source above
reconciles 55 changed files and +6,968 raw bytes, while archive growth is +10,240
bytes. Archive headroom is 13,763,840 bytes under 980 MB. The measured gaps are
16,236,160 bytes to 950 MB and 66,236,160 bytes to 900 MB. This is a dated
measurement, not a reservation for pending merges or a claim of savings.

Proceed in this order, verifying each checkpoint before advancing:

1. Verify the comparison foundation with malformed-input tests, real receipts,
   focused-test routing and independent review. Keep its non-admission boundary.
2. Add exact candidate and parent-first combined-queue archive measurements;
   record source/base identities and invalidate stale results. Receipt deltas
   alone cannot prove combined capacity. Existing qualification holds remain.
3. Produce the consumer/ownership allowlist for each download-only candidate.
   Reject runtime, editable-copy and offline dependencies. Verify pinned public
   GitHub downloads and hashes before changing links; preserve Git originals,
   full self-contained releases and existing application/storage boundaries.
4. Apply only a small proven batch, verify every affected link/dependency and
   complete final archive, then deploy and check live behavior before the next.
   No deletions or savings have yet been made by this plan.
5. Reach measured 950 MB, then pursue 900 MB operating headroom; only then consider
   tightening guards. If safe candidates are insufficient, report the gap for a
   human decision rather than removing shared gameplay or changing origins.

## Shared evidence extraction — verification in progress

The comparison foundation merged in #1529 as
`0f0d4e152195901e59f211f3294203aff0b8e192`; publication `38825001991`
passed build, deploy and public verification. Its archive remained 966,236,160
bytes, with 3,424 inventoried files and 963,255,988 raw bytes. No savings occurred.

The next isolated branch starts from refreshed main
`2490636aca847ce3891b2260925f8b07dbcd0cee`. This small sub-checkpoint extracts
only the two production Python evidence blocks into shared files. Their exact
pre-extraction body hashes are frozen in regression tests; existing tiny positive
and negative fixtures now execute those files. Workflow environment, step order,
permissions, action pins, receipts, success dependencies and the 980 MB guard are
unchanged. Rolling metadata extraction and the manual independent candidate
measurement remain subsequent work, not completed by this change.

Local extraction, workflow-policy and focused-routing tests passed 73 cases,
zero failures or skips. Scoped lint and whitespace checks passed. Independent
read-only review confirmed both frozen-base bodies are byte-identical and found
no concrete blocker; actual runner execution remains pending.
The external SMB volume does not support the hard-link fixture, so the unchanged
tiny fixtures were rerun on the local filesystem without skipping that safeguard.
No full local build, candidate measurement, production execution of the extracted
scripts, content removal or merge authorization is claimed here.
