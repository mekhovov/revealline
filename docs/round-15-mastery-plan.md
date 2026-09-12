# Round 15 — optional equipment mastery and a two-stage sentinel

Status: implementation design only, based on source after frozen `v0.4.1`. No new mastery or staged-boss behavior is implemented by this document. The bounded next increment is **three optional Homeward equipment badges and one separate two-stage boss encounter**, followed by compatibility and browser checks. Keep all current campaigns, maps, progression, controls and frozen releases playable.

## Current behavior and the gap

| Area | Actual implementation | Consequence for this increment |
|---|---|---|
| Victory | `core/index.mjs` completes after `commitCapture` when coverage and every required objective pass. | A new boss needs an explicit completion condition; a caption alone cannot enforce its stages. |
| Boss | `lane-boss` selects a player-aligned horizontal **or** vertical lane, warns, activates, then idles. It has no shield objective, stage transition, defeat or vulnerability state. | Preserve this enemy exactly. Add a new opt-in type instead of reinterpreting old `lane-boss` data. |
| Territory | `core/capture.mjs` retains regions containing every non-patrol enemy center. | A stationary sentinel can protect its core during stage 1 and stop retaining its region during a stage-2 vulnerability window. |
| Equipment | Fiber resistance; supply-dependent fields; hangar switching; impact abort/redeploy; shield and scan are real. Fields suppress emitter centers and can stun a lane boss. | Reuse existing actions and deterministic facts. Do not infer real-world performance from the names. |
| Progress | `progress.mjs` stores clear/time/medal/clean statistics and per-setup variants; five broad achievements and cosmetic groups exist. | Add optional equipment badges separately. Existing medals remain their current time/clean criteria. |
| Evidence | Homeward has six role clears, 42 all-class ordinary clears and four omission comparisons; Fieldcraft has 70 attempts. | Reuse these records for the first mastery predicates. Create new input proofs for the new boss rather than relabeling an old clear. |
| Replay/identity | One exported `RULESET = xonix-core.v2`; replay v3; fixed `fnv1a64-state-v2` projection. Campaign keys include this global ruleset and normalized levels. | A global version replacement would change **every campaign identity**, reject old replays and break awards. Compatibility must be explicit. |

The player should be able to see the next required objective and review optional goals at any time. That follows Microsoft's [objective clarity guidance](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/109). Pair the boss's visual warning with a short sound cue and readable state text; neither audio nor color alone may carry the instruction, following [additional cue guidance](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/103). Keep threat silhouettes and lane boundaries legible against detailed backgrounds, informed by Riot's [gameplay-clarity discussion](https://www.riotgames.com/en/news/valorant-shaders-and-gameplay-clarity). These sources guide presentation; they do not validate our timing or prove enjoyment.

## A. Optional mastery that preserves existing physics

Ship one badge for each Homeward map. Show a single optional goal beneath the mission brief, its live checklist in the pause panel, and an earned seal on the result/gallery. Continue to the next picture remains the primary action; **Retry for equipment mastery** is secondary. Missing a badge never locks a level, removes a medal, lowers a score or takes away a picture. Initial rewards are named collectible seals; leave power upgrades, currencies and new cosmetic models out of this increment.

| Badge | Single winning attempt must demonstrate | Existing positive/control evidence |
|---|---|---|
| Steady Signal — Copper Orchard | Close a cut that traversed at least eight distinct cells in `broad-band` while the active recipe had signal resistance; finish with no lost lives. | Fiber's route enters interference for 489 ticks. The interceptor counterpart completes but has no resistance, so it must not earn the seal. |
| Supply Line — River Switchyard | Refill at both named pads, cross at least two distinct cells of each named emitter region while suppressed, switch to Heavy carrier at `south-hangar`, then win. | Role route has two pickups, two fields, two crossed suppressed regions and a real class change. Action-omission input has no successful suppressed crossing. Ordinary no-equipment victory remains valid. |
| Safe Return — Home Beacon | Use impact while a live trail has at least three cells, affect the named threatening actor with that pulse, recover and win without a lost life. | The positive route aborts a live cut and stuns the actor for 360 ticks. Omission causes an actual cable failure. The badge says “recover cleanly,” not “prove the pulse saved your life”; counterfactual causation belongs to the test, not the live criterion. |

Thresholds above are initial definitions to verify against actual route samples before committing the definitions. They replace elapsed-time farming: stationary dwell, repeated pad button presses while full, arbitrary action presses, visits on safe ground for Steady Signal, rejected switches and failed cuts do not count. For the resistant-cut criterion, buffer distinct cells for the current cut and commit them only on `cut.closed`; discard them on failure or redeployment. All clauses must be satisfied by one completed run; do not assemble a badge from fragments of different failed attempts.

### Definition and telemetry contract

