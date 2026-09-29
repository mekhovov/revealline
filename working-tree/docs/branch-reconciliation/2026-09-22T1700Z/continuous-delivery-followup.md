# Continuous delivery follow-up — 2026-09-22

The user authorized proceeding with v0.83.0 first, parallel release-speed work,
and safe continuous reconciliation/release of remaining changes. Playlist retains
sole publication ownership. Existing draft and exact-source/public gates remain.

## Active A release

- Actual source: `01b189f6427601a15cbb3eb1563b5f82eabbafa3`.
- Canonical qualification/freeze: run35762623319.
- Latest observation during this checkpoint: qualify and all four test shards
  succeeded; freeze is running automatically. The publisher has been notified.
- No v0.83.0 public acceptance is inferred. Inspection, immutable asset release,
  separate reviewed selector, Pages and full public acceptance remain required.
- No expected public inventory is generated before the actual frozen artifact.

## New isolated work to account for

Branch: `codex/ci-balanced-shards-20260922`, initially based on exact01b189f.
Worktree: `.cache/worktrees/ci-balanced-shards-20260922`.
Owner: this coordinator; peer review and timing audit delegated to its existing
agents. This is a new local branch/worktree delta, not a new complete census.

The local patch adds an opt-in duration-aware test partitioner and regressions;
existing default sharding and workflows remain unchanged. A raw timing reporter
is being tested for actual Node20 file-container durations. Existing TAP logs
cannot provide reliable file wall times; never manufacture a production profile
by summing named cases. The measured run inventory contains901 tests files.

Runner review initially identified FIFO-blocking/unbounded-read and coerced-SHA
input issues. They were corrected with typed identity validation and bounded
nonblocking regular-file reads; regressions include FIFO/symlink rejection and
timed source import/cwd behavior. Independent rereview passed7/7 on Node20/22
and records exact identities in `runner-review.json` in the new worktree.
No hosted performance improvement, complete-source CI or activation is claimed.

All work remains local/unpublished during A. Preserve this worktree and all
original source/evidence. No release version, runtime/Pages bytes, existing
owner branch, tag, workflow or main state was changed by this work.

## Reviewed queue facts

Read-only review of infrastructure235 found a conflict-free exact three-path
integration into01b189f and unchanged release/Pages workflow bytes. Node20/22
workflow contract tests passed. Its existing hosted preview used an old
synthetic base; current-main integration, owner clearance and fresh preview
remain required. After ordering clarification, Playlist explicitly scheduled235
first after A public acceptance and final selector merge, before B retarget/full
CI. Do not change235's head or trigger fresh hosted CI before that selector
merges. Then integrate authoritative post-A main once, qualify/review235 and
verify unchanged selector/release bytes; only then retarget/version/qualify B.
This supersedes the earlier B-before235 scheduling assumption. Experimental
balancing remains local/unpublished for separate review.

The existing `review-revealline-prs` heartbeat was updated in place from30 to5
minutes, preserving quiet unchanged-state notifications and adding lightweight
exact-head/run checks, deduplicated immediate publisher handoffs, and incremental
ref checks. No duplicate automation or publisher was created. This is a recovery
monitor, not authority to promote incomplete drafts or overwrite artifacts.

Completion still requires all refs and unique dirty patches accounted for and
each shipped unit publicly accepted. Prior immutable comments/snapshots remain
unchanged; this addendum does not declare reconciliation complete.

## Completed local CI checkpoint and A handoff

- A qualification/freeze35762623319 completed successfully; all frozen artifact
  upload steps passed. Hosted inspection35772379842 is now running under Playlist.
  Outer artifact10714686961 is2,189,369,028 bytes with GitHub artifact SHA256
  `101c70e970a03b0810df874800d8bdd4a79adb0be6cc725ad9fc8675b8f41579`.
  This is not the distribution ZIP digest. Coordinator did not download it.
- Local CI branch has two commits: scheduler`4f98aac5e`, then reporter/evidence
  `95fa082d3`; clean worktree, no remote push/PR/workflow activation. Exact full
  head can be resolved from that preserved branch. Eight scoped files only.
- Combined scheduler/reporter tests pass17/17 on Node20.19.5 and22.22.2,
  with zero skips/cancellations. Independent reviewers verified all four source
  hashes and repeated focused suites. Pinned lint/format/whitespace pass.
- The initial Node22 reporter failure is retained. Its corrected handling binds
  cwd-relative container names to exact absolute files; no cases are omitted or
  summed to fake file durations. Production weights/converter/hosted benchmark
  are still separate gates. No public speedup is claimed.
