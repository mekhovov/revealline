# FPV Survivals — delivery review and proposed priorities

15 October 2026. Latest follow-up rebased onto fetched main `859d5cfc9`; earlier checkpoints below retain their original source boundaries. This is a decision document; implementation, automated checks and human acceptance are separate states.

## Latest implementation follow-up

PR #1344 is now merged at `51647de73d`. Its bounded performance and native cached-launch checks are complete. The next follow-up, runtime `f494367b7`, displays all pending Echo/Fan impacts and the actual accepted Riy chain path. See [attack-readability evidence](qualification/overflight/attack-readability-20261015/README.md). Combat tuning is unchanged; earlier build losses remain open.

PR #1319 is merged at `47c3e26e25`. The local checkout safely rebased onto main `da0b010820`, preserving all pushed work. [PR #1344](https://github.com/mekhovov/revealline/pull/1344) fixes overlapping squad/review controls, rotates audible escort feedback without increasing its cadence, and explicitly guards corrective-module offline inclusion. Native desktop/narrow screenshots, a passing local opening frame-time trial, focused checks and fixed-seed build comparisons are recorded in the [follow-up report](qualification/overflight/quality-followup-20261015/README.md).

These are concrete implementation and integration advances, not acceptance of every build, the complete sound mix or medal calibration. Read the report's completion boundaries before using historical evidence as a current pass.

## Earlier integration and merge decision

Main `33957174d7e02609220aeff99f185baae5f7ca34` was merged into this
follow-up at `68d5523a55434ac609c634e35a5a99e0d01d76c8`. That integration
has no Overflight runtime-file differences from the prior PR head; it retains the
newer shared UI/input and other main changes. A single combined Node test run of
the Riy cover, survival HUD, upgrade card/preview, renderer, world-audio and
existing Riy regression suites passed **75/75**, zero failed or skipped.
Initial sparse-checkout attempts lacked required source/package files and were
not accepted as successful runs; the complete cohort above passed after those
checkout dependencies were restored without changing application code.

The user explicitly approved merging #1319 with the documented Riy Echo balance
losses tracked as follow-up work, after refreshed exact-head checks and changed
gameplay-flow checks pass. Those losses remain observed failures, not qualified
balance. This decision does not waive data preservation, current-head CI or
deployment safeguards, and does not relabel historical native/performance/offline
evidence as qualification of this combined source. Final CI and combined-source
native changed-flow review remain pending at this checkpoint.

## Recommendation

Finish the corrective delivery, then prioritize balance/progression and combat readability. Keep audio review in the same polish cycle. Defer more maps, modes, upgrade families and character mechanics until the existing choices are demonstrably distinct and enjoyable. Eighteen maps already provide substantial content; more content will not by itself solve repetitive or unclear play.

## What is delivered

| Area | Completed | Boundary |
| --- | --- | --- |
| Mode family | One FPV Survivals entry; Single Drone, Riy, Single Raid, Time Attack and Contract Marathon; shared shell/settings/input. | The five choices are operations within one family. Existing humanoid Hunt remains a separate game. |
| World catalogue | Six worlds, 18 authored layouts, shared materials, modular landmarks, terrain/cover, mission previews and operation adapters. | Static art and selected native scenes are reviewed; not every layout/build combination has aesthetic acceptance. |
| Enemy and combat systems | Coordinated pursuit/flanking/crosscut/formation behavior, committed warnings, clearance checks, active armor approaches, escorts and Focus. | Sampled exploit checks pass; this does not guarantee every strategy is balanced or enjoyable. |
| Progression/replay | Early upgrades/evolutions, late-threshold correction, supplies/Overdrive, Raid Rush, bounded Marathon refits, records/mastery/results and retries. | Riy Echo collection/approach weaknesses and medal calibration remain open review questions. |
| Shared authoring and content | Versioned projects, world/layout controls, modern Riy Studio controls, Asset/Motion integration, exact resource references and import/export. | Bounded native round-trips exist; historical evidence is not automatically qualification of later changes. |
| Packaging/resilience | Five FPV operations plus Snake have native origin-unavailable launch evidence; interrupted update, retry, context recovery and cleanup checks exist. | One missing imported-mission observation remains unexplained despite successful exact-transition repeats. |
| Local performance | Recorded reference, opening, late Riy, controlled Raid and soak passes; fixed atlas accounting and reduced-effects comparison. | Measured on the available M4 Pro. Earlier failures are retained; no Iris Xe or Safari pass is claimed. |
| Cross-mode reuse | Shared grounds, sounds/reactions and bounded presentation adapters across compatible modes. | A complete visual redesign of Solo/Team/Snake/SIM is not delivered or required by the bounded reuse pass. |

PR1192, PR1215, PR1226, PR1248 and PR1319 are merged. Corrective runtime `60b0c25ab` is now in main: final-target navigation; exact salvage shortfall; native upgrade-card sprites; cover-aware Riy firing/chains; audible-local warning selection. The newer bounded presentation follow-up is tracked in PR1344.

## Remaining work, in recommended order

### Completed P0 — Integrate and qualify the corrective follow-up

**Status:** PR1319 and PR1344 are merged. The bounded native timing and actual cached Riy launch are recorded in the quality-follow-up report. These checks close this corrective integration item; they do not relabel earlier full-content/device evidence as current. New presentation work is qualified separately.

**Why / benefit:** These fixes remove misleading information and wasted escort attacks. The newer shared menu/input/style changes must work with them. One attributable candidate gives reviewers a reliable version to accept.

**If deferred:** The new presentation fixes remain outside main, and older performance/offline reports do not establish the behavior of the final combined release.