Create a finite, pure `game/mastery.mjs` evaluator. Definitions live **outside `level`**, so adding optional objectives cannot change old `normalizedLevel`, campaign keys, leaderboard identities, replay summaries or physics. New pack format `xonix-pack.v2` may add a top-level `masteries` array; old `xonix-pack.v1` retains its exact schema. A v2 Homeward pack can still declare `engine: xonix-core.v2`, since its movement and victory rules are unchanged.

Each definition has `id`, `revision`, `campaignId`, `levelId`, bounded `name`/`description`, and an `all` list of registered predicates. Start with only: `clean-win`, `resistant-cut-cells`, `supply-refilled`, `suppressed-region-cells`, `hangar-switch`, `impact-live-cut-recovery`, and the boss predicate described below. Predicate objects have exact supported keys and validated actor/zone/pad references. Limit eight predicates per badge, four badges per map and 128 definitions per pack. No arbitrary expressions, event-name queries, JavaScript, network assets or rewards with executable actions.

The observer samples **every fixed simulation tick**, including replay verification and restore reconstruction; it receives read-only before/after facts and the tick's events. It never changes a run. A rendered frame can contain several ticks, so sampling once per frame is insufficient. Use bounded sets keyed by cut/zone/cell and named actors; do not retain an unbounded event log. Define “inside region” using the same rectangle convention as `updateSignal`, and only count actually visited endpoint cells once. These are explicit arcade criteria, not an approximate distance claim.

Before issuing a seal, reconstruct the completed replay through a trusted verifier/observer path and require: matching installed campaign, roster and definition identity; a genuine `won` result; live eligible completion context; every predicate true. An incremental observer may show preview progress, but its caller-provided totals cannot authorize an award. `evaluateMasteryReplay` should yield and support cancellation like `verifyReplayAsync`; do not invent a second arbitrary replay interpreter. A verified-result capability can prevent an accidental raw-JSON award API, while local imported records remain local data rather than authenticated competitive achievements.

Keep mastery out of the old simulation state, summary and checkpoint. Reconstruct observer state from the replay when loading an unfinished attempt; do not add an unverified mastery counter to session JSON. Replay Theater and practice may show a demonstration checklist but cannot write earned seals. Historical clears without a complete eligible recording stay clears with no inferred equipment badge.

### Persistence and identity

Use `xonix-library.v2` with one explicit top-level mastery-record collection; migrate validated v1 libraries by adding an empty collection. Keep `revealline-progress.v1` clear records unchanged. Records need campaign key, map ID, definition ID/revision/content hash, full run setup identity (ruleset, seed, turning policy, initial recipe/roster and class route), run ID and earned timestamp. Preserve the original qualifying setup; an aggregate icon can say “earned” while its detail identifies the mode and class route.

Use one record per badge-definition/setup identity, with deterministic earliest-earned tie breaking. Merging tabs unions those records, never combines partial criteria. Re-delivery of an already awarded run is idempotent. Cap earned records explicitly (initial maximum 4,096, still inside the existing library byte budget); capacity failure preserves existing data and reports that the optional seal could not be saved. Do not evict earned seals silently. Changed definitions get a new hash/revision; old seals remain viewable as historical rather than silently satisfying a harder definition.

Keep ordinary completion/gallery persistence immediate. If verification yields after the result screen appears, show “Checking equipment goal…” without delaying the next mission. Commit the verified optional record only against the current library generation and original run/campaign identity; a subsequent import, Undo or replacement must cancel that stale award. Add its merge behavior to the existing storage transaction path, not an independent localStorage writer.

Full backups and portable player imports must accept v1→v2 migration before adoption, preserve original files and provide the existing Undo path. Old releases should reject a v2 library or pack clearly; never label new records v1 and silently strip them. `xonix-backup.v1` can remain an envelope because it delegates member validation; its tests must cover both library versions and mixed old/new packs. Previous-release transfer needs the same validated migration. No automatic badge backfill is authorized from time medals alone.

## B. One genuinely two-stage boss

Add a separate one-map **Sentinel Relay** pack/challenge. Do not append a fourth map to Homeward: changing its level list changes its campaign identity and would discard the meaning of its existing completed-chapter state. Use all seven classes and both turning modes. The first proof target is a readable ordinary no-ability solution for every class; equipment adds optional strategies.

The new stationary `relay-sentinel` uses one existing shield relay and a core objective at its own center. Use a fresh authored board with no other field enemy anchoring the sentinel's intended final region. A boundary patrol may be added only after ordinary routes pass. The boss body remains collidable until defeat. Because its center retains its own field region during stage 1, the core cannot be captured by an early large fill; a trail through the center loses to contact before capture.