- Existing timestamped PR comments remain unchanged; local progress is recorded
  here rather than silently upgrading their historical evidence.

## v0.83.0 artifact assembly checkpoint (19:25 UTC)

Inspection35772379842 completed successfully. The retained wrapper explicitly
reports `INSPECTED_VERIFIED`; the detailed source/distribution inspection and
offline review both report `PASS`. Frozen originals remain on GitHub only.
Playlist explicitly delegated exact annotated tag, draft, seven-small-asset
upload and upload-binding preparation to this coordinator; Playlist retains the
one `upload-originals` dispatch, final publication and Pages authority.

Actual assembly is preserved under this worktree's `.cache/v0830-assembly-r1`.
Both exact PR35753052831 and merged-source35762623319 families parsed as
11,788 passed across901files, with zero failures/cancellations/skips/todos.
Seven small assets passed the exact-source offline consumer. Evidence ZIP has
84entries including its manifest;83 evidence originals total33,021,445bytes,
and all entries total33,035,675bytes. No public acceptance follows from this.

The source preparation copy retains the complete237-path non-runtime merge
delta (15,323,905-byte binary diff), raising only its aggregate metadata limit
from8MiB to24MiB. The16MiB perGit-response and64MiB overall evidence bounds,
source gates and all qualification requirements are unchanged. Independent
source-scope/inspection review passed; final package review precedes mutations.
Thirteen offline helper regressions passed. Prior preparation and evidence were
not overwritten. Historical PR comments remain timestamped snapshots.

Independent final package review passed (`independent-actual-release-review.json`).
The coordinator created annotated tag`972dedddefe8a25286b9664b064ecfa6ad742c5f`
for exact source01b189f and draft release394050785, then uploaded exactly seven
small attachments without clobber/retry. Fresh GitHub API readback verified all
seven uploaded states, lengths and server SHA-256 digests, unchanged annotated
tag/source and unpublished draft status. Before/after API originals remain in
the isolated assembly directory. `upload-binding.json` SHA-256 is
`819e6d4a20e06f6b57a544922f158a7c3d04abef2540502d29060fcef3051374`.
Playlist received the nine-descriptor binding for independent review and its
sole original-upload dispatch. No main, Pages, B or235 changes were made.

## A selector and temporary user exception (19:47 UTC)

Playlist completed immutable upload35773924965 and published release394050785
at19:31:56Z. All nine original assets remain immutable. Latest independently
resolves to v0.83.0. Separate selector PR271 head85e19b15863b6d7c13194c90c2f37e71cc074bc1
passed both independent UX reviews and hosted preview35775410389, including
full assembled-artifact reread. Playlist merged it with merge commit
e0f99c9642355aa3daf62ce3e551675b8c9d2e14 at19:45:50Z. Production Pages
run35775874062 is running; public byte and native acceptance are still pending.
The119 PR270 staging originals and102 activated copies were compared exactly.
All first50 admissions/allocations and126 prior catalog entries are preserved.

Two new preserved worktrees/refs extend, not replace, the earlier census:

- `codex/pages-v0830-20260922`, `.cache/worktrees/pages-v0830-20260922`:
  represented by merged PR271;229 scoped controller paths, no runtime source.
- `codex/temporary-release-test-exception-20260922`, matching path beneath
  `.cache/worktrees/`: active coordinator-owned unique dirty implementation,
  based on01b189f, not yet committed or represented by an intake PR.
  Three agents own disjoint workflow/policy, Python consumer/assembler, and
  Pages consumer changes. Preserve all work until its separate reviewed PR.

The user's newer explicit instruction authorizes temporarily skipping automated
test suites. A's existing passing v1 evidence is unchanged. New waived releases
must say `qualified-with-test-waiver`, retain actual skipped-job and exact
committed-policy originals, and never report fabricated passing tests/counts.
Build, source/provenance, immutable hash, archive and publication checks remain
mandatory. This increases regression risk and does not graduate unfinished
owner-held drafts. Restore tests with reviewed policy mode `required`.

Latest publisher/UX priority supersedes the earlier queue paragraph: A public
acceptance, then completed B/PR268; PR235 and experimental balancing deferred.
The existing5-minute heartbeat was updated in place to preserve that order and
the new waiver, quiet unchanged-state behavior, and sole publisher ownership.
No new census or zero-unaccounted-patch completion is claimed by this addendum.

## Waiver PR272 published; A deployed

Production35775874062 completed successfully on e0f99c. Playlist and UX retain
public byte/native acceptance; deployment success alone does not complete it.

