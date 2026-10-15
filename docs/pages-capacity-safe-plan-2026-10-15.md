# Safe Pages capacity work — 2026-10-15

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

Until these steps are verified, recovery remains pending. A checksum receipt is
not a durable backup, and a source rebuild is not an exact-artifact restoration.
