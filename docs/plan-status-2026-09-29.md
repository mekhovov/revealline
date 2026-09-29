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

## Production review deferred; implementation continues

The latest explicit user instruction defers production review. It does not grant
production approval or waive basic correctness and artifact integrity. Continue
A/B/C source slices in parallel inside existing PR757/761; do not wait for visual
admission, device/human sessions or release availability. Keep those checks on the
remaining list as **deferred, not passed**. The canonical publisher owns one
cumulative release after protected integration; no version is allocated here.

The current implementation batch is deliberately narrow:

- **A2/A3:** readable Team field details when dense canvas cue placement cannot
  fit, using the existing Pause/Help reader and a secondary outside-board action.
- **B:** practice and player guidance for the optional scout/sentry and
  pursuit/interception roles already in a selected mission; preserve its rules,
  craft and no-award practice boundary.
- **C/C6:** optional selected-versus-retained-parent artwork comparison with
  native-pixel inspection and exact identity/byte preservation.

These three bounded source slices are now implemented and checked. Team passes
163/163 adjacent renderer/host checks; encounter Guide passes 69/69 focused
checks; artwork comparison passes 28/28. Browser UI verified dense Team reader
entry/reflow and retained-parent artwork inspection. The [batch16 receipt](verification/actor-batch-16/README.md)
records source behavior, corrected fixture failures and limitations. These results
do not complete A/B/C or grant production/public acceptance.

## Next implementation batch