Waiver work is now committed as51b6d18447dbfe3584038f66d824a119bcdbd30a
(tree3ba7418407b3cc2df565416dcac491edbf331f5c), pushed and represented by ready
PR272. Its20 files are CI/publishing-only; no runtime, version, selector, catalog,
allocation or historical asset changes. Independent bounded reviews passed.
Final local44Node+17Python focused checks passed, as did Python-to-JS fixture
compatibility, unchanged real A inspection closure and legacy small-package
validation. A negative test fixture was corrected after optional generic pins
changed which item `pop()` removed; that intermediate failure is documented.
No full gameplay suite rerun or real waived-source qualification is claimed.

Local committed controller preview verification passed with51 admitted archives
and currentv0.83.0. Sparse checkout initially lacked catalog.json; exact tracked
controller inputs were hydrated, with no source changes, then verification
passed. Initial explicit staging missed three policy paths outside sparse rules;
`git add --sparse` staged only those named files. Shared/owner worktrees untouched.

Hosted source35776713393 and Pages preview35776713481 started on PR272. Merge
remains held until A public acceptance and this exact head's mandatory checks.
Playlist and B owner were sent exact head/base and restoration instructions.
The new remote counterpart is also represented by PR272; prior census snapshots
remain historical. B owner reports clean1a63e5f0609e14a6e699aba0771506a2137d2595
and awaits the accepted baseline rather than launching another long suite.

## Temporary exception active on main (20:03 UTC)

PR272 merged with merge commitce09a38c538526adb919a5dfa18ee764599dc6e2
at20:03:34Z. Root was explicitly handed sole merge-writer ownership and used
the exact-head guard, preserving the branch/worktree. Fresh readback confirmed
20 intended paths, no unresolved review threads, unchanged main basee0f99c,
no game/version/selector changes, mandatory preflight/build success and actual
test-job skip. Source run35776713393 succeeded; preview35776713481 succeeded.

All3,809 preview file paths, lengths and SHA256 values exactly match A's
production inventory, totaling613,866,928bytes. Retained bounded comparison:
`.cache/worktrees/temporary-release-test-exception-20260922/.cache/pr272-preview-receipts/unchanged-production-byte-comparison.json`.
Preview syntheticcf99c13a369cabb2092c25f648fe694860a25735 has exact parents
e0f99c+51b6d184 and reviewed tree3ba7418407b3cc2df565416dcac491edbf331f5c.

Publisher cleared A's hold after complete public production-byte audit passed
3,809files/613,866,928bytes with zero mismatches. Marker/source/hashes,
91/91/12 discovery, Solo/Versus play and Next, Continue reload, and Legacy
install/launch/return were confirmed. Team Next, Playground, responsive and
cold-offline checks remain in progress or deferred, not asserted passed.
The user's test exception also makes these extended manual regression journeys
non-blocking; basic availability and source/build/asset/archive checks remain
mandatory. The existing heartbeat was updated in place to capture that scope.

Ordinary automatic push run35777786143 is publishing the unchanged A selection
under the new policy. No manual release/deployment dispatch or new game version
was made. B owner and Playlist received authoritative baselinece09a38 and can
prepare B's current-main/version/mandatory CI in parallel; B main merge waits
for normal policy-pipeline deployment clearance. Extended tests are deferred,
not converted into successful evidence. Full branch reconciliation is unfinished.

### Evidence-scope correction from publisher

The earlier publisher message and paragraph above overstated public HTTP scope.
3,809files/613,866,928bytes describes the complete verified assembled production
artifact and its exact PR272 preview comparison, **not** a complete public HTTP
reread. Actual affected-public-byte audit covered135files/258,792,093bytes,
including all103 originals, with zero failures. Keep these distinct; no complete
3,809-URL public reread is claimed. This correction supersedes the earlier
"complete public production-byte audit" wording without rewriting historical
receipts. Basic public availability and scoped journeys are accepted; any
unperformed extended verification remains unperformed under the user exception.

UX's final scoped native receipt SHA256 is
dd3ae457088e53dc53e957d6c7ec7de2f7c440677479457cb7d58bb41a3ed12e at
`.cache/ux-delivery-review-20260922/a-public-native-v0830.json` in the shared
repository cache. It adds actual Team win/Next, Playground and bounded portrait/
landscape checks as passed; physical-device, prepared-cold-offline and full
regression-matrix coverage are not asserted. Root independently checked its hash.

## Policy pipeline completed and redundant PRs reconciled

