# Exact-source policy-change admission

## Approved purpose and boundary

Unblock the reviewed Pages stack foundation without removing its focused-test
registration or waiving a validation gate. The user approved a main-owned,
exact-source approval path. This checkpoint does not authorize capacity removal,
gameplay qualification, deployment qualification, new origins or guard changes.

## Design

The trusted-main controller may accept a policy-file difference only through a
strict approval record shipped with that controller on main. The record pins
repository, PR number, exact head, reported base, exact changed-path inventory,
the complete trusted policy blob inventory and the exact approved replacement
blob inventory. Unknown fields, malformed hashes, duplicate paths/records,
missing objects or any unapproved difference fail closed. Approval data in the
candidate cannot authorize itself. Ordinary receipts must still match the
trusted-main policy digest. For an exact approved exception, the record also pins
the expected receipt-policy digest independently derived from every reviewed
candidate policy file. The receipt cannot supply its own accepted digest, and
the actual main-policy inventory and digest must match the approved baseline.
An approval is not a replacement receipt.

The initial record is limited to PR 1553 at head
717f2ba6fec280d8bbf9ff3ac495648b95c5e4f2 and reported base
facf1627e2bb039ee7e5a3b9d662ded4c4ef3368. Only
publishing/focused-test-map.json may differ, from trusted blob
9d09a9d27d6d0ef7b68606b7d3d489968fc92530 to reviewed blob
61a0b7a8f903a73a1ae5e5eeb26863b3b585f1f2. Its full five-file change inventory
must match. Other policy blobs remain identical to trusted main. Main-policy
movement invalidates the record. Current main is frozen to the trusted checkout
and reread immediately before any mutation; intervening movement aborts.

Receipt provenance, exact-head check inventory and latest attempts, all
non-waived successful checks, dependency completion, source identities and
mergeability remain mandatory. Closed or draft PRs must not be merged, armed,
updated or submitted as a stack. The controller never executes candidate code.
Approval does not grant Pages capacity, deployment or product qualification.

## Bootstrap and lifecycle

The bootstrap changes no POLICY_FILES member and therefore uses the existing
ordinary admission path, not its own new exception. The approval record and
controller code are loaded exclusively from main. Future candidate changes to
approval machinery must not be accepted through an approval exception. The
initial record is exact-head-only and cannot authorize another PR or head.
The original PR stays draft until bootstrap production is verified and the
remaining qualification/merge safeguards are freshly checked.

## Verification and implementation sequence

1. Independently review this design and the implementation, using the approved
   external checkout only and preserving all unrelated modified files.
2. Reproduce rejection of the reviewed map-only policy difference, then prove
   exact approval succeeds without changing receipt-policy validation.
3. Test altered head/base/PR/repository, changed main-policy blobs, extra/missing
   changed paths, missing/extra/duplicate approvals, unapproved policy changes,
   candidate-owned approval changes, drafts/closed PRs and main movement.
4. Run existing controller/admission/source/focused routing suites plus scoped
   lint/format checks. Publish a separate reviewed bootstrap PR; require all
   exact-head gates before merge, preserve its branch and verify main reachability.
5. Verify source-bound production receipts and representative live hashes.
6. Recheck PR 1553 admission and exact-head gates. Only then promote and merge
   that checkpoint and verify its own production before real-stack work.

The existing external local checkout intentionally has five foundation changes
on local HEAD 20768f5 while remote PR head is 717f2ba. Do not reset, blindly commit
or push it. Publish only explicitly reviewed bootstrap paths from fresh remote
main through the Git data API if local Git reconciliation remains unsafe/slow.

## Local verification

Independent design and implementation reviews passed. The reviewer reproduced
a same-SHA base-retargeting race in the first implementation; the final mutation
snapshot now reapplies the entire approval identity and rejects it. Regression
coverage includes actual bounded ZIP receipt parsing, trusted policy-digest
rejection despite an approval, ordinary unchanged-policy admission, expired and
duplicate artifacts, incomplete/duplicate changed-file inventories and rename
sources. Final snapshot tests reject changed main, head, base/ref/repository,
draft/state, latest gate identity, pending/failed checks and incomplete dependencies.

Five scoped controller/admission/focused/source-workflow/test-policy suites pass
84 tests with zero failures or skips; scoped ESLint passes. The first wider run
found an absent unchanged sparse-checkout fixture, not a failing assertion; after
materializing that exact main fixture, the full scoped run passed. Original
failure output was not accepted as a pass. Hosted exact-head gates, bootstrap
merge/production and PR 1553 admission remain subsequent verification checkpoints.

Live receipt replay additionally exposed that the workflow uses the reviewed
candidate map in its policy digest. Its receipt digest is
533b2fbc30efdf12a2d5ea578a4360239e284ff8200107f1f7765b9f6210489b;
current main's digest is
730c6d2aff774640f4275ee7f24cf1bee46d0f9d5a130e91f075c162890a0e22.
Both were independently recomputed from every exact-source policy file, rather
than trusting the receipt. The first live replay correctly rejected the old
main-digest-only implementation. The corrected record pins both digests and
still rejects any different main-policy inventory or unapproved receipt digest.
