# Reveal Line: completed work, remaining decisions and proposed priorities

Reviewed 1 October 2026 (Europe/Berlin). This is the current whole-product planning
review. It supersedes the queue and priority recommendations in the September 30
rollups; their evidence and historical observations remain intact. The proposed
priority changes below are for user review, not a claim of approval or a new
release allocation. No gameplay, production testing or release mutation was
performed for this review.

## What is complete, and what players can actually receive

The shared game systems are substantially implemented. The remaining programme
combines unfinished product work, already-written changes awaiting integration,
and evidence still needed to establish quality. These require different actions.

At this review's GitHub/HTTP snapshot:

- Main is `955c539a757c08c534c9038500785b20e64abb36`. Continuous Pages deployment
  [36917518659](https://github.com/mekhovov/revealline/actions/runs/36917518659)
  succeeded. The public deployment manifest and game build identity both name
  that revision; the package label is `0.142.4`. This is metadata confirmation,
  not a new public playthrough.
- The latest immutable GitHub release remains
  [v0.142.3](https://github.com/mekhovov/revealline/releases/tag/v0.142.3), published
  29 September. Milestone v0.150.0 is still planning, not a published version.
- Current main's `game/content-design/default-entry.mjs` still selects
  `whole-spatial-v25` for Solo/Versus and `team-cultural-specialist-originals-2`
  for Team. Later spatial editions being registered does not make them default.
- The root checkout was clean at this inspection, on the separately owned
  personal-best ghost branch. This review does not claim a fresh audit of every
  historical worktree or that every pushed PR is release-ready.

Completed implementation includes:

| Area            | Existing result                                                                                                                                                   | Boundary still open                                                                                                      |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Core play       | Shared capture/foundation/terrain rules; fair collision-driven ordinary enemies; specialist roles, erosion, impacts, timed bonuses; presets/admin tuning          | Whole-route fairness, meaningful placement and current all-mode qualification                                            |
| Progression     | Default Journey, unified library with retained content, Next/Skip/Continue and versioned records                                                                  | Promote selected later redesigns; verify cumulative navigation/recovery                                                  |
| Level authoring | Maps, campaigns, editions, inspectors and Studio foundations; spatial/Ukrainian redesigns including v38 restoration                                               | Finish campaign dispositions, purposeful variety and authoring round trips                                               |
| Presentation    | FPV actor defaults/options, directional rigs/rotors, trail/impact effects, shared shell and accessible text choices                                               | Playing-size/state consistency and approved final artwork                                                                |
| Team            | Twelve pictured missions, separate ownership, rescue and specialist foundations; recent input/import/tuning corrections                                           | Complementary complete routes and actual two-player acceptance                                                           |
| Discovery       | Four newer edition catalogues implement 108 arcade missions, 18 campaign finales and distinct candidate mission pictures                                          | Art approval, deeper optional interactions, combined performance/recovery; these are separate from the 91-choice Journey |
| FPV simulator   | Flight model, drills, radio mapping, calibration, replay and Studio foundations; merged #899/#901 radio/fullscreen, #904 shared UI/sound, #892 sector comparisons | Coaching, complete custom-course authoring, pending guides/ghost and physical-radio evidence                             |
| Support systems | Saves/backups, Collection, replay, media/music, optional offline infrastructure and creator tools                                                                 | Failure/restore/update/device acceptance and specific product gaps below                                                 |

The previous statement that simulator sound is wholly missing is superseded by
[PR904](https://github.com/mekhovov/revealline/pull/904). Academy, woodland and
Ukrainian courtyard demonstrations and World Studio playtest are also merged
(#887/#888/#890/#885). Their completed source should not be rebuilt as new work.
Historical counts of 242 candidates, 56 presentation sets or 36 original tracks
are planning targets, not delivered totals or mandatory filler quotas.

## Already pushed work: integrate before duplicating

All entries below were open at the snapshot. A pushed PR is not delivery.

| Input                                                                                                                                                                                                                                                                                                                                                | Player result / remaining boundary                                                                             | Proposed disposition                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#898](https://github.com/mekhovov/revealline/pull/898)                                                                                                                                                                                                                                                                                              | Random Level in selection and gameplay; mergeable at snapshot                                                  | Early small player-facing batch                                                                                                                           |
| [#906](https://github.com/mekhovov/revealline/pull/906)                                                                                                                                                                                                                                                                                              | Keep the completed picture visible; merge conflicts                                                            | Resolve and deliver with continuation polish                                                                                                              |
| [#883](https://github.com/mekhovov/revealline/pull/883)                                                                                                                                                                                                                                                                                              | 16 Neon Reference and 38 Words & Symbols maps; 27 prepared reveal images                                       | Resolve conflicts; finish chosen image bindings; inspect route quality and default exposure. PR says remaining cultural paintings/integration are pending |
| [#868](https://github.com/mekhovov/revealline/pull/868)                                                                                                                                                                                                                                                                                              | Two exact older Team imports and accurate projectile-loss explanation                                          | Draft, conflicting, retained provenance/capacity hold; refresh against new packaging                                                                      |
| [#863](https://github.com/mekhovov/revealline/pull/863)                                                                                                                                                                                                                                                                                              | Prepared-reveal reading stays in the correct input owner                                                       | Finish scoped authoring integration                                                                                                                       |
| [#894](https://github.com/mekhovov/revealline/pull/894), [#895](https://github.com/mekhovov/revealline/pull/895), [#896](https://github.com/mekhovov/revealline/pull/896), [#905](https://github.com/mekhovov/revealline/pull/905), [#907](https://github.com/mekhovov/revealline/pull/907), [#913](https://github.com/mekhovov/revealline/pull/913) | Warehouse/stadium/container demonstrations, beginner school, response overlay and optional personal-best ghost | Existing simulator work; package-size correction precedes release; avoid more parallel expansion                                                          |
| [#897](https://github.com/mekhovov/revealline/pull/897), [#903](https://github.com/mekhovov/revealline/pull/903)                                                                                                                                                                                                                                     | Restrict unknown-licence playback; optional music sources/creator links                                        | Resolve known eligibility first; #903 remains draft expansion                                                                                             |
| [#908](https://github.com/mekhovov/revealline/pull/908)                                                                                                                                                                                                                                                                                              | Optional clean Demo picture preview                                                                            | Useful optional polish; below core challenge                                                                                                              |
| [#910](https://github.com/mekhovov/revealline/pull/910), [#909](https://github.com/mekhovov/revealline/pull/909)                                                                                                                                                                                                                                     | WIP pending-cancel input; dependency update in retained verification tree                                      | Inspect actual scope before admission; neither is automatically completed gameplay work                                                                   |

## Recommended priorities and each remaining outcome

P0 means delivery/working-play risk; P1 means next player benefit; P2 means useful
follow-up; P3 means expansion that can wait. Estimates are engineering effort for
the stated bounded result, excluding queue, review and unavailable people/devices.
They overlap and must not be added into a promised full-programme deadline.

### 1. Finish delivery and package capacity — P0

**What:** integrate small ready PRs, fix actual build defects, keep the release
record aligned with continuous Pages, then publish the selected immutable batch.
**Why/benefit:** completed work becomes something players can use and roll back.
**If deferred:** improvements remain in branches and the named release trails main.
**Current blocker:** main's separate Company workflow
[36917518576](https://github.com/mekhovov/revealline/actions/runs/36917518576)
passed default capacity and edition candidates but failed optional flight package
freezing with “Complete optional source output exceeds package limits.” Main Pages
itself succeeded. #911's merged capacity correction supersedes earlier claims that
the whole live site is currently blocked. Older #868 budget figures need a fresh
candidate calculation, not automatic reuse or dismissal.
**Done:** selected source passes its applicable build/integrity gates and has an
identified deployment/release; deferred public play is explicitly still pending.
**Effort:** 0.5–2 days for one bounded correction/integration batch; diagnose the
package inventory before promising more. Source waivers are not passing suites.

### 2. Make improved levels the default experience — P1, highest gameplay return

**What:** finish Cooling loop, Pressure ladder and Switchback exchange review,
then compose a reviewed default successor retaining old selectable editions.
Expert Cooling/Switchback lack complete-route receipts; Pressure's waiting and
Switchback's early objective completion warrant review. Failed probes do not
prove impossibility. Include both controls/presets and two credible approaches.
**Why/benefit:** ordinary players finally encounter the prepared spatial challenge.
**If deferred:** the normal game stays on v25 even as later candidates accumulate.
**Done:** meaningful threats, safe departures and useful route choices; no tedious
quota tail; default/Next/Skip/Continue use the selected revision. While human review
is deferred, label the result balance-review pending.
**Effort:** 1–3 days for the cohort review, then 0.5–1 day for default integration,
plus delivery. Do not blindly make every latest edition the default.

### 3. Finish varied Ukrainian/Xposed-style campaigns — P1, ongoing small cohorts

**What:** redesign 3–5 neighboring missions at a time using real walls, unequal
bays, broken ornament lattices, constrained crossings and useful capture order.
Use existing pursuit/interception, erosion, frontier roles and optional timed
bonuses deliberately. Finish #883's selected content rather than duplicate it.
Update all 48 reference dispositions and campaign ordering as each cohort lands.
**Why/benefit:** players need different decisions, not the same large safe cut.
**If deferred:** new pictures/enemy counts alone may leave repetitive easy play.
**Done:** each mission has two approaches, a distinct signature decision and useful
capture consequences; adjoining campaigns do not reset to trivial difficulty.
Retain cultural provenance and prior editions; avoid invented universal symbolism.
**Effort:** 3–7 days per polished cohort, including placement/bonus review; final
ledger pass 1–2 days. Entire remaining campaign coverage needs a fresh disposition
inventory before a credible total estimate. No additional enemy engine is needed.

### 4. Finish readable characters and action feedback — P1 defects, P2 expansion

**What:** inspect existing bodies at actual playing size, movement headings and
warning/attack/recovery/frozen/downed states. Finish rig metadata, contact cues,
light/dark picture contrast, trails, travelling impacts and Team identity cues.
Review optional larger body/propeller candidates through explicit adoption.
**Why/benefit:** players understand danger, timing and the reason for a loss.
**If deferred:** fair mechanics can feel unfair; small/decorative sprites can hide
essential information. Correct animation alone does not settle size/proportion.
**Done:** clear roles across modes and reduced effects without changing hitboxes.
**Effort:** 0.5–2 days per defect; 3–5 days for one roster cohort. Fix readability
before commissioning all outstanding cosmetic sets.

### 5. Make Team cooperation worthwhile — P1 after first Solo cohort

**What:** design complementary complete routes: one player opens a useful return
or neutralizes a threat for the other. Finish simultaneous cuts, partner fills,
rescue, reconnect and cut-owner isolation; resolve exact import work in #868.
**Why/benefit:** both players contribute rather than one carrying the session.
**If deferred:** couch mode remains usable within current evidence but its richer
cooperation and all twelve missions' balance are unproven.
**Done:** two useful roles and reliable recovery in selected missions, followed
by actual two-person/controller review when available.
**Effort:** 2–4 days per small Team cohort; device/player time is additional.

### 6. Reliable start, save, download and return — P0 reproduced failures, P1 gaps

**What:** close known selection/launch and media restoration gaps; finish failed,
cancelled or stale preparation; preserve the working attempt and exact opener.
Cover backup replacement, retained pictures, quota/denied storage, interrupted
updates, multi-window ownership, offline launch and partial music/SFX downloads.
The reported PNG/JPEG Retry issue lacks a newer explicit closure receipt in the
reviewed register; reproduce or locate evidence before declaring it fixed.
**Why/benefit:** the player can keep playing and trust saved work and rewards.
**If deferred:** a single broken launch/update can erase the benefit of good maps;
unverified cases must not be described as demonstrated current defects.
**Done:** scoped failure and restoration journeys preserve usable content/data.
**Effort:** 0.5–2 days per known defect; 2–4 days per bounded lifecycle review.
Cold iPhone Home Screen evidence requires the actual device and remains deferred.

### 7. Finish native-feeling navigation and accessibility — P1 practical failures

**What:** complete mouse-free/controller/touch journeys through Play, selector,
Pause, Settings, tools and Back; preserve focus and explicit Resume. Check EN/UK,
Plain/Large, 200% zoom, forced colors, reduced effects and compact safe areas.
Community directory/input and specialist creator paths need current qualification.
**Why/benefit:** playing feels direct on the advertised input and screen.
**If deferred:** most screens may work while an occasional dialog traps focus or
hides an action. Extra animated menu scenery is a separate, lower-value task.
**Done:** the selected whole journey works, including failure and return states.
**Effort:** 0.5–2 days per defect; 2–4 days for a selected cross-mode matrix.

### 8. Finish dependable Studio and independent authoring — P1 blockers, P2 breadth

**What:** complete create/edit/preview/export/import/play/recover with exact media,
undo/history, inherited rules and actual mode support; finish #863. Have an
independent fresh workspace reproduce a pack using the existing guides and CLI.
Keep manual image upload/overlay useful; assisted tracing is a separate optional
prototype-to-product effort. Local tuning is not a hosted multi-user admin service.
**Why/benefit:** you can maintain levels without developer-only recovery steps.
**If deferred:** creators can lose time or receive misleading previews; ordinary
play need not wait for every advanced editor control.
**Done:** a real pack round trip and recovery preserve identity and original bytes.
**Effort:** 0.5–2 days per defect; 1–2 days for independent reproduction after fixes.

### 9. Finish FPV simulator learning and course authoring — P2 for this arcade goal

**What:** deliver the already-pushed demos/school/ghost/response overlay after
package repair. Add advice based on the player's actual attempt; complete custom
course cues, permitted modes and selected-media rewards through existing systems.
Verify the optional stick preference rather than reimplementing merged radio/UI
work. A development World Studio playtest does not close all Flight Studio tasks.
**Why/benefit:** simulator practice teaches corrections and authors can make complete
courses. **If deferred:** the simulator remains a secondary feature with weaker
teaching; it does not block improving Xonix challenge.
**Done:** compatible comparisons and actionable advice, plus the full custom-course
export/import/completion/revisit loop. Physical radio coverage stays separate.
**Effort:** 1–3 days for coaching; 3–6 days for a scoped full authoring slice;
pending PR delivery effort is included in item 1, not counted again here.

### 10. Finish one coherent Ukrainian/FPV art and music cohort — P2

**What:** finish selected prepared pictures and bindings; review native pixel
clusters, composition, cultural accuracy and actor contrast. Preserve originals
and earned versions. Complete rights admission for music and mute/transition/
warning-audibility checks; #897 addresses known public eligibility scope.
**Why/benefit:** distinctive reveals and sound give accepted missions an identity.
**If deferred:** candidate art stays unapproved and some presentation remains shared;
this does not justify claiming existing art is absent. Unknown-rights sources need
their own eligibility correction, independent of commissioning more tracks.
**Done:** one selected cohort is approved, bound and stable through Retry/Collection.
**Effort:** 2–4 days per prepared picture cohort after review resumes; audio fixes
0.5–2 days each. Original 36-composition production remains paused, with no total ETA.

### 11. Finish discovery/reward depth and presentation — P2 selective enrichment

**What:** qualify existing first-win/finale/Collection flows and selected worked
discoveries. Finish intended edition marks/scenes where appropriate, exact reward
restoration, and source-attributed performance/resource checks. Expand meaningful
interactions only where useful; all 108 missions do not need a new minigame.
**Why/benefit:** revealing a picture leads to a worthwhile optional discovery.
**If deferred:** catalogue/reward foundations remain, but some lessons are shallow
and new editions use fallback identity. Reward blocking/data loss goes to item 6.
**Done:** one selected campaign gives correct rewards, meaningful optional content
and a clean revisit without slowing Next or forcing a lesson.
**Effort:** 2–4 days per small enrichment cohort; performance/restore defects estimated
after reproduction. No new 108-mission production quota.

### 12. Reduce downloads and reclaim storage safely — P1 actual capacity, P2 polish

**What:** refresh ownership/size inventories; externalize repeated embedded art into
verified binary assets, split necessary mode/chapter dependencies, and add precise
save/replay/reward-aware cleanup. Lossless WebP/rendition work follows compatibility
contracts and measured benefit; procedural pilot evaluation joins item 3.
**Why/benefit:** smaller selected downloads, lower parsing/memory cost and useful
space recovery. **If deferred:** more storage/download friction and blocked larger
packages; speculative compression savings must not determine commitments.
**Done:** measured savings with unchanged outcomes, retained originals and complete
online/offline dependencies. Optional extras fail independently of core play.
**Effort:** 2–5 days per bounded packaging change; 2–4 days for scoped safe cleanup.
Do not silently remove media or raise budgets to pass.

### 13. Add honest optional mastery awards — P2/P3

**What:** define and verify selected mission-specific conditions, keeping practice
text distinct from awarded achievements. Existing no-loss proof does not implement
every newer gap/erosion goal. Keep rewards independent of unlocking core missions.
**Why/benefit:** skilled players get reasons to replay an already enjoyable level.
**If deferred:** normal progression works; leave unsupported goals labelled practice.
**Done:** one exact condition matches authored text, replay evidence and saved award.
**Effort:** 1–3 days per first scoped condition. Basic challenge comes first.

### 14. Establish whole-game quality — required for final completion, currently deferred

**What:** integrated performance/memory, update/offline/rollback, accessibility and
physical-device journeys; then consented newcomer/experienced-player sessions on
capture understanding, failures, mission differences and voluntary Retry.
**Why/benefit:** demonstrates that the combined game works and people enjoy it.
**If deferred:** development/test releases can continue, but final balance, all-device
support and complete original P13–P15/P18 acceptance remain unproven.
**Done:** attributable current evidence and resulting fixes, with genuine human and
physical-device observations separated from simulation/browser automation.
**Effort:** 4–7 technical working days plus devices; 2–3 days for formal sessions
plus recruitment. Respect the user's production-testing deferral and C2-last order.

### 15. Broader platforms, communities and new content — P3, separate decisions

- **Native desktop/iOS/Steam:** package/stage/build/sign/install and prove lifecycle
  on hardware. Benefit: distribution convenience. Deferral: browser remains the
  supported route. Old native payload excess needs fresh sizing after packaging
  changes. Estimate only after selecting one platform and available signing/device
  environment; no credible combined ETA yet.
- **Hosted community/accounts/admin:** choose hosting, identity, storage and actual
  two-user flows. Benefit: sharing beyond local packs. Deferral: local authoring
  remains useful, hosted collaboration unfinished. Environment-dependent estimate.
- **Network multiplayer:** authoritative sessions, reconnect and fairness. Benefit:
  remote play. Deferral: couch modes continue. Separate substantial project, not
  an outstanding small fix to the existing Team engine.
- **More themed campaigns, broad art/music replacement, new enemy engines,
  assisted tracing and decorative menu layers:** preserve as optional backlog.
  Benefit depends on demonstrated gaps. Deferral gives time to finish current play.
  Estimate one selected cohort/prototype, not the entire historical wish list.

## Proposed next batches for review

1. **Delivery batch:** resolve selected PR conflicts/capacity and ship Random Level,
   victory-picture continuity and any reproduced launch/save issue. Keep the
   simulator capacity fix bounded and preserve the single publisher.
2. **Visible challenge batch:** finish the three pressure maps and deliberately
   promote the accepted successor. Integrate a manageable portion of prepared
   Ukrainian/Neon content with accurate artwork/quality labels.
3. **Quality batch:** readability and friction defects found in those maps, then
   a small complementary Team cohort. Continue campaign dispositions with each
   map batch rather than postponing all pacing work to a final audit.
4. **Authoring/content follow-up:** necessary Studio/recovery/packaging fixes and
   one approved art cohort. Optional mastery, learning depth and simulator expansion
   follow according to the user's chosen emphasis.
5. **Final qualification:** remains explicitly deferred; schedule when the user
   restores production/device/human testing. No current test waiver is revoked here.

This is a proposed refinement of the earlier A/C3 → B/C4 → C/C5+C6 → C7 → C2
order: active readability/reliability failures remain urgent, while additional
cosmetic roster production yields to improving the default spatial challenge.
No priority change or deferred review is silently marked approved.

## Evidence and original-plan accounting

- Current source, open/merged PRs, latest release and CI were inspected with GitHub;
  only public metadata endpoints were fetched. No game suite or build was run.
- [Delivery history](delivery-status.md), [Levels detail](levels-plan-review-2026-09-30.md),
  [native menus](native-menu-roadmap.md), [character plan](character-game-feel-plan.md),
  [discovery/simulator](polished-journeys-current-plan.md),
  [offline detail](content-offline/PLAN-REVIEW-2026-09-30.md),
  [soundtrack](soundtrack-library.md) preserve detailed completion criteria.
- Original Journey P00–P15 and whole-game P00–P18 are different programmes. Their
  framework stages are implemented in substantial parts; campaign production,
  whole-Journey pacing, Team balance and final acceptance remain partial. There is
  no defensible whole-programme completion percentage.
- Known current constraints: conflicting #883/#906/#868; failed optional-flight
  package size; draft art/music/import work; deferred production/human/device
  review. Historical capacity numbers are evidence at their old revisions, not
  measurements of today's site. The full remaining programme has no defensible
  calendar completion date until scope and deferred validation are selected.
