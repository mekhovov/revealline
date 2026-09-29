# Local changes and release reconciliation

This is a read-only inventory and dependency review, not approval to publish every
local file. The observations were captured on 2026-09-29 while other feature work
was active. Exact heads and working-tree hashes must be checked again before any
commit or merge. No product code is included in this evidence change.

## Current release and queue

| Order                     | Work                                                                                          | Existing delivery                                                                    | Admission condition                                                                                                                                                                                                   |
| ------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1                         | Steam Deck native/frame Confirm race and usable diagnostics                                   | Merged PRs #775 and #778; v0.142.3 source `afb19ebd06db336d32dfe4660c43aa0f6711dca5` | Finish exact-source qualification, immutable assets, reviewed Pages selector, public-byte audit and packaged Chrome acceptance. Physical Deck acceptance remains separate.                                            |
| 2                         | Mission selector and global level cards                                                       | PR #776, milestone `v0.142.4 — Mission selector and level cards`                     | Reconcile with publicly accepted v0.142.3 and qualify the final aggregate. Preserve this existing PR rather than duplicating its committed feature.                                                                   |
| Review before allocation  | Audio persistence; Pause/Skip; Team difficulty and More                                       | PRs #779, #771, #756 and #757                                                        | Retain each owner's draft/hold state until its focused evidence and overlapping UI changes have been reconciled. These have no new version assignment in this review.                                                 |
| Review before allocation  | Native menus, field editors, branding, public identity, landing scenes and authoring adapters | Active shared-checkout changes; Landing and Demo feature work                        | Capture a stable source checkpoint through the owners, integrate on accepted main, regenerate resource/localization/native closures and pass input, navigation, offline and responsive checks.                        |
| Dependent review          | Demo, replay takeover, analog reception and audio handoff                                     | Active shared-checkout changes                                                       | Port the old Confirm lifecycle hooks onto the v0.142.3 coordinator, preserving short-tap, native-first, release-click and cancellation regressions. Then qualify replay, Worker, storage, audio and browser behavior. |
| Existing feature stacks   | Discovery/company content, actor work, inventory/screening and deployed community acceptance  | PRs #758, #761, #738/#747 and #736/#745                                              | Resolve active rebases and explicit acceptance/publication limits. Reuse the current PRs and their declared dependencies; old milestone names are not proof of public acceptance.                                     |
| Historical reconciliation | Old dirty worktrees and evidence                                                              | Recorded in the worktree inventory                                                   | Compare semantic changes with accepted main and published successors before extracting anything. Dependency links, obsolete compiled data and partial old index states are not release inputs.                        |

The PR milestone remains the authority for an actual product release schedule.
Only #776 has the next confirmed version assignment in this table. The other rows
record the proposed dependency order and concrete hold conditions; they are not
claims that all local work is reviewed, ready, or already scheduled for publication.
Cross-chat ownership coordination was requested and is still pending in this review.

Do not merge this documentation or another source change during the guarded
v0.142.3 qualification/publication window. Its source must remain current main until
the release workflow has completed its exact-source checks.

## Findings that affect delivery

- The inventory contains 260 registered worktrees, of which 259 existed. Of 111
  apparently dirty worktrees, 58 contain only a local dependency link. The shared
  checkout changed during inspection; one observed manifest contains 526 paths.
  These numbers are an observation, not an atomic preservation snapshot.
- The shared Demo integration still references the older `reset`, `filter` and
  `confirmTransaction` protocol. Current main uses `sample` and `cancel`. A
  whole-file overwrite could undo the Steam Deck repair or break Demo. Merge this
  behavior deliberately and retain the real Chrome click regression.
- The claimed 24 controller/player-UX paths belong to historical production63
  work superseded by PR #374. Twenty-two files exactly match their pushed upstream;
  the remaining two are stale intermediates. No new product PR is recommended.
  Current main's production99 data must not be replaced with that old snapshot.
- There are two conflicted checkouts and large historical staged addition/deletion
  sets. Preserve their owners' operations; do not commit them as a bulk cleanup.
- Local disk repeatedly reached ENOSPC. Use bounded source review and remote
  qualification, and restore capacity before materializing large local artifacts.

## Evidence and limits

- [Primary review and exact grouped paths](primary-review.md)
- [Primary path/size/hash observation](primary-inventory.json)
- [Worktree review and existing PR mapping](worktree-review.md)
- [Complete worktree observation](worktree-inventory.json)

This review did not run a fresh test suite for the hundreds of shared changes and
does not certify their line-by-line correctness. The Steam Deck source has its own
focused CI and Chrome evidence. Its local full-suite run remained incomplete and
not passed: 45 observed failures/assertions were reproduced on baseline, ten host
readiness timeouts remain unclassified, and one stale assertion was corrected.

Ignored files are outside this Git inventory. Historical branches may have been
squashed, superseded or deliberately retained; ahead/behind counts alone are not
proof that they need a new PR. Revalidate all live facts before release admission.
