# FPV continuous feature delivery

Updated 2026-10-01. The owner requests a verified PR after each completed feature,
with the next independent item developed while source gates and deployment run.
Additional unit coverage belongs in the final phase. Build, browser, replay,
import/export and publication verification remain part of every applicable item.

## Delivery queue

| Item                                             | Branch / PR                                                                                      | Current state                                                                                                                               | Acceptance                                                                                                                                       |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| World Studio development playtest                | `codex/fpv-world-framework`, [PR #885](https://github.com/mekhovov/revealline/pull/885)          | Completed; native stack layer 1                                                                                                             | Recorded browser/build/offline evidence in `fpv-worlds-playtest-verification.json`; protected merge and actual deployed launch remain required   |
| Academy demonstrations and beginner entry        | `codex/fpv-academy-demonstrations`, [PR #887](https://github.com/mekhovov/revealline/pull/887)   | Completed; native stack layer 2                                                                                                             | 24 existing demonstrations, half-speed and replay controls; browser/offline evidence in `fpv-academy-demonstrations-verification.json`           |
| Woodland demonstrations                          | `codex/fpv-woodland-demonstrations`, [PR #888](https://github.com/mekhovov/revealline/pull/888)  | Completed; native stack layer 3                                                                                                             | Eight challenges × two modes; all 16 actual recordings complete in Node and Chromium without contacts; route-facing presentation reviewed        |
| Courtyard demonstrations                         | `codex/fpv-courtyard-demonstrations`, [PR #890](https://github.com/mekhovov/revealline/pull/890) | Completed; native stack layer 4                                                                                                             | Eight challenges × two modes; all 16 recordings complete without contacts; offline, localization and route-facing playback verified              |
| Live sector timing and personal-best comparisons | `codex/fpv-sector-deltas`                                                                        | In development above courtyard                                                                                                              | Tick-accurate sector timing, replay-verified compatible reference frozen per attempt, interrupted-flight restoration and readable EN/UK feedback |
| Remaining new-world demonstrations               | Warehouse, stadium, container yard, garage; separate coherent PRs                                | Warehouse and stadium recordings prepared outside the tracked feature branch; browser/integration verification pending; later worlds queued | Author and replay successful recordings with exact dependencies; only offer actually verified demonstrations                                     |
| World/drone presentation and player tuning       | Subsequent bounded feature PRs                                                                   | Queued                                                                                                                                      | Improve remaining art/animation/readability and mode-specific thresholds using actual player observations; keep flight handling unchanged        |
| Final qualification                              | Final phase                                                                                      | Deferred                                                                                                                                    | Additional unit coverage, full compatibility/failure matrix, named physical-device performance and human content acceptance                      |

The approved scope and production limits remain in
[`fpv-worlds-implementation.md`](fpv-worlds-implementation.md). The current 60
challenge definitions do not represent 60 fully polished, human-qualified levels.

## Publication procedure

The FPV PRs are now linked as **native GitHub stack #889**, rooted on `main`.
The existing layers are #885 → #887 → #888 → #890. New dependent items append above the
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

Live application: <https://mekhovov.github.io/revealline/optional-practice/fpv-worlds/index.html>.
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

No FPV live deployment has been verified yet. Sector timing development continues
on its own branch while the completed layers qualify. Warehouse and stadium
recordings are prepared independently; their integration, final package and
browser/offline qualification belong in separate PRs. Native stack membership is
not a merge or deployment confirmation.
PR #885 is open at `882c96622a9c52cb93bf94f642aba1ae4fb926c4`;
[required source run 36783706645](https://github.com/mekhovov/revealline/actions/runs/36783706645)
is pending. It has no review/label holds and is mergeable once its current gate
passes. Main was `c30135d80abe79c9fef88b67c8629c0725db58cc` at this checkpoint.
Two safe expected-head updates incorporated intervening main commits. Leave the
current CI running; do not repeatedly restart it for unchanged status. Re-read
the actual remote state before any merge.

The former predecessor-only chain is now native stack **#889**. The earlier
head/run checkpoint above is historical; always read current stack heads before
acting. No FPV live deployment has been verified yet. Development continues
independently while the native layers qualify.

## Radio priority and current delivery state — 1 October

The checkpoints above are historical. PRs #885, #887, #888 and #890 have now
merged through protected native request `809d5f63-5f6f-426d-a950-9be08a730d92`,
producing main `ff1f6d1a9b4d38dc77605c0a2156a1a27747901a`. Native stack #889
still contains #892 (sector timing), #894 (Warehouse), #895 (Stadium) and #896
(Container Yard). Inspect current remote heads before further publication.

The user's immediate radio issue takes priority. Branch `codex/fpv-radio-worlds`
restores verified radios in both FPV runtimes, provides visible calibrated sticks,
preserves pause/reconnect pickup and offers compact/expanded/setup-only displays
in World Studio. The owner confirmed physical TX15 flight. Functional browser
verification covers all 60 challenges in both modes and alternate entry points;
see `fpv-radio-worlds.md` and its verification receipt. Publish this focused fix
independently of the pending demonstration stack.

Public FPV availability remains blocked: Pages run 36788512997 exceeded the
950,000,000-byte guard by 7,359,524 bytes. The preceding site had only 30,248 bytes
of headroom. Preserve the guard and all retained player content; investigate a
reviewed lossless packaging change rather than dropping assets or raising limits.
Local playtest availability and an open/merged PR are not public deployment.
The read-only size audit in `/tmp/fpv-pages-size-audit.json` identified a viable
follow-up: bounded, versioned gzip transport for retained JSON packs, with separate
transport/canonical hashes and unchanged decoded identities. Eight large core
packs save 23,181,525 bytes in byte-exact round trips. Loaders, downloads and
offline metadata need coordinated implementation and verification; do not replace
existing JSON bodies with gzip bytes or delete retained packs.

Further content-stack merges remain held for a confirmed creator reimport defect:
identical reimport can erase a local obstacle, reordered spawn anchors can move
the spawn and semantic actor/gate edits can be omitted. After radio publication,
prioritize transactional draft preservation and explicit diagnostics, then the
prepared Garage demonstrations and verified local ghost. Reproduction and staged
feature handoffs are retained in `/tmp/fpv-reimport-data-loss-20261001/`,
`/tmp/fpv-operations-readable-20261001/garage/` and the sparse worktree
`/tmp/fpv-local-ghost-20261001` (commit `a4bff27e3429d1da9a24a6f2772baf6c7ec80836`).
Do not discard these unpublished artifacts or disturb active agent work.

### Guided radio setup and fullscreen follow-up

The owner next requested a player-friendly calibration screen and immersive flight
in every level. Branch `codex/fpv-radio-setup-ux` is based on radio fix #899 and
contains that focused follow-up. Known profiles open on a live confirmation;
unknown devices get directed calibration, with advanced tools behind disclosures.
Both simulators share native fullscreen and an explicit full-window fallback.
See `fpv-radio-setup-ux.md` for the design references and verification receipt.

Published as PR **#901** against `codex/fpv-radio-worlds`, in separate native
stack **#902** with members **#899 → #901**. Existing content stack #889 stays
held for reimport correction. Parent #899 received a main merge and the additional
USB-disconnect isolation fix at `dc85a3bda021`; this feature was rebased onto that
head without rewriting the concurrently updated parent. Refresh current heads
before publication or any coordinated history change. Continue preserving prepared Garage
and local-ghost work while the publication-size repair and reimport correction
receive their own verified increments. Additional unit coverage stays in the
final phase; functional checks remain required throughout.

Final local artifacts: `dist/fpv-radio-setup-playtest` SHA-256
`d0615fa3f3929f8a979c3fb0945b2b1ac13093ee7d55b90a1c497c2be60a3faf`
and the preserved 88-demonstration `dist/fpv-stadium-demo-playtest` SHA-256
`7eaf181a223727d4071ccd26a9a909e046a9ab9c045326b790760cac622e805a`.
Known and unfamiliar radio calibration, advanced-capture transitions, fullscreen
entry points, mobile EN/UK layouts, offline flow and non-radio disconnect isolation
passed browser verification. See the committed verification receipt for scope and
intermediate/final build identities. Required GitHub checks and protected stack
publication continue asynchronously; Pages run 36790807793 also failed, so public
availability still requires the separately tracked site-size repair and a verified
deployment. Preserve stack protection and coordinate any necessary linear rebase
with current parent work, recovery refs and explicit remote-head leases.