| State | Player-visible behavior | Deterministic rule |
|---|---|---|
| Stage 1 — Shielded | Horizontal lane warning; “Capture the shield relay.” Core has a closed shield symbol. | Sentinel anchors its region continuously. Capturing the named shield relay transitions once to stage 2. |
| Transition | Shield opens with a short ring effect; visible “Stage 2 · close a cut when the core opens.” | Cancel the old stage's scheduled lane, give a fixed one-second grace before the next warning, retain the core's region and leave all owned cells intact. |
| Stage 2 — Sweep | Vertical warning and active stripe; the core stays shielded. | Sentinel still anchors its region. No vulnerability during the warning or active stripe. |
| Stage 2 — Open core | Stripe ends; core shows an open diamond and a shrinking recovery meter. “Close your cut now.” | During recovery only, sentinel stops retaining its field component. A normal cut that claims the core objective defeats it. |
| Defeated | Core shuts down; final region opens through the normal capture/reveal path. | Remove only this boss's contacts and anchor contribution. Emit defeat once; victory still requires the authored coverage and required objectives. |

This changes the player's task between stages: first separate and claim the shield relay; then time a closure for the opening after a differently oriented attack. It is not merely a faster loop with a new label. Stage 1 cannot immediately trigger and finish stage 2 in the same capture: its anchor is still present through transition, warning and the first stage-2 attack. Phase 2 can be solved by waiting on safe ground and choosing a fresh, well-timed cut; perfect equipment execution is optional.

Initial tuning, to be confirmed with routes: stage-1 warnings 1.5 seconds, active lanes 0.7 seconds, six-second period; stage-2 warnings 1.5 seconds, active lanes 0.7 seconds, two-second recovery; lane width 1.2 cells. These are fictional game values. Store new phase deadlines as integer fixed ticks. Use exactly two authored stage configurations, not a generic behavior graph. Stage 2 repeats until a qualifying closure or normal mission failure.

Stun fields and impact may suppress the current lane's contact in the same manner as existing boss stun behavior. They **do not** open the core early, extend recovery, change the schedule or bypass the relay. Shield can absorb eligible contact under existing rules. Fiber only resists actual signal regions. Optional boss mastery can require a clean win with the core captured during its recovery state; this is a specific authoritative fact, not an invented health score.

### Boss schema and simulation scope

New boss maps use `xonix-level.v2` and opt into `xonix-core.v3`. Add a strict boss descriptor with stable shield/core objective references and exactly two bounded phase schedules. Validate that the boss is stationary, fits clear interior, the core shares its cell, the two objectives differ, deadlines allow positive recovery, and goal boss IDs reference registered new bosses. Start with at most one staged sentinel per map. Pack validation must reject unsupported predicates or references before image decode.

Keep the existing `worldStep` ordering: earliest contact/timeout resolves before closure; successful capture emits objective facts; the boss transition/defeat hook runs immediately after that capture and before the victory check. At a new phase tick, update the sentinel phase before planning contacts or computing whether it anchors fill. Specify half-open intervals: warning ends at active start; active ends at recovery start; recovery excludes the next warning tick. A closure at recovery start may succeed; at its end it is shielded again. Tests must cover both boundaries and contact/closure ties.

The renderer reads stage, phase, lane, deadline, exposed/defeated flags and exact lane bounds. It does not derive vulnerability from opacity, animation completion or audio playback. Keep labeled stage text and core shape visible with reduced effects and music muted. The single map can use the existing original background and procedural effects during development; new polished boss art is a later isolated asset revision, not evidence required to prove the mechanics.

## Compatibility decisions before code

| Contract | Required treatment |
|---|---|
| `RULESET` and campaign keys | Preserve the legacy v2 constant for old callers and add explicit supported-ruleset/level resolution. Existing v1 levels still create v2 runs; v2 boss levels create v3 runs. Derive campaign identity from its actual supported level ruleset, with **exact old serialization** for old campaigns. No mixed simulation versions inside one campaign in this increment. |
| Core state/summary | Add staged-boss fields and the extra victory condition only to v3 runs. Old v2 state, events, timing, default normalization and summary remain exact. Avoid even adding default `bosses: []` to old normalized levels or results: that changes hashes. |
| Replay | Keep replay v3 + state-v2 projection for core-v2. New core-v3 runs use replay v4 and a new projection including boss descriptor, stage, deadlines, vulnerability/defeat state and result. Dispatch from validated version/ruleset pairs; never silently reinterpret an old replay as new rules. Input fields need no change. |
| Replay consumers | `sessions.mjs`, `backup.mjs`, `replay-player.mjs`, theater, couch sessions and all verifiers must use the same dispatcher. Explicit recorded releases and pause semantics stay intact. Unknown version pairs fail before adoption. |
| Awards/scoreboards | Replace hard-coded `result.ruleset === RULESET` only with an exact expected-ruleset comparison for the selected campaign. Old campaign keys/boards/variants remain byte-compatible. New boss campaigns get new identities. Mastery alone does not split an existing time leaderboard. |
| Packs/scenarios | Accept the original v1 contract unchanged; introduce v2 for mastery/boss content and exact supported engine pairing. Old v1 packs export as v1. New unsupported packs fail clearly in archived clients. Scenario/playground validation must understand v2 levels and retain them on roundtrip. |
| Libraries/imports | Explicit v1→v2 migration with empty mastery; preserve unknown historical campaign records, old gallery data, old five/seven-part setup keys and replacement generation semantics. Previous-release inspection and full backups use the same importer. |

