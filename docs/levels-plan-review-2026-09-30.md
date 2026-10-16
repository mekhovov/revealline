# Levels and Journey: reviewed plan, delivery and remaining work

Reviewed **30 September 2026**. Source checkpoint:
`09a43d83351af276f184293ed3c72261575ed8bc`.
Delivery observation: **20:46:56 CEST (18:46:56 UTC)**.
This is a planning/source audit, not a new playtest.

This is the current **Levels/Journey** review. It supersedes the queue and “next”
labels in the [earlier Levels checkpoint](plan-status-2026-09-30-levels.md),
while preserving its historical evidence. The [whole-game register](plan-status-2026-09-30.md)
and the actor, UX, audio and authoring owners retain their separate scopes.
Do not combine Journey P00–P15, whole-game P00–P18, spatial A–F, FPV increments
1–6 or actor C0–C7 into one completion percentage.

## 1. Executive conclusion

The game has the core systems needed for the requested experience. The main
unfinished work is **content quality and adoption**: distinct route decisions,
fair pressure on each preset, useful objectives/bonuses, less uninteresting
coverage cleanup, and explicitly making reviewed successors the default.

More engine features, more artwork or a larger mission count will not by
themselves solve repetitive easy play. Conversely, successful scripted clears
prove particular routes are possible; they do not prove the missions are fair,
interesting or enjoyable for people.

The latest Levels batch added evidence and planning, **not new map geometry**.
The earlier v38 restoration contains the gameplay change. Neither fact should
be presented as a newly human-approved campaign.

## 2. What is actually delivered

| Layer                       | Confirmed status                                                                                    | What this does not establish                                                                                                   |
| --------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Main source                 | PR820, PR829 and PR860 are merged and included in `09a43d833`.                                      | No automatic default promotion or whole-phase acceptance.                                                                      |
| Continuous GitHub Pages     | Public marker advertises `main-09a43d83351a`; build, deploy and public-main verification succeeded. | No fresh player/device session or full gameplay acceptance.                                                                    |
| Named release               | Latest published version remains **v0.142.3**, source `b5ab06e12542f72e33c45b973ba693a5e1509c1c`.   | No v0.150.0 named release has been established. GitHub reports `immutable:false`; do not claim platform-enforced immutability. |
| Default Solo/Versus content | **whole-spatial-v25**, already a cumulative Ukrainian/Apex spatial edition.                         | It is not the unchanged original library, but it also does not include every later candidate redesign.                         |
| Default Team content        | **team-cultural-specialist-originals-2**.                                                           | Solo successors do not automatically replace Team missions.                                                                    |
| Latest spatial candidate    | **whole-spatial-v38** is registered and labelled balance pending.                                   | Registration/deployment is not selection as the normal default.                                                                |

