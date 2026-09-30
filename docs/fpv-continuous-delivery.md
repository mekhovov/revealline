# FPV continuous feature delivery

Updated 2026-10-01. The owner requests a verified PR after each completed feature,
with the next independent item developed while source gates and deployment run.
Additional unit coverage belongs in the final phase. Build, browser, replay,
import/export and publication verification remain part of every applicable item.

## Delivery queue

| Item                                             | Branch / PR                                                                                      | Current state                                                                        | Acceptance                                                                                                                                       |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| World Studio development playtest                | `codex/fpv-world-framework`, [PR #885](https://github.com/mekhovov/revealline/pull/885)          | Completed; native stack layer 1                                                      | Recorded browser/build/offline evidence in `fpv-worlds-playtest-verification.json`; protected merge and actual deployed launch remain required   |
| Academy demonstrations and beginner entry        | `codex/fpv-academy-demonstrations`, [PR #887](https://github.com/mekhovov/revealline/pull/887)   | Completed; native stack layer 2                                                      | 24 existing demonstrations, half-speed and replay controls; browser/offline evidence in `fpv-academy-demonstrations-verification.json`           |
| Woodland demonstrations                          | `codex/fpv-woodland-demonstrations`, [PR #888](https://github.com/mekhovov/revealline/pull/888)  | Completed; native stack layer 3                                                      | Eight challenges × two modes; all 16 actual recordings complete in Node and Chromium without contacts; route-facing presentation reviewed        |
| Courtyard demonstrations                         | `codex/fpv-courtyard-demonstrations`, [PR #890](https://github.com/mekhovov/revealline/pull/890) | Completed; native stack layer 4                                                      | Eight challenges × two modes; all 16 recordings complete without contacts; offline, localization and route-facing playback verified              |
| Live sector timing and personal-best comparisons | `codex/fpv-sector-deltas`, [PR #892](https://github.com/mekhovov/revealline/pull/892)            | Completed; native stack layer 5                                                      | Tick-accurate sector timing, replay-verified compatible reference frozen per attempt, interrupted-flight restoration and readable EN/UK feedback |
| Warehouse racing demonstrations                  | `codex/fpv-warehouse-demonstrations`, [PR #894](https://github.com/mekhovov/revealline/pull/894) | Completed; native stack layer 6                                                      | 16 new demonstrations, all previous 56 proofs unchanged, final browser/offline/EN-UK walkthroughs; 72 available examples                         |
| Remaining new-world demonstrations               | Stadium, container yard, garage; separate coherent PRs                                           | Recordings prepared; browser/integration and target-visibility qualification pending | Exact recordings and reproducible generators retained in ignored local preparation output; do not publish before final checks                    |
| World/drone presentation and player tuning       | Subsequent bounded feature PRs                                                                   | Queued                                                                               | Improve remaining art/animation/readability and mode-specific thresholds using actual player observations; keep flight handling unchanged        |
| Final qualification                              | Final phase                                                                                      | Deferred                                                                             | Additional unit coverage, full compatibility/failure matrix, named physical-device performance and human content acceptance                      |

The approved scope and production limits remain in
[`fpv-worlds-implementation.md`](fpv-worlds-implementation.md). The current 60
challenge definitions do not represent 60 fully polished, human-qualified levels.

## Publication procedure

The FPV PRs are now linked as **native GitHub stack #889**, rooted on `main`.
The existing layers are #885 → #887 → #888 → #890 → #892 → #894. New dependent items append above the
current open top; keep each feature's reviewed diff separate. The owner explicitly
requested stacked PRs on 1 October 2026.

1. Finish a coherent feature and record actual build/browser/content evidence.
   Additional unit coverage remains in the final phase. Commit only that item.
2. Create its PR against the predecessor branch, assign the existing scheduled
   planning milestone **v0.150.0 — Unified native experience** (#57), and attach
   it to this chat. Add it to the current open native stack through the GitHub
   stack API. After a stack fully merges, base the next feature on main and create
   a new stack only when another dependent feature needs one.
3. Start the next feature on a separate branch while all published layers run
   their required checks. Do not add unfinished work to a ready PR.
4. Keep the native stack linear with a cascading rebase when necessary. Freeze
   active local edits first, capture every current remote head, retain recovery
   refs, and push only with explicit per-branch leases. Never overwrite newer
   owner work or mix unrelated commits into the stack.
5. Native members inherit the trunk's branch protections. Inspect the exact
   current heads and required gates for every layer being merged. Respect holds
   and reviews. Use the protected asynchronous stack merge API for an admitted
   contiguous group; never use an administrator bypass or disable checks.
6. Follow **Deploy protected main to GitHub Pages**. Confirm the public deployment
   metadata identifies the merge or a verified descendant, and launch the actual
   FPV application before calling an item live. Open and merged PRs are distinct
   from verified player availability.

Do not manually retarget native stack members while they remain stacked. GitHub
manages the stack relationship. If the native stack cannot satisfy repository
requirements, preserve the blocked state and continue independent development;
do not silently dissolve it or weaken publication guards.

The older fastline controller still has a stale active milestone/workflow-name
assumption. Keep global release authority unchanged. Owner-authorized protected
stack publication uses the current GitHub requirements directly.

Public deployment target: <https://mekhovov.github.io/revealline/optional-practice/fpv-worlds/index.html>.
Local `dist/fpv-worlds-playtest/` paths are not the public deployment path.

References: [GitHub stack requirements](https://docs.github.com/en/pull-requests/reference/stacked-pull-requests)
and [stack API](https://docs.github.com/en/rest/pulls/stacks).

A thread heartbeat, **Continue FPV feature delivery**, checks this queue every
30 minutes. It should preserve active agent work, avoid duplicate PRs and keep
unchanged status quiet. Record meaningful progress here and notify the owner of
completed items, verified live availability, meaningful failures or needed input.

## Latest delivery checkpoint

On 1 October, native stack #889 was cascaded onto main
`8b7c23f837fba54c353a625ae569e994a9592952` with local recovery branches and
an atomic push guarded by each captured remote head. The resulting FPV source
and asset bytes match their previously verified versions. Current published
heads at that checkpoint:

- #885: `994fb4bd80fd336ba1889dce2479705260d378fd`
- #887: `7b4524b87b86003d62fd73af055b7cc48ac0e0b5`
- #888: `5052f6e1ab5235cb329a05ea16c0dea45f2da11d`
- #890: `3ce3b98ef9b150fde0f7211a0251bb09259b5b8f`

The synchronized native layers all passed their required source workflow,
including layers whose immediate base is another feature branch. The guarded
asynchronous merge request for the top PR was then rejected with
`Required status check "release-ready" is expected.` Main had advanced to
`b89a465209a1`, leaving the stack behind. Request UUID:
`582b5a7f-ebdb-48db-8fbc-78f612811b4f`. No protection was bypassed and no PR merged.

Refresh the stack together after active edits are committed, retain recovery
refs, and require fresh checks on the updated heads. Always re-read actual heads,
reviews and holds before another protected asynchronous merge.

No FPV live deployment has been verified yet. Sector timing is now complete and published as #892. Warehouse integration
continues on `codex/fpv-warehouse-demonstrations`; prepared stadium and operations
recordings remain separate until their final browser/offline qualification. Native stack membership is
not a merge or deployment confirmation.

### Second coordinated refresh

After the sector feature was verified and committed, all five native layers were
rebased onto `b89a465209a16186005ac07f5bcd806fd650fbb7` and atomically pushed with
explicit remote-head leases. Source and asset comparison found no FPV changes
introduced by the rebase. The sector package rebuilt to the same SHA-256:
`5c5076ed6aa7acac9ea6a248b4ae2ea7e9d6f2d0e0f76f227a8d60d118c60fd4`.

- #885: `fdd2bddb08d4ac960c250fde72e6559d9a3c97f3`
- #887: `cf67bfa31344ce06970841307fc8262d1e9f443b`
- #888: `ccaa406b8dc52db01487a311f25907066a8a5f51`
- #890: `d9bce5f59ca8ba9ecef0234a38f767b508694976`
- #892: `62bf7c97b138032e0f37beabb4d542938e03d8d7`

Fresh required gates are pending. Publish any admitted contiguous prefix without
waiting unnecessarily for higher layers. No merge or live deployment is claimed
at this checkpoint. The active local Warehouse branch must stay untouched by
publication operations while its feature is being completed.

### Prepared content for subsequent increments

The ignored worktree output `dist/fpv-content-preparation/content-handoff-index.json`
retains the portable generators, original provenance and 48 recorded attempts for
stadium, container yard and garage. Each batch independently replays and regenerates
exact artifact hashes. These files are not shipped or counted as available examples.
Integrate each world on its own branch, preserving existing recordings, and complete
its browser/camera/offline checks before publication. Operations examples also need
explicit review of distant-target visibility; Node completion alone is insufficient.

### Warehouse handoff

The Warehouse increment is functionally complete: all 16 recordings reproduce in
Node and the built Chromium runtime; the catalogue exposes 72 examples for 36
challenges. Playback, rival spacing, gate approaches, mode/restart controls,
record isolation, offline completion and Ukrainian mobile layout passed. The
package is 75 files / 10,900,786 bytes, SHA-256
`5e9336a76edefbcd54028764efb11b8eb7f867f322127e85aa320dd28a49a20d`.
No flight/course/actor changes or unit-coverage expansion were made. The next
coherent content increment is Stadium, followed by the two operations worlds.

Initial visibility review of prepared operations recordings found the Garage
intercept targets too small for a clear teaching example at the spawn-distance
firing position. Improve the recorded approach or target presentation and inspect
it again before publishing operations examples; completion hashes alone do not
clear this visual gate.

Warehouse is published as [PR #894](https://github.com/mekhovov/revealline/pull/894)
and appended above #892 in native stack #889. Its first feature commit is
`87753e6a8`; this delivery-log update triggers checks on its current published
head after joining the native stack. Stadium is the next development branch.
Required checks, protected merge and verified public launch remain separate from
feature completion. Main has strict status protection and no configured GitHub
merge queue; use the protected asynchronous native-stack merger and never bypass.

### Next base change

All five refreshed source gates passed again, but main advanced during their run
to `135210d560c1` through PR #884. Warehouse's published head `15ffc0ec5d47`
started its required gate. Preserve those results as historical evidence, commit
the active Stadium increment, then coordinate the next refresh rather than
mutating branches underneath development. This is base contention, not a failed
FPV functional check. No FPV merge or public availability has been confirmed.

### Stadium handoff

Stadium adds 16 completed demonstrations in Self-level and Acro. The catalogue
now exposes 88 examples across 44 challenges, preserving all 72 previous proof
hashes. Exact generator reproduction, all final-build browser replays, six
FPV/chase route inspections, playback controls, record isolation, offline
completion and Ukrainian mobile layout passed with zero page errors. The package
contains 75 files / 11,679,377 bytes, SHA-256
`402dd39dce98416cca534a46c7df97cfd66bf8b5e55733bf26ba4cb636f8e813`.

Main subsequently advanced to `7e252ba98388ed8be9a7f50efb15ed036a7862d2` through
PR #891. The inspected main changes do not touch FPV runtime, content, build
configuration or package policy. Publish this feature and refresh all seven
native layers together, then require fresh checks. Further operations content
work can continue independently in scratch files during the coordinated refresh.
Unit coverage remains in the final phase; functional verification continues for
every increment. These are development examples, with physical-device and
unfamiliar-player qualification still outstanding.