**Done when:** Follow-up is merged, changed-flow checks are green, and the tested commit/settings are recorded. This is release integration, not a new gameplay feature.

### P1 — Validate and tune build viability and progression

**Work:** Compare sweep, lure-and-return and priority-target routes on matched seeds in Single Drone/Riy; review objective-focused versus pack-hunting Raid approaches. Track collection opportunities, time between meaningful choices, boss approaches and damage causes. Tune only demonstrated problems, one variable at a time.

**Why / benefit:** The broad matrix recorded 47 unattended defeats but only two wins among twelve active fixed-route baselines. Separate routes demonstrate more viable completions, so bot failure alone is not proof of excessive difficulty. Riy Echo nevertheless has a documented 91.2-second late-choice gap on one route and weak boss approaches. The new guidance/cover fixes should be reviewed before changing damage.

**If deferred:** Builds may be technically functional but tedious, unclear or disproportionately difficult; some apparent variety may collapse into one preferred build. This directly affects the user's central goal: challenge that rewards changing tactics.

**Done when:** Each intended technique has a credible demonstrated completion route and distinguishable decisions, without reintroducing unattended wins. Ordinary-player enjoyment remains a review judgment.

### P1 — Accept combat readability and polish the existing maps

**Work:** Review representative open/cover layouts in every world during early, dense and boss scenes. Check player/escort identification, warning timing, solid versus fly-over scenery, full-build effects and reduced-effects parity. Refine actual failures in contrast, silhouettes, spacing or animation timing; use the finished slice as the visual reference.

**Why / benefit:** Eighteen different topologies already exist. Their value depends on players reading safe routes and threats in motion, not only on attractive map sheets.

**If deferred:** A death may feel arbitrary, scenery may conceal attacks, and different maps can feel cosmetically distinct without supporting different tactics.

**Done when:** Reviewers can identify danger, available exits and the effect of their build in the selected stress scenes. This is acceptance and targeted polish, not rebuilding all artwork.

### P1 — Listen to and balance the complete sound mix

**Work:** Audibly review quiet, dense and boss scenes with the real soundtrack enabled. Check warning audibility, destruction/reaction variation, escort repetition, commentator frequency and Classic/Reactions settings. Adjust priorities, spacing and levels using the shared sound system.

**Why / benefit:** The local-warning selection bug is fixed, but non-silent recordings do not prove a good mix. Existing gameplay recordings exclude external soundtrack, so they cannot establish that warnings remain audible over music.

**If deferred:** Repetitive voices and impacts may become tiring; masked warnings can make otherwise fair attacks feel unfair.

**Done when:** Important cues remain understandable in the complete mix and ordinary kills stay satisfying without dominating it. Add music intensity changes only afterward, at major encounter transitions.

### P2 — Calibrate replay rewards and medals

**Work:** Review Time Attack medal targets against real runs, and review Marathon contract composition/refit usefulness across the five-contract sequence. Confirm mastery challenges encourage different techniques rather than repeating the safest route.

**Why / benefit:** Records, medals and bounded refits exist; credible targets turn them into reasons to improve and replay.

**If deferred:** The modes remain playable, but medals may be trivial or discouraging and Marathon may repeat decisions. Do not use automated pilots as the sole calibration standard.

**Done when:** Targets are defensible from recorded player attempts, and later contracts/refits offer understandable tradeoffs. Until then, medal thresholds remain provisional.

### P2 — Preserve and watch the imported-library anomaly

**Work:** Keep the original missing-mission receipt, the two successful retention repeats and exact package identities. If the issue recurs, capture import/install/update sequence and storage state before applying a targeted fix.

**Why / benefit:** A missing authored mission is significant, but the current evidence does not establish a cause. Preserving evidence avoids both dismissal and a speculative migration that could introduce damage.

**If deferred:** Investigation is harder if it recurs. This is an observation/reproduction item, not justification for blocking indefinitely or rewriting storage now.

**Escalation:** Raise to P0 immediately if a reproducible loss of installed content is found.

### P2 — Extend accepted presentation to other modes selectively

**Work:** Choose one compatible material, state animation or feedback improvement at a time for Solo/Duel, Team, Snake or SIM; review it through that mode's native camera and mechanics.

**Why / benefit:** Shared adapters already provide reuse. Targeted adoption brings a consistent quality level without turning the task into several simultaneous redesigns.

**If deferred:** Those modes retain some older visual quality, but FPV Survivals delivery is not blocked.

**Done when:** A selected improvement is visibly useful in the receiving mode and preserves its collision, overrides, settings and performance.

## Deliberately defer / skip

- **More worlds, modes and upgrade families; character-specific mechanics; permanent progression:** defer. Current breadth is sufficient to evaluate the loop. Expanding now multiplies balance and presentation work.
- **Adaptive music intensity:** after the full-mix review; it is polish, not a substitute for audible warnings.
- **Iris Xe Windows, M1 Safari, physical controller/phone and five-player study:** skipped at the user's direction, not passed. No unavailable-device dependency is placed on the next local work.
- **Universal claims of enjoyment or full combinatorial coverage:** not acceptance claims automation can provide.

## Suggested next batch

1. Review and integrate the bounded attack-readability follow-up; PR1319 and PR1344 have merged.
2. Review Riy Echo and the three intended build techniques; adjust only evidenced problems.
3. Polish readability and the complete audio mix on those same runs.
4. Calibrate replay targets, then choose further cross-mode polish.

This order directly addresses challenge and replay quality while using the already completed content. It avoids another expansion before the existing experience has a clear quality bar.