Sources: [public marker](https://mekhovov.github.io/revealline/release.json),
[successful continuous deployment](https://github.com/mekhovov/revealline/actions/runs/36759567741),
[versioned release](https://github.com/mekhovov/revealline/releases/tag/v0.142.3),
[public default selector](https://mekhovov.github.io/revealline/game/content-design/default-entry.mjs)
and [public route loader](https://mekhovov.github.io/revealline/game/content-design/route-loader.mjs).
These are dated metadata/source observations, not renewed public play acceptance.

### Recent completed Levels integration

- [PR820](https://github.com/mekhovov/revealline/pull/820), merge
  `00f4fc7750`: restores v38 registration, preserved v37 Cooling loop,
  Studio access and six complete Standard route strategies. Cooling loop's
  eroder now contests earned ground; walls/foundations and geometry stay intact.
- [PR829](https://github.com/mekhovov/revealline/pull/829), merge
  `b77fe6a9d2`: adds three full Standard routes extending seed/steering evidence.
- [PR860](https://github.com/mekhovov/revealline/pull/860), merge
  `0ecaec5864b66b0fc6b2e911220a845a097ec32f` at 20:02:37 CEST:
  adds four bounded Solo authoring receipts and unrun regression assertions.
  All three Gentle cases clear; Pressure ladder also has an Expert Grid clear.
  No new runtime, map, speed, artwork or default change was made in this PR.

The [preset receipt](verification/pressure-corridor-preset-routes-2026-09-30.md)
preserves exact inputs and limits. Existing historical passed checks remain
historical. PR860's new automated suites are **WAIVED_SKIPPED_NOT_PASSED**.

## 3. Completed implementation foundations

“Implemented” below means the capability exists in current source. It does not
claim all combinations, devices or missions meet final acceptance.

| Area                  | What is already implemented                                                                                                                                                              | Player/admin benefit                                                                                                             |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Capture and map rules | Enemy-retained four-connected capture, foundations, real walls, player-only slow/lethal terrain, erosion protection and stable coverage accounting.                                      | The board follows a consistent spatial vocabulary; captures can change route safety.                                             |
| Pressure and controls | Stop-on-capture/fresh-direction handling, travelling trail impacts, straight-between-impact keepers, telegraphed pursuers/interceptors, perimeter/frontier patrols, roamers and erosion. | Pressure can come from different understandable roles rather than arbitrary mid-flight steering.                                 |
| Difficulty            | Gentle/Standard/Expert, shared tuning/admin controls, effective-versus-authored inspection and actual actor-count reporting.                                                             | Difficulty already changes more than lives; admins can inspect the same preparation used by gameplay.                            |
| Level mechanics       | Permanent relay connectors, directional speed zones, objectives, four contact bonuses and timed expiry/relocation machinery.                                                             | Designers can vary capture order, timing and route temptation without adding a new rule on every map.                            |
| Content programme     | 71 core missions, 12 Remixes and eight optional studies in the 91-mission Solo/Versus Journey; twelve separately authored Team missions.                                                 | A complete content framework and progression skeleton exist. This is not a count of newly finished or finally balanced missions. |
| Flow and preservation | Journey/Classic/Custom library, Next across campaigns, Skip, progress/recovery foundations and selectable older editions.                                                                | Players can keep playing and old content is not deleted when a successor is introduced.                                          |
| Authoring             | Shared compiler/registry, Studio CRUD, copy-on-write maps, explicit image upload/overlay/manual geometry/Apply and immutable asset identities.                                           | Admins can create and edit campaigns/maps without changing collision through artwork silently.                                   |
| Presentation          | FPV appearances and choices, directional animation/trail foundations, pixel typography, shared appearance controls and pictured Team editions.                                           | The game has a coherent presentation framework; final art/state readability is still a separate acceptance job.                  |

Evidence: [29 September implementation crosswalk](plan-status-2026-09-29-levels.md#completed-implementation-foundations),
[effective gameplay inspection](verification/effective-pressure-inspector.md),
[Journey contract](xposed-journey-plan.md),
[character plan](character-game-feel-plan.md) and current factories/registries.
Old tuning numbers or “not implemented” statements in earlier dated plans are not
the authority for current gameplay.

### Why later redesigns can still be missed in normal play

The v25 default already contains cultural/spatial improvements. Later registered
successors add further changes, including:

- v26–v28: Spiral stores, Nested relays, Survey markers, Compass array,
  Bank the crossing and related route/ornament revisions.
- v29–v34: Folded corner, Split berths, Second landing, Return pocket,
  Two ways home, Broken yard and related successors.
- v35–v37: Phase/Livewire Remixes, Side-door bays, Staggered reserve,
  Crossbar depot and the pressure-corridor trio.
- v38: Cooling loop's erosion placement/heading correction on v37 geometry.

The exact mission lists remain in
[spatial-next-editions.mjs](../game/mission-library/spatial-next-editions.mjs).
They are cumulative review candidates, not dozens of extra mandatory duplicate
missions. Default adoption must be an explicit reviewed choice, preserving prior
editions; changing the route number alone is not a quality review.

An explicit `?journey=whole-spatial-v38` or Studio's registered spatial-edition
review links selects the candidate. Current discovery classifies non-default
Journey editions as archived, so archive visibility can be required to find them.
That is another reason availability is not the same as normal discoverability.

## 4. Remaining work, explained and prioritized

The recommended order below refines the approved programme, not a new feature
scope. Hands-on estimates exclude publisher queues and unavailable human/device
review. Overlapping tasks should ship together; do not add their estimates twice.

### R1 — Finish the current three-mission fairness and pacing review

**Priority: highest content work. Estimate: 1–3 engineering days for the next bounded slice.**

Cooling loop, Pressure ladder and Switchback exchange need convincing approaches
under the current presets and both steering styles. Expert Cooling/Switchback
still have no complete-route receipt from the bounded work so far. This does not
prove they are impossible; it means the evidence is incomplete.

Known concerns must drive design review, not just more route counts:

- Gentle Pressure ladder's impact is cancelled two simulation ticks after seeding.
  The front-arrival/failure margin was not measured, so this warrants timing review
  but does not establish a narrow reaction window or unfairness.
- Expert Pressure ladder's recipe waits 14.5 seconds before starting its route.
  It proves one legal solution, not that waiting is necessary or enjoyable.
- Switchback finishes both objectives very early; the later connector use is
  useful, but the remaining coverage can still feel like cleanup.
- Cooling loop really erodes earned cells; useful repair-versus-escape decisions
  still need review rather than assuming any erosion event creates good play.

**What it brings:** pressure that is challenging without requiring memorized
one-frame timings or long safe waits. **If omitted:** faster presets may expose
unreasonable routes while some ordinary solutions still bypass the mission's
main idea. **Exit:** two plausible approaches, active signature threats, safe
departures, sensible completion tails and explicit unresolved human limits.
Do not increase quotas or global speed merely to extend duration.

### R2 — Make a reviewed spatial successor the normal experience

**Priority: highest delivery outcome, following a bounded R1 selection.
Estimate: 0.5–1 engineering day after selection, plus release gates/queue.**

Choose which later mission revisions are ready, compose an explicit default
successor and preserve the prior v25/current and Original editions. Verify
default entry, direct selection, Next across campaign boundaries, Skip,
reload/Continue and mode ownership. A technically reviewed test build may remain
labelled balance pending while human review is deferred.

**What it brings:** ordinary players actually encounter the reviewed improvements.
**If omitted:** additional opt-in work can be deployed yet leave the normal game
looking unchanged. **Exit:** the selected successor is both the declared default
and the one served by the public entry, with truthful release evidence.
Do not blindly promote all v38 content or call a marker check a gameplay pass.

### R3 — Continue distinct campaign and Ukrainian spatial redesigns

**Priority: high. Estimate: 3–7 working days per polished 3–5-mission cohort.**

Review neighboring missions together. Give each a different decision: which bay
to secure, which opening to contest, whether to connect an island, when to cross
a patrol route, or which terrain/relay capture makes the next route easier.
Use Ukrainian geometry where it supports these choices—open star clusters,
broken lattice, woven bands, branching forms and component/workshop shapes.

The [ornament atlas](ukrainian-ornament-atlas.md) already supplies grounded source
families. Embroidery, weaving, Petrykivka painting, ceramics and carved forms are
not interchangeable labels. Use original adaptations with provenance, not copied
museum charts or universal invented symbolism. Accept geometry before new art.

**What it brings:** recognizable, authentic-looking missions that ask players to
change their approach. **If omitted:** more enemies/backgrounds can still leave
the same easy solution repeated throughout the game. **Exit per cohort:** distinct
adjacent decisions, two approaches, preset review, preserved older editions and
a deliberate default/adoption decision. The 242-candidate target is not a filler quota.

### R4 — Use existing threats and timed bonuses where they matter

**Priority: high, included within R1/R3. Estimate: 0.5–1.5 days within a small cohort.**

The timed-bonus engine and specialist enemies already exist. The remaining task
is purposeful placement: tempting optional detours, visible expiry/relocation,
pressure that activates during normal routes, and relays/terrain captures that
materially improve the next move. Do not require a bonus for ordinary completion.

**What it brings:** variety and short opportunities without unrelated new mechanics.
**If omitted:** a map can technically contain special enemies/bonuses while the
dominant easy route never interacts with them. **Exit:** observed ordinary play
uses the signature mechanic and a viable bonus-free route remains.
New enemy systems stay lower priority than using the existing roles well.

### R5 — Finish complementary Team challenge progression

**Priority: high after the first improved Solo cohort.
Estimate: 2–4 working days per small Team cohort, plus two-person/device review.**

Twelve pictured Team missions and specialist/impact ownership machinery exist.
Remaining work is cooperative design: one player's capture should open access,
neutralize pressure or establish a return that helps the other. Review independent
capture stops, simultaneous trails, knockdown/rescue, disconnect and returning
controllers without transferring one player's impact to another cut.

**What it brings:** cooperation rather than two players doing unrelated easy slices.
**If omitted:** nominal two-player support can remain confusing or dominated by one
player. **Exit:** complementary complete routes and correct recovery, followed by
real two-person/controller evidence when available. Solo parity is not Team proof.

### R6 — Decide and implement genuine optional mastery awards

**Priority: medium; do not delay basic fun/default delivery.
Estimate: 1–3 days for one scoped condition; others require precise authored definitions.**

Current mission-specific mastery strings are practice goals, not recorded awards.
The Journey verifier currently supports replay-confirmed no-loss wins. Historical
route helpers do not implement the newer gap/erosion conditions.

Start, if prioritized, with Cooling loop's exact v38 condition: both lethal banks
neutralized, all foundations connected, an actual erosion event and a no-loss
clear. It needs trusted modern replay event evidence and a revision-scoped optional
definition. It does **not** require repairing a particular cell; that would be a
new requirement. Pressure/Switchback first need exact gap regions, what “use” means,
which closure counts and what recognition is awarded.

**What it brings:** meaningful replay goals with honest, reproducible completion.
**If deferred:** the game remains playable; keep the text labelled practice rather
than promising an award. **Exit:** matching authored/UI/runtime definitions and
preserved historical proof/replay semantics; no completion or artwork gate.

### R7 — Finish actor, trail and Ukrainian artwork presentation

**Priority: medium-high for readability; cosmetic expansion follows gameplay.
Estimate: 0.5–2 days per defect, or 3–5 days for a bounded art cohort under its owner.**

Directional actors, FPV defaults, appearance selection, trail/front effects and
pixel-art shell foundations exist. Finish actual-size role recognition over light
and dark reveals, warning/attack/recovery/frozen states, compact screens, Team
identity/rescue cues and reduced effects. Richer native bodies and Ukrainian art
are candidates until their explicit bindings and visual/cultural review are accepted.

**What it brings:** pressure players can read, and a polished native-game feel.
**If omitted:** mechanically fair enemies can feel unfair because their role or
warning is hard to see. **Exit:** coherent playing-size treatment without changing
collision footprints, preserving originals and user appearances. Production art,
cultural and human approval remain deferred, not silently passed.

### R8 — Close bounded Studio, recovery and administration gaps

**Priority: medium; address any data-loss/launch issue immediately.
Estimate: 0.5–2 days per scoped defect, not a new wholesale editor rewrite.**

Local Studio and browser-global gameplay tuning exist. Complete exact
upload → edit → preview → export/import → play and failure recovery where gaps
remain, preserving original media, undo/history, copy-on-write and mode support.
Keep authored versus effective gameplay values visible.

**What it brings:** reliable ongoing level creation and reproducible balancing.
**If omitted:** authors can create misleading previews or lose time recovering
projects/media. **Exit:** the particular authoring round trip and its failures are
handled without destructive replacement. Assisted image tracing remains a separate
prototype-to-product task; hosted accounts/admin service are not implied by local
Studio or the global browser setting.

### R9 — Finish reference dispositions and whole-route pacing

**Priority: medium-high, alongside each cohort.
Estimate: 1–2 days for a final ledger pass; actual redesigns are counted in R3.**

All 48 numbered Xposed Reloaded references have provisional adaptation links;
that is not the same as a final decision for each. Record retain, redesign, move,
merge or retire-from-default, including the current mission/revision and reason.
Review whole-campaign ordering so late packs do not reset to trivial play.

**What it brings:** an intentional Journey, not an accumulation of candidates.
**If omitted:** repetitive missions and unreviewed reference mismatches remain
hidden by a large content count. **Exit:** every reference/current mission has a
disposition, each adjacent mission differs meaningfully, and old editions stay
selectable. Screenshots establish geometry, not exact reference physics or fun.

### R10 — Complete final player, accessibility, performance and device acceptance

**Priority: required before claiming the whole programme complete.
Estimate: bounded 2–4-day technical workstreams plus tester/device availability.**

Human sessions must establish that players understand captures and failures,
notice mission differences and voluntarily retry. Separate keyboard, touch,
physical controller/two-controller, small-screen, muted audio, Plain/Large text,
contrast, reduced-effects, offline/recovery, memory/frame-time and rollback checks
from source inspection or automatic route results.

**What it brings:** confidence that the real experience works beyond one scripted
simulation. **If deferred:** testing builds can continue, but “fully balanced,”
“all devices supported,” and “final acceptance complete” are not justified.
Automated suites are currently waived and production testing deferred by user
instruction; this review does not restore them or invent results.

## 5. Original phase crosswalk

Every row has implemented foundations. None is marked finally accepted merely
because its first source/release exists. Historical version allocations are not
newly reserved release numbers.

| Original Journey phase | Implemented scope                                                  | Remaining closure                                                                        |
| ---------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| P00                    | Audit/crosswalk, capture teaching, direct flow/progress.           | Final 48-reference dispositions and player understanding/current flow acceptance.        |
| P01                    | Foundations, Prologue/Horizon and Studio base.                     | Useful island/return decisions, current preset pacing and onboarding acceptance.         |
| P02                    | Border/frontiers, bonuses, CRUD/manual image workflow.             | Purposeful bonus/frontier use and authoring recovery/usability.                          |
| P03                    | Signal terrain/catalogues, effective inspection and tracing study. | Hazard-neutralization quality, presentation and prototype-versus-shipped clarity.        |
| P04                    | Neon layouts and Remix.                                            | Meaningful frontier shaping; eliminate dominant low-risk bypasses.                       |
| P05                    | Rover layouts and cultural successors.                             | Useful escape networks and active reclaimed-ground pressure.                             |
| P06                    | Fracture, erosion and anchors.                                     | Meaningful repair/escape priorities without endless coverage cleanup.                    |
| P07                    | Phaseworks, pursuit/impact route combinations.                     | Fair closure races, understandable failures and gap-route choices.                       |
| P08                    | Livewire/lane attacks and later route candidates.                  | Crossing windows, warning overlap and signature-threat use.                              |
| P09                    | Relay layouts/permanent connectors.                                | Useful objective order, connector use and short post-objective tails.                    |
| P10                    | Crosswind directional zones.                                       | Route tradeoffs/precision without drift, at current difficulty.                          |
| P11                    | Sentinel/receiver/shield encounters.                               | Distinct shield approaches and current-preset boss pressure.                             |
| P12                    | Apex/finale combinations.                                          | Capstone variety and duration without a repetitive quota tail.                           |
| P13                    | 91-mission integrated library, Remixes and continuation.           | Reviewed default promotion, whole-Journey pacing/content cuts and human replay interest. |
| P14                    | Twelve pictured Team missions, impacts and specialists.            | Complementary complete play, recovery/ownership and two-person balance.                  |
| P15                    | Compatibility, provenance, release/rollback framework.             | Exercised rollback and final human/device/accessibility/performance closure.             |

The approved **spatial A–F** plan remains: A is implemented slice/inspector work
with acceptance still partial; B–D have campaign successors but unfinished quality
review/default adoption; E has Ukrainian/FPV and Team content but incomplete
cooperation/cultural acceptance; F remains final dispositions and whole-Journey
qualification. No entire campaign group is declared finished from three route receipts.

The **six FPV increments** are also partial at acceptance level:

1. Capture-stop and FPV defaults exist; full held-input/device recovery remains.
2. Versioned impacts and Original/current adapters exist; complete cross-mode
   ownership, disconnect and retained-edition qualification remains.
3. Pursuit/interception and cultural successors exist; placement/counterplay,
   erosion choices and whole-progression balance remain.
4. Directional animation/trails exist; full roster/state/playing-size review remains.
5. Shared pixel presentation/skins/typography exist; every supporting surface,
   localization and accessibility state still needs closure.
6. Team specialists and missions exist; complementary play and final human/device
   qualification remain.

## 6. Recommended batching and explicit deferrals

1. Close a bounded R1 decision, while the publisher carries merged source.
2. Deliver selected default adoption (R2), not an endless chain of opt-in candidates.
3. Repeat R3/R4 cohorts; combine geometry, necessary bonus/actor placement,
   concise evidence, reference disposition and any required artwork in one batch.
4. Prepare Team (R5) and necessary readability/recovery fixes in parallel.
5. Keep mastery awards, broad authoring expansion and cosmetic quantity behind
   playable quality; do not create new mandatory mechanics merely to add variety.
6. Continue R9 dispositions alongside each cohort; perform the deferred automated,
   human and device portions of R10 when the user restores that testing/review.

Retain these deferrals explicitly: broad new enemy systems; more missions merely
to meet a count; production adoption of unreviewed art; assisted-tracing UI;
hosted admin/account infrastructure; networking/store distribution outside the
Levels plan; and unapproved original music production. Licensed music and private
recordings have their own owner/rights gates. Do not resume paused originals or
publish private UA-FPV material as a side effect of this plan.

## 7. Concerns, ownership and reporting rules

- **Evidence gap is not a confirmed gameplay defect.** Expert failures in a few
  recipes do not prove an impossible mission; old easy clears do not prove current balance.
- **Do not optimize for fixture count.** Route evidence supports design choices;
  it is not the product outcome. The priority is distinct, fair play made available.
- **No single completion percentage or guaranteed end date.** Several plans
  overlap, their older counts differ, and final acceptance depends on people/devices.
- **Release coordination:** continuous main is live, but a named v0.150.0 release
  and reviewed default promotion remain separate. No current failing release gate
  was proven by this audit; do not repeat old capacity failures as today's blocker.
- **Capacity:** free disk was about 4.3 GiB at review start. Avoid heavy local
  builds/archive copies, installations or deletion of another owner's data.
- **Ownership:** Levels owns spatial content/routes/dispositions; actor/UX owners
  own hosts/readability; Studio owns broader authoring; soundtrack owns music;
  one publisher owns release/version/Pages mutations.
- **Status vocabulary:** authored → merged → deployed → selected by default →
  technically qualified → human accepted are different milestones. Always state
  the actual one. Preserve old levels, user media, projects, settings and releases.

This documentation-only review changes no gameplay, assets, defaults, version,
release selector or verification policy. It authorizes no new deletion and adds
no claim of tests, public play or human approval.
