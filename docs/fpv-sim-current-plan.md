# FPV SIM — current delivery plan and status

Reviewed: 20 October 2026, 22:55 CEST Berlin time. Workspace: `go_test_radio_fix`, branch `codex/fpv-flight-widgets-world-picker`.

**Overall: the planned feature mechanisms are implemented locally; release qualification is incomplete.** The local server responds successfully. No release, deployment or new commit was made in this review. This plan consolidates the approved combat overhaul, consistency/presentation plan, six-switch radio work and the latest compact-HUD request. Earlier reports retain their original evidence scope.

## 1. Completed implementation

| Area | Delivered locally | Evidence limit |
| --- | --- | --- |
| Activities and resources | Continuous, Hunting, Elimination, Strike, Timed/Endless Survival; four weapons/two slots; bombs, remote/drone charges; ammo presets, repair/supplies, service pads and health options | Full map/loadout economy and final gameplay quality are not qualified. |
| Enemies and destruction | Military combat archetypes; organic and mechanical recipes; falling/settling remains, persistent impact marks; independent Blood/Brutal/Remains preferences; Current and optional r2 art | r2 adapts existing artwork. It is not a newly commissioned photorealistic sculpt, and automated images do not establish Doom-level quality or satisfaction. |
| Damage consistency and lessons | Versioned live damage rules, authored-actor ownership, destructible tracking/rival subjects, safe required-subject replacement after 250 accepted ticks, generation/credit ledger | End-to-end browser lesson completion after replacement still needs qualification on both physics backends. Unknown imported scenery requires explicit actor metadata. |
| Save/replay continuity | Historical Watch, separate unscored live continuations, original-save preservation, bounded recordings/archives, recovery handling | Long/rejected-step, streaming and storage checks must be refreshed against the final release candidate. |
| Flight and world continuity | Railway radio/arming fixes; regional boundary flight continues while encounter actors wait; Chase adjustment, FPV props/nose/knife and optional analog effects | Final physical-radio pass and broad sustained regional/Advanced stress remain open. |
| Objectives and Studio | Semantic gates/hold/landing/subject markers, current/next guidance, offscreen/entry-side/occlusion cues; route admission and Studio history/import/export | Complete navigation on every shipped encounter is not proved by short catalogue tests. |
| Optional route guide | Remembered default-Off guide, validated waypoint admission, Studio authoring/preview/import/export and unavailable-route explanations | This former later phase is already implemented. Maps without a validated authored path correctly have no trail. |
| Selectors/defaults | Unified catalogue/download path, separate Learning/Other/Mixed Random, independent activity and flight-mode choices | Remote download reliability and complete play-through coverage remain separate. |
| Six-switch radio | Context-sensitive flight/menu roles, staged alternatives, setup/calibration retention, RadioMaster/OXBOT/receiver presets | New complete hardware matrix is pending. Squid Stick cannot identify the transmitter behind it; ambiguous receivers need firmware/model confirmation. OS file/permission dialogs may still require a host gesture. |
| Compact HUD | Auto/Compact/Detailed, slim vitals, short activity summary, expandable Weapons, saved widget switches; active touch input preserved; shared Academy/Worlds layout | Actual device ergonomics and radio/menu usability need human checks. |

## 2. Evidence reviewed and what it proves

- **607 recorded automated passes** in two disjoint sets: 233 host/actor/route/archive and 374 renderer/presentation/radio checks. This is a pre-compact-HUD receipt. Four of its 13 source hashes now differ: World host, fullscreen controls, fullscreen stylesheet and projected stylesheet. It is **not a fresh 607-pass claim for the present build**. Other historical runs overlap; their counts must not be added together.
- **7,420/7,420 catalogue cases** across 371 entries: 245 native editions and 126 regional starts. All **17 recorded source hashes still match**. It proves nonempty admission, three accepted steps, recovery and replay within its methodology. It does not prove full victories, lesson completion, navigation or a viable ammunition economy.
- **Compact HUD browser inspection:** Worlds learning/native combat and Academy; portrait 390×844, landscape 844×390, and Detailed 1440×900. Hide/show, persistence after refresh, active touch controls, weapon switching and layout restoration were inspected. Its five recorded source hashes still match. No new automated HUD suite was added/run during that delivery.
- **Physical user confirmations retained:** yaw calibration and manual Save; Railway Valley arming/flight; Fire before and after pause. These predate the full six-switch/new-actions work and cannot qualify it automatically.
- **Performance is not a release pass:** historical native Standard 1080p averages were approximately 60.00 / 59.75 / 59.47 / 58.61 FPS for 20/64/96/128 requested actors. The strict 60 FPS target was unmet at the larger tiers. Those runs predate later changes. Short revised r2 effects fixtures met the +3 ms CPU target (+1.1 ms High, +1.9 ms Ultra), but sustained complete-application, Advanced and regional results remain open. One older measured console 404 remains unattributed.
- **Latest complete runtime/source package candidates pass their unchanged policies.** Academy: 145 runtime / 147 source files; 100,241 bytes of original-input headroom. Worlds: 208 runtime / **210 source files**, its source-file ceiling; 526,312 bytes of original-input headroom. Candidate identities are placeholders, not release evidence.
- Current review confirms about **735 MiB free disk space**, still-active sparse checkout omissions, and an HTTP 200 local server. This review did not run gameplay regressions or stress workloads.