Do not copy the full simulation into a second engine unless exact-compatibility tests show shared conditional code cannot preserve old behavior. Isolate the new boss module and version dispatch; every old branch remains exercised by its stored fixtures. A global find/replace of v2→v3 is specifically out of scope.

## Acceptance and meaningful comparisons

1. **Existing content stays exact.** Run every current campaign, expansion, Fieldcraft and Homeward fixture without regeneration. Compare summaries, state-v2 checkpoints, campaign keys and board identities against v0.4.1. Load a suspended old live cut, continue it and verify the old final checkpoint; test both turn modes and historical profile/full-backup import.
2. **Mastery is useful and optional.** Six Homeward role records earn their intended seals. Ordinary interceptor routes still win but fail the equipment-specific criteria. Matched omission traces cannot earn Supply Line or Safe Return. Add targeted tests for failed-cut discards, stationary dwell, full-pad rejection, unsafe/cooldown switches, multi-run fragments and a changed definition hash. Replay/practice viewing writes nothing.
3. **New boss requires both stages.** Record a real shield-relay capture, exactly one transition, a complete first stage-2 warning/attack, a later recovery closure, core capture, defeat and one terminal result. A fast stage-1 area capture cannot skip those events. An otherwise identical early closure while shielded must leave the core unclaimed; delaying normal input into recovery must claim it. An unsafe cut overlapping the active lane must cause the expected contact instead of a success.
4. **Fair alternate approaches.** Prove the new map for seven classes × two turning modes with legal ordinary inputs, then add a field-assisted route and action-omission comparison showing an actual suppressed contact opportunity. Core vulnerability remains identical with or without the field. Do not describe failure to find a heuristic route as proof of impossibility.
5. **Boundary/restore determinism.** Suspend before shield capture, during transition/warning/active/recovery, and immediately before the winning closure. Restore exact state-v3 checkpoints and finish. Compare 10/30/60/120-FPS scheduling, reduced effects and all four presentations within each input policy. Cover recovery boundaries, contact ties, field expiry, death and once-only transition/defeat emissions.
6. **Browser release evidence.** Through public controls, complete one unmastered ordinary Homeward attempt, one badge attempt, a resumed attempt and both boss stages. Inspect muted/reduced-effects readability, badge details, gallery/continue actions, import/Undo with mastery, portrait and landscape layouts. Record observed play results separately from generated proof fixtures. Passing automation is not evidence of a satisfying difficulty curve or voluntary replay.

## Implementation sequence and ownership-sized changes

| Order | Bounded change | Main files |
|---|---|---|
| 1 | Freeze old identity/checkpoint fixtures; define mastery predicates and version matrix. | New `game/test/compatibility-v041.test.mjs`; old proof files remain untouched. |
| 2 | Pure mastery observation/verification and strict definition schema; validate against existing Homeward inputs. | New `game/mastery.mjs`, `game/test/mastery.test.mjs`; narrow verifier observer hook in `game/replay.mjs`; `game/packs.mjs` v2 schema. |
| 3 | Persist optional seals with migration, merge and replacement protection; add brief/results/collection UI. | `game/library.mjs`, `game/backup.mjs`, `game/profile-transfer.mjs`, their tests; `game/app.mjs`, `game/ui/library-panel.mjs`, small dedicated mastery UI module. Keep `progress.mjs` clear-record shape unchanged. |
| 4 | Add opt-in staged boss and versioned simulation/replay dispatch; author one map and legal proofs. | New `game/core/bosses.mjs`; conditional changes to `core/registry.mjs`, `level.mjs`, `index.mjs`, `capture.mjs`, `contacts.mjs`; replay/sessions/progress identity plumbing; new pack and `scripts/verify-mastery-boss.mjs`. |
| 5 | Readable boss cues, integration fixtures, browser verification and normal release checks. | `game/ui/render.mjs`, `audio.mjs`, app HUD; replay theater/playground/couch compatibility tests; authoring skill/example updates and verification notes. |

Ship this as the next independently identified source/release only after those gates pass. Do not modify `releases/v0.4.1`, its tag, old proof expectations or the three original Homeward pictures. Larger boss catalogs, generalized scripting, new drone physics, network play and additional currencies are separate future work; this increment gives players a concrete reason to revisit three pictures and one new encounter with a different capture decision.
