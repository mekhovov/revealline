# Relay Rescue / Team — completed and remaining review

Date: 30 September 2026. This is the status companion to the [updated plan](relay-rescue-plan.md). It separates implemented behavior, recorded verification, later design changes and remaining acceptance. It changes documentation only.

## Source and publication boundary

- Implementation audit: `09a43d83351af276f184293ed3c72261575ed8bc`. The subsequent main delta through `60407a7ce4b4592372e66ef1961f3aa85562cefd` concerns landing/native menus and leaves the audited co-op implementation unchanged.
- Package version: `0.142.4`. Latest immutable GitHub release observed: [v0.142.3](https://github.com/mekhovov/revealline/releases/tag/v0.142.3), published 29 September, source `b5ab06e12542f72e33c45b973ba693a5e1509c1c`.
- Continuous Pages [run 36759567741](https://github.com/mekhovov/revealline/actions/runs/36759567741) succeeded for `09a43d833`; the later `60407a7ce` run was in progress at observation. Workflow status is not a new deployed-byte or gameplay audit.
- The user's open v0.52.0 URL is an older immutable edition. Its two-arena gameplay and evidence must not be confused with today's default Team Journey.
- Three independent read-only reviews inspected mechanics, content/progress and evidence. No test suite, build, browser session, physical device session or new human playtest ran in this audit. Test files cited below establish coverage intent, not current passing results. The committed [waiver](focused-test-waiver-20260930.md) leaves deferred tests `WAIVED_SKIPPED_NOT_PASSED`.

## Phase-by-phase assessment

### 1. Baseline and executable specification — historical work delivered

The original couch helper failed when a valid body element had attributes. Its parser and regressions were repaired, the shared capture/recovery/stronghold ordering was documented, and work was isolated from unrelated changes. The baseline is recorded as 69/69 checks in the later phase ledger; the narrower repaired parser/input/encounter set passed 37/37. The recorded phase commit is `7690139d25511a2b6187a16e9c83d6cd8be0cef1` / v0.44.3.

Evidence: [phase 1](verification/relay-rescue/phase-1.md), [phase 2 ledger](verification/relay-rescue/phase-2.md). The earlier phase-1 page was written while its baseline was still running; the later ledger resolves that historical status. References to local exact-source qualification files are historical pointers, not files requalified in this review.

The specification needed maintenance because later Team editions changed several promises. This audit adds explicit edition boundaries rather than rewriting those original decisions as if they had never existed.

### 2. Joint-cut prototype — delivered

The engine has one authoritative shared grid and clock, fixed-step two-player commands, real enemies, individual cuts, active-head Joint Cuts, helpful banking of a partner's trail, a shared result, pause and same-setup Retry. It keeps separate co-op interfaces and rules identities. Earlier hits cannot be erased by a later bank. Captures normalize monotonically and count newly safe cells once. Both returned craft stop and require fresh steering.

The same-arena comparison configurations exist. Historical public-command experiments showed a meaningful route/exposure difference between joint and independent cuts, and real keyboard browser checks exercised joining, territory, pause and retry. Their rehearsed completion times are feasibility evidence, not normal-player speed or proof of enjoyment.

The first v0.45.0 qualification failed one stale lobby-order assertion (105/106). The corrected checkpoint is `761f2afdea4224c29a1cc493b5e4bd1c30991a76` / v0.45.1; the failure remains part of the evidence. Do not restart this phase or claim the failed run passed.

Sources: [core](../game/coop/core.mjs), [input policy](../game/coop/input-policy.mjs), [comparison definitions](../game/coop/relay-yard.mjs), [phase 2 evidence](verification/relay-rescue/phase-2.md).

### 3. Complete cooperation loop — mechanics delivered, experience gate partial

Classic Relay Rescue implements the one-charge Support pulse, active-time refill, unique-territory recharge acceleration, interception and temporary slowing; committed Hunter warnings and harmless recovery; held/contact and capture-based free rescue; shared reserves without interrupting the survivor's trail; and anchor → exposed core → later core capture transactions. Core defeat removes its own emitter/hazards. Valid shared victory restores the downed partner without a mandatory exit gathering.

The user's initial feedback is real evidence: both types were good, the second more enjoyable/challenging, and a horizontal divider permitted uneven easy capture. The revision removed the divider, added comparable mirrored pressure, contested the core region and preserved two reusable level styles. Public-input and single-operator browser retests found viable routes and timing-dependent failures. These observations are recorded in [feedback](verification/relay-rescue/paired-playtest-1.md), [balance revision](verification/relay-rescue/balance-revision.md), [phase 3](verification/relay-rescue/phase-3.md) and [v0.52 integration](verification/relay-rescue/integration-v052.md).

What remains is a structured comparison with actual pairs: each player's useful decisions, cover-role agency, comprehensible hits, rescue choices, failure discussion and desire to retry. The supplied feedback did not record devices, difficulty or separate participant observations, so it does not establish every formal paired criterion. Current Journey rules also change rescue timing and roles; those need their own evaluation.

### 4. Campaign and replay — substantial successor work, original scope incomplete

There are two different inventories:

| Content family         | Implemented content                                                                                                                                                              | What it does not prove                                                                                                                                   |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Classic built-ins      | First Connection and Relay Yard; three difficulties and three comparison styles; coverage/stronghold recipe templates.                                                           | The remaining original named missions and one authored remix for each are not present as that six-mission campaign.                                      |
| Current Team Journey   | Default `team-cultural-specialist-originals-2`: 12 missions in three four-mission arcs, with distinct return/material/chamber decisions and versioned cultural-route successors. | Twelve coverage missions are not the original six missions plus six authored remixes. Historical editions are separate preserved rule/content revisions. |
| Creator/installed Team | Bounded recipes, preview/review/approve/install/export paths, owned media and replay-backed qualification/continuation.                                                          | Authoring capability does not count as finished authored missions or prove a campaign's balance.                                                         |

The current sequence is **Twin landings, Stepping exchange, Divided workshop, Switchback partners, Shared detour, Crossed gardens, Split orchards, Weaver crossing, Shared lookout, Twin depots, Changing courtyard and Last rendezvous**. It develops shared returns, material work and changing common ground. Similar orchard or crossing names do not make these maps the original promised missions.

| Original mission | Implemented contribution                                       | Remaining original obligation                                                        |
| ---------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| First Connection | The classic coverage arena teaches individual and shared cuts. | Its authored remix and complete variant/preset acceptance remain unestablished.      |
| Forked Orchard   | Successor maps provide route/material choices.                 | No separately identified original Forked Orchard plus remix acceptance.              |
| Crosswind Yard   | Hunters have warning/commit/recovery and emitters warn.        | The authored alternating-lane mission and its marked-approach encounter composition. |
| Twin Relays      | Relay Yard demonstrates one complete two-anchor stronghold.    | The planned two-stronghold mission, overlapping approaches and remix.                |
| Rescue Run       | Classic has contact, capture and reserve recovery mechanics.   | A purpose-built rescue-choice mission with detours/beacons and tuned travel windows. |
| Warden's Ring    | Shared cutting and stronghold primitives exist.                | The Warden, three-sector encounter composition, authored mission and remix.          |

The actual default is declared in [default-entry.mjs](../game/content-design/default-entry.mjs), including in the v0.142.3 source. The [classic library](../game/coop/library.mjs), [Team runtime adapter](../game/content-design/team-runtime.mjs), [cultural successor record](team-cultural-specialist-routes-v2.md) and [authoring guide](../authoring/coop/README.md) explain the separate inventories. Some dated design documents still name earlier defaults; source identity wins for current inventory.

The newer Team route adapter creates coverage goals and does not carry the original required-core mission objectives. Modern bonus/impact/specialist rules reject stronghold content. Therefore the original promise to end later missions as soon as their cores fall, avoiding coverage cleanup, remains an unmet campaign obligation unless explicitly replaced. The planned marked-lane Sentry and multi-sector Warden are also absent from the co-op actor validator; existing stronghold emitters are a narrower implemented threat.

Progress has advanced beyond the prototype, but is not the full promised feature set:

- Journey has edition-specific bookmarks, clear/picture receipts, sequence/Next and export with visible storage-failure recovery. The current clear record is one latest receipt per mission, carrying difficulty; it is not a separate best record for each difficulty or a team medal system.
- Journey progression allows deliberate mission selection/skips. It does not implement the original locked six-mission advancement scheme.
- The Journey progress adapter exposes export, but no corresponding complete import/restore flow was found. A one-way export is not qualified backup and restore.
- Installed Creator Team has a separate versioned store, generation conflict detection and replay-validated checkpoints, including resumable attempts. This intentionally exceeds the original no-mid-mission-persistence boundary for that content family.
- Atomic storage and generation conflict checks are useful, but the original one-active-writer lease for all co-op progress is not established. The Journey adapter does not supply such a lease to its profile store.

Review points: [Team progress](../game/content-design/team-progress.mjs), [Journey profile](../game/journey/profile.mjs), [Team host](../game/couch/relay-rescue.mjs), [Creator Team](../game/creator/team.mjs). Keep record identity, storage failure, corrupt import, old-edition restoration and concurrent-tab cases separate in the next implementation slice.

The old matrix was **6 missions × 2 authored variants × 3 difficulties = 36**. Newer evidence about **12 missions × 3 difficulties = 36** is a different inventory. Neither a matching count nor a manifest check establishes full playable completion and balance for every combination.

### 5. Player experience and balance — many delivered improvements, incomplete acceptance

Implemented source includes shared display/settings preferences, compact quick start, a unified mission library, exact-edition continuation, one-action Next, deliberate Retry, picture preparation/failure recovery, shared pictures/rewards, English/Ukrainian copy, contextual cut/Support/rescue teaching, input release and held-Support handling. Specialist effects have text/shape cues; numbering and distinct craft/trail cues supplement color. Recent fixes preserve downed-player guidance after Resume. The old plan's statement that Plain/Large preferences are not loaded is a historical limitation, not today's implementation state.

Evidence is distributed across [player-first delivery](player-first-ux-execution.md), [specialist cues](team-specialist-cues.md), [couch continuation history](couch-team-delivery.md), [current reconciliation](plan-status-2026-09-30.md) and the linked source/test files. Those records contain bounded source or browser observations, not universal device acceptance.

Open work includes complete sustained Team journeys on the chosen current edition; warning/actor readability in dense states; narrow-screen and zoom comfort; controller replacement and mixed input; simultaneous real touch; pause/focus/lifecycle behavior; audible feedback/listening; offline continuation; and mixed-skill cooperation. Keyboard and viewport emulation do not certify physical devices. Having distinct specialists does not by itself prove that both roles are interesting.

### 6. Release qualification — historical deliveries exist, final programme open

v0.52.0 delivered the revised classic experience, and many later releases incorporated Team improvements. The latest immutable source inspected already includes the twelve-mission default. This is substantial released work, not an unreleased prototype.

There is no evidence in this audit for closing the entire original plan on current main. Historical source/build/public/browser results remain bound to their exact revisions and scopes. The current automated-test waiver is explicitly not a pass. Final acceptance still needs the chosen content/rules inventory, required source/build/admission gates, exact artifact and deployed-byte identity, affected real browser journeys, offline/lifecycle/regression checks, and the outstanding human/device record. The single publisher owns version allocation and release; this documentation change does not create a new game release.

## Mechanics that need an explicit design decision

| Topic             | Classic original behavior                                                   | Current successor behavior                                                                         | Why the plan must distinguish it                                                                                                                                              |
| ----------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rescue timing     | 16/12/10-second window; 5/3/1 reserves; direct rescue takes one second.     | 0.65-second auto-recovery; 4/2/1 reserves plus the active life.                                    | With reserves available, manual rescue cannot complete before auto-spend. Restore/adapt the meaningful rescue choice in a new identity if that remains a product requirement. |
| Support ownership | Both seats can slow enemies and intercept impacts.                          | Interceptor clears impacts; Disruptor slows enemies.                                               | This introduces fixed complementary duties. Preserve hybrid compatibility and compare each role's agency; do not claim equal tools.                                           |
| Victory           | Coverage in the first arena; required core capture in the stronghold arena. | Twelve default coverage goals.                                                                     | The original no-cleanup promise for later missions is not fulfilled by more coverage maps.                                                                                    |
| Safe ground       | Connected secured routes support recovery.                                  | Edition-gated roamers can threaten claimed ground after a warning; terrain/return topology varies. | Claimed territory may not be universally safe. Teaching and rescue-path analysis must follow actual edition rules.                                                            |
| Exact impact ties | Historical lethal contacts invalidate closure first.                        | Impact-v2 gives valid closure priority over an exactly coincident travelling-impact arrival.       | Preserve earlier-hit precedence and test the named edition rather than one blanket rule.                                                                                      |

Both current rule families also refine the original teamwork-credit rule: a credited join needs at least 2% new playable area and at least four new exposed trail cells from each craft. Small joins remain legal without that special credit. This is shared behavior, not a Classic-versus-Journey distinction.

Sources: [core](../game/coop/core.mjs), [threats](../game/coop/threats.mjs), [foundations](../game/coop/foundations.mjs), [roamers](../game/coop/roamers.mjs), [difficulty catalog](../game/content-design/catalogs.mjs). Preserve immutable historical identities when changing any of these contracts.

## Updated remaining work and closing evidence

| Priority / phase           | Concrete next delivery                                                                                                                                                                                                                                 | Evidence needed to close it                                                                                                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 / P3–P4                  | Reconcile the rescue experience, hybrid/specialist choice and coverage/core goals per edition. Keep original unfulfilled promises visible; record any deliberate replacement before implementation.                                                    | A rule/content matrix with named identities, compatibility cases, clear player-facing descriptions and a measurable helping decision in the chosen design.                                                  |
| 2 / P3–P5                  | Complete full-run challenge routes for current Team, including complementary play, both assignments, pressure/recovery and difficult returns. Investigate unattended easy regions and cleanup; tune geography/warnings/opportunities before raw speed. | Reproducible public-command logs with seed/preset/edition, full clear/failure outcomes, downs/reserves/Support and actual helping events; compare with and without relevant support. Preserve failures.     |
| 3 / P4                     | Finish separately scoped records/medals, backup restore and writer/concurrency contracts; preserve independent solo, Versus and older Team identities.                                                                                                 | Round-trip and malformed/incompatible restore behavior; interruption/storage-failure recovery; no fabricated awards; exact multi-tab ownership semantics. Current export alone is insufficient.             |
| 4 / P4                     | Resolve the original six-mission/remix obligation. If retained, implement missing encounters and authored objectives in bounded mission slices rather than relabeling successor maps.                                                                  | Explicit six-by-two-by-three inventory, reachable objectives/rescue paths and complete feasible routes. If replaced, a documented scope decision and equivalent acceptance inventory.                       |
| 5 / P5–P6                  | Finish coherent warnings/teaching and cumulative current-edition journey, performance, accessibility, offline and real-input checks.                                                                                                                   | Exact source/artifact, sustained browser play, failure/Retry/Next, pause/disconnect/focus, cold/offline continuation and separately recorded physical devices.                                              |
| 6 / P3, P5, P6 human gates | Run the structured paired comparison and mixed-skill sessions scheduled as C2 in the broader programme.                                                                                                                                                | Actual participants, introduced mechanics, attempts/order and per-player observations about agency, help, fairness, waiting/blame and voluntary retry. No equal-capture quota or invented retention metric. |

The programme's later order puts formal C2 comparison after implementation. Content has also expanded beyond the original first-pair gate. These are separate observed facts; this audit does not establish that the original co-op gate passed or was waived. Retain the initial user feedback and evaluate current rule changes with actual players when sessions occur. No completion date is inferred without participants/devices or a decided campaign scope.

Each bounded implementation delivery follows research of its actual uncertainty → change → independent review → fixes → affected verification → related-hunk commit → coordinated version/release evidence. Preserve playable comparisons. The remaining task is not to repeatedly rebuild the already working prototype; it is to resolve the edition differences and close the specific content, persistence and qualification gaps above.

## Review of this documentation change

Independent mechanics, campaign/progress and evidence reviews agree on the phase distinctions above. Review corrected three misleading implications: hybrid/specialist variants are preserved editions rather than an assumed new per-run selector, the wider C2 schedule does not prove a waiver of the original co-op paired gate, and the four-cell teamwork contribution rule applies to both current rule families. Local documentation links were checked against the audited Git tree; Markdown formatting and whitespace checks apply only to these documents. No gameplay evidence was generated or upgraded by this review.