## 3. Phase status against the approved consistency plan

| Approved phase | Current status | Closure requirement |
| --- | --- | --- |
| 1 — Every gameplay character destructible | Implemented; focused model/host evidence exists | Actual reported-NPC and current/future lesson-subject defeat → replacement → lesson completion on Standard and Advanced; streamed/imported ownership checks. |
| 2 — Clear gates and objective navigation | Implemented; representative browser captures | Wrong-side, occlusion, specialized objectives and distant/low-quality visibility across representative shipped environments. |
| 3 — FPV foreground and hybrid HUD | Implemented, including the new compact-HUD follow-up | Current-source regression refresh; real phone/tablet, radio and controller usability; portrait/ultrawide/FOV/tilt and analog-effect readability. |
| 4 — Whole-SIM qualification | **Incomplete** | Current-source full activity/economy, visual, hardware, performance, cleanup and compatibility acceptance. |
| 5 — Optional full route guide | Implemented ahead of the former sequence | Full path/navigation and Studio round-trip/reimport acceptance; keep Off by default. |

The six-phase combat overhaul has the same distinction: mechanisms for phases 1–5 are present; several phase exit gates remain open, and phase 6 release qualification is incomplete. No completion percentage is assigned because it would hide the performance and human gates.

## 4. Remaining work, order and estimates

These are **focused effort estimates**, starting when execution resumes with the required resources. One engineering day means roughly eight focused hours. They are not scheduled dates, unattended-work commitments, or guaranteed completion times. Defects found during qualification can extend them.

| Order | Remaining deliverable / done condition | Estimated effort | Dependency / confidence |
| --- | --- | --- | --- |
| R0 | Establish safe verification capacity: inventory disposable caches and get sufficient free space without deleting project files, Git history, saves or installed dependency source | 2–4 hours to inventory and act on proven-safe candidates; achieving 1–2 GiB extra is not guaranteed | Disk availability; medium confidence for inventory, unknown cleanup yield. |
| R1 | Capture final source baseline; add/refresh compact-HUD behavior coverage and rerun relevant integration, historical and radio/menu checks; replace stale receipts | 0.5–1 engineering day | R0 for reliable writes; medium confidence. |
| R2 | Complete actor/lesson/save/route acceptance: reported NPC, required current/future subjects, catch/lethal ordering, replacements, ownership after streaming/rebuild, historical Continue/Watch and Studio round trips on both backends | 2–3 days | R1; medium confidence, fixes may add time. |
| R3 | Full activity and resource qualification: complete objectives, fixed rosters, Survival final-entry/ending, route reachability and regional return; exercise all weapon-pair/ammo combinations on representative constrained/large/aerial scenes and close catalogue gaps | 2–4 days | R1/R2; medium-to-low confidence. The short matrix is not a substitute. |
| R4 | Final visual/readability pass: all families/casts, Current/r2, eight gore-preference combinations, grounding after terminal/recovery, gates, camera/FOV/aspect ratios, compact widgets and analog HUD readability | 1–2 days | Stable R1 build and art availability; medium confidence. Human ratings stay separate. |
| R5 | Profile/repair large-population performance; repeat final-source 10-minute 20/64/96/128 runs, eight-defeat bursts, full rings, effects On/Off, long recording overflow, rebuild/cleanup, regional/Advanced and Realistic workloads | 2–5 days initially; may exceed this | R0 plus stable build; **low confidence** until fresh profiling. Actual 60 FPS/+3 ms acceptance is required. |
| R6 | Restore exact tracked authoring inputs needed by full validation; perform localization/generator/source/runtime package closure and actual remote download/fallback checks | 0.5–1 day after prerequisites | Sparse source inputs and network; medium confidence after access. No policy-cap increase. |
| R7 | Physical radio acceptance: six-switch direct/staged actions, menu reachability, arm/pause/reset/view, every new weapon action, reconnect/focus loss and unchanged calibration; direct USB and Squid/Pico where available | 60–90 minutes per available representative radio/connection | **Hardware/person availability**. No calendar ETA for unavailable models. Earlier Fire checks do not close this. |
| R8 | Actual small-device touch/readability checks and controller check; verify hidden widgets cannot remove needed flight input or escape/menu access | 45–60 minutes per device/input combination, plus fixes if found | Device access; no calendar ETA until devices are available. |
| R9 | Five-player formative sessions across radio/controller/keyboard; record engagement timing, ammunition frustration, death explanation and another tactic; median satisfaction/clarity ≥4/5, four of five explain death and a new tactic | About 3–5 hours of sessions plus 0.5–1 day to analyze; allow 1–3 days for fixes/retest if needed | **Five available participants**. Recruitment/scheduling and a passing result have no honest fixed date yet. |
| R10 | Consolidate final evidence, review the isolated diff, create a reproducible versioned candidate, release notes/known limitations and delivery handoff | 0.5–1 day after preceding gates | All required gates; publication is a separate requested delivery action. |