Automatic main run35777786143 completed successfully (assemble and deploy).
Its full prepared-artifact inventory is exactly equal to A:3,809files,
613,866,928bytes, unchanged path/size/SHA256 for every row. Receipt SHA256
e75ff69732af3d2c2b0e592fa55ad6d92d89638040bf943530a972e18ae65280,
controllerce09a38/tree3ba7418. Root rechecked public release.json after success:
v0.83.0/source01b189 and all expected source/distribution/manifest hashes.
This is unchanged-byte policy-pipeline verification, not a new game release.

Closed exact superseded PR270 at20:06:12Z after publisher clearance, retaining
all119 staging originals and every branch/worktree. Closed255then253 at
20:11:37/39Z after active owner clearance and current-head checks. Root and
independent agent recomputed all8stable patch-ID pairs, actual-merge/main
ancestry and21-path rename-aware equality. Fresh durable proofs are
`pr270-exact-successor-proof.json` and
`pr253-pr255-merged-source-revalidation.json` in this directory. No unique
committed remainder, branch deletion, worktree removal or source replay.

Policy deployment hold is cleared; Playlist and B owner notified immediately.
Fresh main advanced to0a9454f4899ccf30e6205af592c0051c245e9c48 via PR273's
eight delivery-only acceptance-doc paths, direct parentce09a38. No gameplay,
version or selector drift; B was told to integrate fresh main rather than a
stale baseline. Remaining tests remain optional under the user exception;
source/build/asset/archive/basic-availability guards remain mandatory.

## v0.84.0 merged source frozen; read-only inspection dispatched

PR268 actual merge1107f570508e0d107440236b6aeedbce8506cd7d is pinned by
preserved remote evidence ref `codex/qualify-v0840-1107f570-20260922`.
Qualification35779409329 completed successfully: mandatory source checks and
freeze passed, automated tests skipped under the explicit temporary policy.
Artifact10717823950 is2198989977bytes with outer SHA256
77ce533193f1cf9070aebf0c87b003b7c174c4bbe3f6668a3116f630f2b6d813.
Root verified direct and listing metadata, exact source/ref and binding schema,
then dispatched read-only inspection35780681780 exactly once at20:30:01Z.
Inspection acceptance remains pending, not inferred from qualification success.
See `v0840-freeze-inspection-dispatch.json`. Playlist remains sole publisher;
root has made no tag, draft release, upload or publication mutation.

### Inspection complete and waived small package handed to publisher

Run35780681780 succeeded with `INSPECTED_VERIFIED`, inner inspection PASS and
frozen-offline review PASS. Only the734,394-byte retained evidence artifact
was downloaded locally; the2.2GB frozen original stayed hosted. Root captured
complete raw completed run/jobs originals for PR35778248160, qualification
35779409329 and inspection35780681780 (4/5/5jobs). The exact eight-path
allowlist matched both immutable Git diff and independent publisher review.

The offline adapter produced seven small attachments/nine asset descriptors;
the immutable frozen-source consumer verified54originals/1,870,153bytes with
all pins, CRCs and hashes resolved. Status is
`OFFLINE_CONSUMER_VERIFIED_SMALL_PACKAGE`, tests `{status: waived, counts: null}`.
`v0840-inspection-package-handoff.json` pins receipt hashes and paths. Playlist
received the package for independent review and guarded publication. No root
tag/draft/upload/publication action; selector promotion and public verification
are still pending and are not inferred from frozen inspection success.

## Explicit publication and Archive52 handoffs

The later `v0840-publication-race-reconciliation.md` supersedes the pending
publication checkpoint: Playlist published the independently reconciled earlier
package at20:36:42Z. Both inspections/evidence packages are preserved; root
Releases made zero game-release mutations. All nine published descriptors and
seven small bodies were independently verified against the earlier package.

Archive52 was explicitly reviewed as a new bounded shard, never an eviction from
Archive51. PR1 head6289140a0f876cafd9d76a5eb207fd1ae4b40116 preview35781993718
passed1063files/590,419,655bytes. Merge2dd7e8a598d8e37af063933733b8dc458ea9d44f
retains treeb21a8bdf97a7b4af190f065286d470e2c73e1f4f; production35782103893 was
in progress at this checkpoint. Repository/branches and raw receipts remain.
Main selector worktree `codex/pages-v0840-20260922` preserves all127 historical
catalog rows while adding v0.84.0; it waits for actual Archive52 admission.

The existing five-minute heartbeat was updated in place with exact current
handoffs, the truthful waiver, preservation requirements and the rule that idle
tasks or quiet replies never transfer writer ownership. It remains quiet on
unchanged/non-actionable state. No duplicate automation was created.