The following source slices now extend the previous work without waiting for
production review: Versus per-board optional encounter Help (17/17 focused),
Team edition-specific two-front impact guidance (25/25), and exact selected
artwork file handoff (38/38). See [batch17](verification/actor-batch-17/README.md).
The native Studio handoff retained the expected downloaded image hash. Broader
Versus input tests include reproduced baseline failures, not a blanket pass.
The valid imported Team Hunter Start incompatibility is now corrected in
PR757 at `29f899e23ac556dd623a02df401adbea151fc087`, adopting the Levels
coordinator's narrow fix. Its composed **54/54** cohort includes actual EN/UK
v6/v7 import → Start → Pause → Help → Back, warned attacks across all presets,
strict schema rejection, frozen output preservation and installed reconstruction.
These overlap previous counts. See [composition evidence](https://github.com/mekhovov/revealline/blob/29f899e23ac556dd623a02df401adbea151fc087/docs/verification/team-hunter-composition-20260929/README.md).
The startup source blocker is resolved; publisher integration, production review
and public qualification remain separate.

## Latest source correction

[Batch18](verification/actor-batch-18/README.md) prevents Field Guide crashes and
unsupported practice launches in custom-theme editions. Illustration and practice
availability are explicit; current-mission edition practice, ordinary lessons,
exact paused state and retained artwork remain intact. Hidden-page image readiness
is reconciled on return. **73/73** focused checks pass with independent source
review and actual shipped EN/UK text verification. The original failing paths are
preserved. This closes the bounded Guide capability defect, not all B teaching or
production acceptance. No new artwork or approval is adopted.

The following [batch20 correction](verification/actor-batch-20/README.md) removes
English fragments from ordinary Ukrainian Guide entries and practice hints.
**45/45** complete Guide checks pass; live language changes preserve the selected
lesson, focus, child identity, handoff and exact paused checkpoint. Independent
review confirms generated-catalog byte identity. This fixes existing player copy,
without expanding the deferred full-translation or production scope.

## Current source handoff — practice recovery and Team cues

- **A3:** PR757 now reaches `541d7fcde298ccddffe3f683698bf890212db766`.
  Target-lock and rescue canvas captions follow EN/UK language, including real
  Hunter warnings and contact-rescue progress. Separate complete cohorts pass
  **67/67** role/bonus cases and **29/29** layout cases. Five old Ukrainian layout
  expectations were corrected to the intended translated label without relaxing
  geometry or cache checks. See [the exact receipt](https://github.com/mekhovov/revealline/blob/541d7fcde298ccddffe3f683698bf890212db766/docs/verification/team-cue-localization-20260929/README.md).
- **B:** [batch21](verification/actor-batch-21/README.md) restores the controller
  Return route when Guide practice fails before readiness. Background focus
  transfer, stale children and held Confirm remain guarded. **117/117** complete
  affected checks pass after independent review and correction.
- **A3 fixture follow-up:** the separate Couch reading file passes **16/16** after
  honoring the existing controller-join echo window and checking actual Help
  visibility. No runtime guard was weakened. The publisher's newer Help hierarchy
  must remain intact during integration.
- These are **implemented and pushed source inputs**, not newly public features.
  The publisher has begun cumulative integration of earlier bounded donors; this
  receipt does not qualify its current composite source or promise a release ETA.

No new artwork, mission, approval or version is introduced. Remaining priorities
are A2 full-roster/state quality, B broader encounter combinations and fair play,
C the first approved cohort, then necessary C6 and cross-content qualification.
Production review and C2 remain deferred; required technical release checks remain.

## Public and queued

- Latest observed main is `321408a3cfd75ae230d760f39fb692503652601a`
  after PR791. This does not requalify the older actor branch.
  Public `release.json` declares **v0.142.3**, source
  `b5ab06e12542f72e33c45b973ba693a5e1509c1c`, distribution prefix
  `37eca33f…`. This is an observed public release identity; the canonical
  publisher's acceptance and byte-audit closure remain unresolved. Do not report
  it as accepted. Earlier v0.142.2 deployment and 2,240-file/zero-failure audit
  evidence keeps its original scope and does not qualify these newer bytes.
  Do not allocate versions or start another publisher from this branch.
- [PR761](https://github.com/mekhovov/revealline/pull/761) is a draft source batch,
  not a public release. The pre-batch head is
  `626cafc7d252375a8cc928e094aff74bb0c5456a`. Retained batch15 has 127 focused checks,
  all-seven playable roster review, retained class setup and exact optional
  candidate loading. It is a **v0.150.0 scheduled input**; its source version is
  unbumped and production admission remains pending. See its scoped evidence below.
  It conflicts with newer main and needs publisher-owned reconciliation.
  Do not rebase the shared worker branch or allocate a competing version.
- Parallel [PR757](https://github.com/mekhovov/revealline/pull/757)'s earlier batch was reconciled on
  `6a67d6dbfe01d5e1f3842b5a79dd5d5ddeefcfd8`: More collapses, Large canvas
  labels remain readable, resumed downed pilots receive rescue advice, and
  Support becomes learned only after an actual effect. Combined checks pass
  **112/112**, plus **9/9** complete display-host tests and two source-closure
  checks. The inherited controller-fixture failure was reproduced and corrected
  by using a fresh controller press; all behavior assertions remain. Browser
  review covers 1280×800, 390×844, 844×390 and 568×320 CSS, both existing arenas,
  Large/Plain and EN/UK. The board/target bounds pass in those observations, but
  Ukrainian HUD/ability wrapping was retained as the next A3 defect and is now
  corrected in the update below. Team/equipment source closures reopen; production/public acceptance
  remains pending. See the [batch evidence](https://github.com/mekhovov/revealline/blob/codex/team-more-navigation/docs/verification/team-readability-20260929/README.md).
- [PR786](https://github.com/mekhovov/revealline/pull/786) preserves 158 sources
  across 162 additions as another v0.150.0 input; those additions are not live.
  [PR787](https://github.com/mekhovov/revealline/pull/787) preserves optional CI
  tooling on hold, with no CI activation.
- Compatible features continue in one PR, with separate evidence and reversible
  commits. The fixed publisher batch is not expanded while it qualifies.
- Current milestone metadata schedules v0.142.4 mission selection, v0.143.0
  soundtrack work, then the v0.150.0 aggregate. The former v0.144–v0.149 inputs
  are already included in v0.142.3; they are not six additional waiting releases.

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

## Current implementation update

A1 now has an exact-main, 17-path integration patch: eight runtime paths,
seven test files and two small fixtures. **152/152 focused checks and 31/31
preservation checks pass** using exact main modules; three new rotor regressions
fail on unchanged main. Syntax, scoped lint, formatting and patch application
checks pass. The patch deliberately preserves newer rendering behavior and
approved image bytes. It does not claim the full older worker is merge-ready.
The [durable handoff](verification/actor-a1-current-main-20260929/README.md)
contains the patch, exact inputs, complete logs, initial harness failures and
reproduction instructions. Remaining A1 work is integrated visual review and
59-slot production admission, then the canonical release gates.

A3's Team layout correction now passes the complete 99/99 host cohort in PR757's
isolated lineage on `64c8b9d8`. Intrinsic HUD rows and separate steering/action
widths retain 44px targets. Real zero-reserve Ukrainian play exposed a second
overflow, corrected with two compact labels while preserving full rescue
instructions. Native checks cover 390×844, 568×320, 844×390 and 1280×800, both
existing arenas, Large/Plain, Standard/theme text, recovery and downed states.
The Support fixture now slows a real moving enemy on the winning step; empty
Support remains unlearned. A further native language-switch defect is corrected
by resolving departure captions live. Its six tests and 20 existing guard tests
pass separately and overlap the host cohort; do not total them as unique tests.
Production review, public acceptance, hardware and broader zoom checks remain
open. See [the updated Team evidence](https://github.com/mekhovov/revealline/blob/codex/team-more-navigation/docs/verification/team-hud-wrap-20260929/README.md).

The subsequent compact Team correction is pushed in PR757 at
`f067823fe8e2f76d061bd45d17b11787fe376a23`: **157/157** focused checks,
bounded cue placement/cache, explicit overflow diagnostics, and native Ukrainian
Large/Plain downed/Pause/Help/rotation observations. The current batch adds the player-facing overflow route with one-action paused
reading and a stable per-attempt action. Its 163-case adjacent cohort and bounded
568×320 / 390×844 browser observations cover that implementation.
See [cue-layout evidence](https://github.com/mekhovov/revealline/blob/f067823fe8e2f76d061bd45d17b11787fe376a23/docs/verification/team-cue-layout-20260929/README.md).

PR761's exact Effects20 predecessor reader passes **32/32** focused checks at
`626cafc7d252375a8cc928e094aff74bb0c5456a`. It accepts only the two immutable
roots and their authenticated ancestry; audio is excluded. This corrects the
preparation gap described by the older 27-case record, and is not a 59-slot
production approval. See [reader evidence](verification/actor-a1-current-main-20260929/predecessor-reader.md).

## Latest bounded source work

- **A3 implemented:** PR757 `f09146837cfcc5191c89e54d7f9afea56b2ef8e9`
  now gives timed enemy-slow pickups the existing Slowed ring/caption, matching
  Support, core movement and the details reader. **70/70** focused rendering/bonus
  checks pass with independent source review; actual collection, expiry, pause,
  freeze, Support overlap and Hunter state cues are covered. Legacy no-bonus draw
  hashes remain unchanged. See [the scoped receipt](https://github.com/mekhovov/revealline/blob/f09146837cfcc5191c89e54d7f9afea56b2ef8e9/docs/verification/team-bonus-slow-cue-20260929/README.md).
  Static edition collection did not run in the sparse checkout; integrated
  source/build/provenance and production review remain open.
- **B implemented:** the existing Sentry detour now passes both complete
  Standard/seed1 practice-host routes (**2/2**). Actual keyboard commands preserve
  historical checkpoints and real exported replay inputs; warning Pause, victory,
  no awards/writes, retained terminal state and deliberate Retry pass. Grid-center
  evades a fired shot; Immediate cancels one warning and ends another by ram.
  The test corrects a post-capture key-gesture mismatch without changing runtime,
  routes or held-input safety. See [batch19](verification/actor-batch-19/README.md).
  Existing 21 core route proofs, this host journey and human fairness remain
  distinct evidence; no new mission is authored.
- **C:** source inspection confirms the existing exact-slot import, separately
  retained board derivative, actual BoardPainter preview and immutable theme
  export path already support the first cohort. Additional comparison/handoff
  tooling is unnecessary. Exact cohort binding choices plus native-grid,
  cultural/contrast and production admission remain deferred; no candidate is
  silently installed. This is a capability finding, not new end-to-end approval.

## Remaining work and planning ranges

Ranges are effort after each item starts, not publication promises. Necessary
prerequisites and independent review may run concurrently. Reconciliation,
failed gates and publisher availability add delivery time. Deferred production
review has no completion ETA until that work resumes; it does not delay the
implementation slices above.

| Order                                | Work and player benefit                                                                                  | Completion boundary                                                                                                                                                                       | Effort range                                                                                      |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **A1 — prepared; review deferred**   | Deliver already implemented character/control corrections so players actually receive the improvements   | Reconcile the smallest renderer slice; review 59 renderer/equipment successors while keeping approved imagery and app/audio unchanged; final build, immutable publication and public play | Exact port prepared; admission/release timing deferred; it does not block B/C source work         |
| **A2 — current characters**          | Convincing player/common-enemy bodies, propellers, scale, facing and reactions across Solo/Versus/Team   | Current roster/state review and reviewed native-body adoption; retained originals and core behavior unchanged                                                                             | 3–5 days for remaining C3 scope; existing fixes do not need to wait for the whole roster          |
| **A3 — reliable play**               | Deliver the prepared Team fixes and reflow the demonstrated narrow Ukrainian HUD/ability labels          | Fresh input, retained recovery, exact return, readable status and full board/control bounds; reuse PR757 and existing inputs                                                              | This correction is source-tested and browser-reviewed; integrated production/release gates remain |
| **B — encounter variety**            | Optional pursuit/interception/patrol/sentry encounters teach distinct decisions and readable counterplay | Finish Field Guide/cross-mode guidance, full missions/combinations, difficulty/fairness/replay qualification; preserve original editions                                                  | 3–5 days                                                                                          |
| **C — one finished cohort**          | Complete a coherent Ukrainian/FPV artwork set that players can actually select and play                  | Native pixel/cultural/contrast review, exact approved mission bindings, retained ownership and complete preview/runtime presentation                                                      | 2–4 days for the first accepted cohort                                                            |
| **Supporting C0/C1/C6**              | Only the rig, source coverage and Studio changes required to deliver A/B/C                               | Bounded geometry, state, history, resource and real import/edit/export checks alongside the consuming feature                                                                             | Included per slice; broader C6 2–3 days later                                                     |
| **Rest — further cohorts and tools** | DroneAid and other communities, broader authoring workflow, offline/history and guide closure            | Separate reviewed cohort and workflow acceptance; no bulk production added before the priority work                                                                                       | 2–4 days per cohort; refine wider scope from accepted inventory                                   |
| **C7 / UX6**                         | Whole-content and player-journey reliability                                                             | Every current binding; terrain/equipment/effects, offline/performance/accessibility and device checks                                                                                     | 4–7 days plus devices                                                                             |
| **C2 — last**                        | Formal game-feel comparison and directional human feedback                                               | Three missions, audio/haptics comparison, two consented rounds with six players                                                                                                           | 2–3 days plus participants/listening                                                              |

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
2. **Deferred production review (not an implementation blocker):** the retained 6-pass/2-fail guard stops at Team and is
   not a complete mismatch inventory. The historical full-worker audit identifies
   **67 slots**: motion 7, effects 10, Team 37, equipment 5 and separately reviewed
   audio 8; UI/screens matched at that checkpoint. The minimal A1 renderer slice
   targets **59 slots** if current-main app/audio sources remain unchanged.
   Keep approved PNGs and the independent fpv62 actor lease; native candidates
   and their eventual adoption stay separate. Recalculate on the integrated
   source, including parallel Team changes. The current Effects20
   predecessor is now supported by the exact immutable reader and its 32-case
   cohort; production wiring/admission remains deferred.
   Preserve main's newer effects routing, every production100 predecessor and
   the worker's historical fpv93 evidence. The matcher must complement original
   Team recipe/default/image and equipment PNG guards, never replace them.
   Append only exact reviewed successors; never edit old fingerprints or weaken
   assertions. See [adoption requirements](actor-presentation-adoption.md) and
   the [historical audit](verification/actor-batch-13/production-adoption-audit.md).
3. **Artwork quality:** generated cultural scenes remain candidates. Native
   export and valid hashes establish preparation, not consistent pixel clusters,
   museum accuracy, composition over gameplay, permission or production approval.
4. **Local capacity:** the latest observation is approximately **3.4GiB free**, above
   the publisher's 1,275,068,416-byte reserve but volatile. Earlier 603MB, 7.1GiB
   and ~110MB observations are historical. Small source/evidence handoffs continue; no local build,
   large download or release materialization is started here. Recheck before
   heavy work and preserve all existing evidence and user files. No cleanup or
   reserve reduction is claimed.
5. **Evidence limits:** long suites are waived under the committed temporary
   policy, not passed. Browser keyboard/layout and modeled controllers are not
   physical touch/controller, listening, whole-game offline or human fairness checks.

No publisher wait blocks source development. A failed check blocks only the affected
feature's acceptance. Each compatible batch must still pass applicable source,
provenance, focused and build checks; publication then requires immutable freeze,
archive admission, Pages byte identity and ordinary public play. Report publicly
accepted, queued, candidate and unfinished work separately.