**Planning range: approximately 10–20 engineering days for remaining qualification and expected fixes**, plus hardware/participant scheduling. This is a low-confidence overall estimate, not a promise of a release date. Large-population performance or new correctness defects can extend it. A reliable calendar ETA should be set after R1 establishes a clean current baseline and R5 has initial profiling results. Local review is available now.

## 5. Blockers and concerns

### Confirmed constraints

1. **Low disk space:** ~735 MiB free at review. Code/document work is possible, but longer reports, archives and performance runs are vulnerable to exhaustion. Earlier cleanup only removed proven regenerable caches. Do not solve this by discarding work or player data.
2. **Missing full-validation inputs:** the sparse checkout still omits `authoring/community`, the industrial review source theme, several tracked library packs and motion-lab presets. Missing files are listed in the status receipt. Full repository validation cannot be claimed until the exact inputs are available.
3. **Performance gates are open:** historic larger-population runs missed strict 60 FPS. Final-source regional/Advanced/Realistic stress is missing. A short effects fixture cannot close those gates.
4. **Hardware and people:** the new full-radio pass remains deferred; actual small-device ergonomics and five-player results are absent.

### Risks and compatibility limits

- **Evidence drift:** the latest HUD is newer than the 607-test receipt. Freeze source and refresh reports before calling this release-ready.
- **Package capacity:** Worlds has no source-file slots left; Academy has roughly 98 KiB of input margin. Reuse/consolidation is required for further growth. Existing byte/file policies remain unchanged.
- **Local uncommitted work:** substantial changed and untracked task files are present alongside preexisting work. HEAD matches its local remote-tracking reference, but this does not back up working-tree changes or verify the current remote state. No cleanup, staging-all or publication should sweep in unrelated files.
- **Network/asset scope:** prior Railway checks sometimes used cached pinned bytes because remote downloads stalled. Actual unreliable-network delivery must be checked. The optional r2 pack is adapted existing art, not a fresh photorealistic asset commission.
- **Radio identity limits:** a receiver exposes its own USB identity, not the bound transmitter/mixer. Ambiguous hardware cannot be safely auto-mapped without a check. Browser/OS dialogs may require a host gesture.
- **Gameplay coverage:** a reachable initial roster or 128 visible actors does not prove a complete, enjoyable or resource-viable run. Local steering and crowded close pursuit need actual play review.
- **Unknown imports:** unannotated arbitrary geometry cannot automatically become a damage-owned actor. Imported combat/route support remains conditional on validation and metadata.
- **Unattributed historical 404:** retain as an unresolved diagnostic until reproduced/identified or a fresh properly instrumented run establishes its scope; do not silently count it as harmless.

## 6. Changes to the plan from this review

1. Put verification capacity and a current source baseline first.
2. Mark the optional route guide as implemented, with acceptance still pending.
3. Add compact-HUD behavior/device coverage to phase 3/4 rather than treating size emulation as hardware acceptance.
4. Keep the still-matching catalogue pass, but explicitly restrict its claim to short admission/recovery/replay coverage.
5. Separate feature implementation from release approval, and list the actual performance failures and hardware/human dependencies.
6. Keep optional run upgrades, cosmetic progression and Career unlocks outside this release scope. They remain later expansion with no assigned ETA.

## Supporting reports

- [Review receipt](evidence/fpv-combat/plan-status-review.json)
- [Consistency implementation](evidence/fpv-combat/consistency-delivery.md)
- [Compact HUD delivery and captures](evidence/fpv-combat/compact-hud-delivery.md)
- [Current package receipt](evidence/fpv-combat/compact-hud-package-measurement.json)
- [Catalogue matrix](evidence/fpv-combat/consistency-catalogue-matrix.json)
- [Historical regression receipt](evidence/fpv-combat/consistency-regressions.json)
- [Combat delivery history](evidence/fpv-combat/overhaul-delivery.md)
- [Performance evidence and limitations](evidence/fpv-combat/overhaul-performance-qualification.md)
- [Six-switch radio delivery](fpv-radio-six-switch-delivery.md)
- [Human session checklist](evidence/fpv-combat/overhaul-human-playtest.md)
