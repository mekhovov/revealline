# Character and player-experience delivery — 29 September 2026

This is the current status register. It supersedes queue/status estimates in
[28 September](plan-status-2026-09-28.md), without rewriting historical evidence.
The user has now approved **A → B → C → remaining work**:
current characters and reliable play first, optional encounter variety second,
one finished Ukrainian/FPV artwork cohort third. Necessary authoring and checks
travel with their feature; broad tooling and additional editions follow later.
**C2's formal human/game-feel study remains last.** This supersedes equal-priority
C3/C4/C5/C6 expansion. The [active plan](character-game-feel-plan.md) retains its
compatibility, artwork and release requirements.

## Public and queued

- Latest observed main is `6a67d6dbfe01d5e1f3842b5a79dd5d5ddeefcfd8`.
  Public `release.json` declares **v0.142.3**, source
  `b5ab06e12542f72e33c45b973ba693a5e1509c1c`, distribution prefix
  `37eca33f…`. This is an observed public release identity; the canonical
  publisher's acceptance and byte-audit closure remain unresolved. Do not report
  it as accepted. Earlier v0.142.2 deployment and 2,240-file/zero-failure audit
  evidence keeps its original scope and does not qualify these newer bytes.
  Do not allocate versions or start another publisher from this branch.
- [PR761](https://github.com/mekhovov/revealline/pull/761) is a draft source batch,
  not a public release. Batch15 is pushed at
  `c332a45cb38af3d62b2b73fbd37087d93389c8c0`, with 127 focused checks,
  all-seven playable roster review, retained class setup and exact optional
  candidate loading. It is a **v0.150.0 scheduled input**; its source version is
  unbumped and production admission remains pending. See its scoped evidence below.
  It conflicts with newer main and needs publisher-owned reconciliation.
  Do not rebase the shared worker branch or allocate a competing version.
- Parallel [PR757](https://github.com/mekhovov/revealline/pull/757) is reconciled on
  `6a67d6dbfe01d5e1f3842b5a79dd5d5ddeefcfd8`: More collapses, Large canvas
  labels remain readable, resumed downed pilots receive rescue advice, and
  Support becomes learned only after an actual effect. Combined checks pass
  **112/112**, plus **9/9** complete display-host tests and two source-closure
  checks. The inherited controller-fixture failure was reproduced and corrected
  by using a fresh controller press; all behavior assertions remain. Browser
  review covers 1280×800, 390×844, 844×390 and 568×320 CSS, both existing arenas,
  Large/Plain and EN/UK. The board/target bounds pass in those observations, but
  Ukrainian HUD/ability wrapping at narrow sizes remains an explicit next A3
  defect. Team/equipment source closures reopen; production/public acceptance
  remains pending. See the [batch evidence](https://github.com/mekhovov/revealline/blob/codex/team-more-navigation/docs/verification/team-readability-20260929/README.md).
- [PR786](https://github.com/mekhovov/revealline/pull/786) preserves 158 sources
  across 162 additions as another v0.150.0 input; those additions are not live.
  [PR787](https://github.com/mekhovov/revealline/pull/787) preserves optional CI
  tooling on hold, with no CI activation.
- Compatible features continue in one PR, with separate evidence and reversible
  commits. The fixed publisher batch is not expanded while it qualifies.

## Completed work to preserve

The accepted cumulative player foundation includes direct Journey entry, compact
Home/Pause/Couch entry, mission browsing, Collection rewards, retained originals
and continuation, plus localization, audio, offline and creator foundations.
These are scoped deliveries, not acceptance of every original UX or production
requirement. Follow the earlier registers for exact public evidence.

In PR761, already implemented and focused-tested:

- Shared rotor sampling/direction, larger-propeller rigs, seven native FPV body
  candidates, prepared actor/contact presentation and real rendered-frame checks.
- Team intent poses, hunter commitment, freeze-aware presentation and useful
  loss/recovery information; current immutable production approvals stay intact.
- Optional encounter authoring and actual Solo practice, deterministic/replay
  coverage, pressure guidance and global cosmetic-remains settings.
- Rotor and non-rotor editing, exact source packet provenance/treatment,
  native artwork import/preparation/export and separately preserved originals.
- Workshop, Poltava and Synevyr original source candidates. Revision 7 adds a
  native 1152×576 derivative of the corrected Poltava source; it is a candidate,
  not a new mission binding or a replacement earned original.

Batch 12 addresses three concrete implementation gaps: recovery relocations must
not become apparent flight, optional scouts/sentries need player-facing rule-derived
counterplay, and enlarged moving-part inspection needs independent Idle/Cruise/
Boost/Slow response without moving the arena. See [its evidence](verification/actor-batch-12/README.md)
for failures, corrections, counts, browser scope and remaining acceptance.

Batch 13 extends paused Field details with optional patrol counts, locked warning
time, recovery and separately live projectiles. It preserves running event costs,
missing/disabled output, explicit unavailable states and read-only ownership.
Independent review caught and corrected misleading terminal all-removed copy.
The actual source model/bridge cohort passes 49/49 and the application-host cohort
15/15; native keyboard review returns to the opener while staying paused.
See [batch 13 evidence](verification/actor-batch-13/README.md). This closes that
bounded Details gap, not full Field Guide or human encounter qualification.

The new A-first batch adds an exact-source continuation reader, without a current
approval or production caller. Its **27/27** focused checks authenticate nine
real immutable ancestors using synthetic successor manifests, reject altered
inputs and keep group subsets independent. This prepares A1 adoption; the existing
production review gap remains open. See [batch 14](verification/actor-batch-14/README.md).

## Remaining work and planning ranges

Ranges are effort after each item starts, not publication promises. Necessary
prerequisites and independent review may run concurrently. Reconciliation,
failed gates and publisher availability add delivery time.

| Order                                | Work and player benefit                                                                                  | Completion boundary                                                                                                                                                                       | Effort range                                                                                           |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **A1 — first**                       | Deliver already implemented character/control corrections so players actually receive the improvements   | Reconcile the smallest renderer slice; review 59 renderer/equipment successors while keeping approved imagery and app/audio unchanged; final build, immutable publication and public play | Estimate after the exact port is scoped; publisher waiting time is separate from implementation effort |
| **A2 — current characters**          | Convincing player/common-enemy bodies, propellers, scale, facing and reactions across Solo/Versus/Team   | Current roster/state review and reviewed native-body adoption; retained originals and core behavior unchanged                                                                             | 3–5 days for remaining C3 scope; existing fixes do not need to wait for the whole roster               |
| **A3 — reliable play**               | Deliver the prepared Team fixes and reflow the demonstrated narrow Ukrainian HUD/ability labels          | Fresh input, retained recovery, exact return, readable status and full board/control bounds; reuse PR757 and existing inputs                                                              | Team source batch prepared; next bounded layout correction ½–1 day, then integrated release gates      |
| **B — encounter variety**            | Optional pursuit/interception/patrol/sentry encounters teach distinct decisions and readable counterplay | Finish Field Guide/cross-mode guidance, full missions/combinations, difficulty/fairness/replay qualification; preserve original editions                                                  | 3–5 days                                                                                               |
| **C — one finished cohort**          | Complete a coherent Ukrainian/FPV artwork set that players can actually select and play                  | Native pixel/cultural/contrast review, exact approved mission bindings, retained ownership and complete preview/runtime presentation                                                      | 2–4 days for the first accepted cohort                                                                 |
| **Supporting C0/C1/C6**              | Only the rig, source coverage and Studio changes required to deliver A/B/C                               | Bounded geometry, state, history, resource and real import/edit/export checks alongside the consuming feature                                                                             | Included per slice; broader C6 2–3 days later                                                          |
| **Rest — further cohorts and tools** | DroneAid and other communities, broader authoring workflow, offline/history and guide closure            | Separate reviewed cohort and workflow acceptance; no bulk production added before the priority work                                                                                       | 2–4 days per cohort; refine wider scope from accepted inventory                                        |
| **C7 / UX6**                         | Whole-content and player-journey reliability                                                             | Every current binding; terrain/equipment/effects, offline/performance/accessibility and device checks                                                                                     | 4–7 days plus devices                                                                                  |
| **C2 — last**                        | Formal game-feel comparison and directional human feedback                                               | Three missions, audio/haptics comparison, two consented rounds with six players                                                                                                           | 2–3 days plus participants/listening                                                                   |

A is not a dependency on shipping every new sprite before B can be prepared.
Finish bounded A corrections first; independent B/C references or test preparation
may continue when they do not displace A. Do not expand comparison tools or broad
new artwork while current-character delivery still needs this work.

The wider programme still includes complete map/theme consistency, campaign-specific
offline dependencies, backup/history recovery, community production and independently
reproduced guidance. The source inventory of 91 Solo / 91 Versus / 12 Team Journey
entries is not proof of the separate 132-new-mission production target, all balance
configurations or full physical-device qualification. No new bulk mission production
is added to this bounded actor batch.

Batch15 now closes the tool limitation that only Scout could reach the real
board: all seven V6 bodies are selectable in the existing three missions, with
actual class setup and retained Retry. Its 127 focused checks and bounded native
loading/Carrier play/layout observations are [recorded here](verification/actor-batch-15/README.md).
The inactive Boost control was corrected from the missions’ actual Arcade policy.
Native-body approval, full-state review and production admission remain open; this
is A2 preparation, not completion of A or the deferred C2 human study.

## Blockers and concerns

1. **Release integration:** PR761 is a conflicting v0.150.0 scheduled input,
   with no source version bump or completed production admission. Scheduling is
   not delivery. One owner must reconcile it onto the publisher's chosen current
   main and qualify the exact integrated source. Public v0.142.3 identity alone
   does not settle the publisher's pending acceptance/audit.
2. **Production review:** the retained 6-pass/2-fail guard stops at Team and is
   not a complete mismatch inventory. The historical full-worker audit identifies
   **67 slots**: motion 7, effects 10, Team 37, equipment 5 and separately reviewed
   audio 8; UI/screens matched at that checkpoint. The minimal A1 renderer slice
   targets **59 slots** if current-main app/audio sources remain unchanged.
   Keep approved PNGs and the independent fpv62 actor lease; native candidates
   and their eventual adoption stay separate. Recalculate on the integrated
   source, including parallel Team changes. Current production100's effects20
   predecessor is newer than batch14's pinned 27 September bulk record, so the
   helper needs explicit current-predecessor support before production wiring.
   Preserve main's newer effects routing, every production100 predecessor and
   the worker's historical fpv93 evidence. The matcher must complement original
   Team recipe/default/image and equipment PNG guards, never replace them.
   Append only exact reviewed successors; never edit old fingerprints or weaken
   assertions. See [adoption requirements](actor-presentation-adoption.md) and
   the [historical audit](verification/actor-batch-13/production-adoption-audit.md).
3. **Artwork quality:** generated cultural scenes remain candidates. Native
   export and valid hashes establish preparation, not consistent pixel clusters,
   museum accuracy, composition over gameplay, permission or production approval.
4. **Local capacity:** a fresh 29 September `df -h .` observation reports **7.1GiB
   available**, above the publisher's previously recorded 1,275,068,416-byte
   reserve. The earlier batch15 low of ~110MB remains historical evidence, not a
   current capacity blocker. Recheck before heavy builds, downloads or release
   materialization; this space observation is not publisher admission. Preserve
   all existing evidence and user files.
5. **Evidence limits:** long suites are waived under the committed temporary
   policy, not passed. Browser keyboard/layout and modeled controllers are not
   physical touch/controller, listening, whole-game offline or human fairness checks.

No publisher wait blocks source development. A failed check blocks only the affected
feature's acceptance. Each compatible batch must still pass applicable source,
provenance, focused and build checks; publication then requires immutable freeze,
archive admission, Pages byte identity and ordinary public play. Report publicly
accepted, queued, candidate and unfinished work separately.
