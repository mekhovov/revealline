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

1. Measure the actual uncompressed archive emitted by the pinned Pages action,
   and preserve an explicitly uploaded durable last-known-good deployment bundle
   with checksum and source/build identity. Rehearse exact-artifact rollback;
   short-lived Actions artifacts alone are not durable backup.
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
