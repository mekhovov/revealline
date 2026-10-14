# Team and Duel expansion: completion review and proposed priorities

Review prepared 14 October 2026, 18:08 CEST. Source: `23a91fc4ae7f1fa78212f09b1f74dac7da683215`, [PR #1229](https://github.com/mekhovov/revealline/pull/1229). This was the priority review presented to the user; the later instruction to continue authorized the source follow-up. See [follow-up verification](team-duel-expansion-followup-2026-10-14.md) for the resulting changes. The inventory and CI snapshot below remain historical. Human playtesting remains explicitly waived. Production review and physical qualification remain deferred for source work.

**Recommendation: finish source integration, then strengthen recovery, readability and creator portability before adding another wave of levels.** The content-count objective is met. The largest remaining uncertainties concern imperfect play, the complete creator workflow and real devices.

**What is complete**

| Planned area          | Delivered                                                                                                                                                             | Limit of the evidence                                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Baseline and plan     | Main integration, mode inventory, first-party design research and phased plan                                                                                         | Original duration estimates are historical, not remaining estimates                                                        |
| New content           | 96 Team and 72 Duel missions in twelve families; current library totals 110 Team / 312 Duel                                                                           | Distinct geometry and decision briefs do not prove perceived variety                                                       |
| Mechanics             | Team lane warnings, relay gates, currents, perimeter patrols, local erosion and sequential targets; Duel uses its supported native contracts                          | Team adaptations deliberately differ from full Solo frontier patrol and Sentinel combat                                    |
| Authoring             | Editable sources, Team environment editor, shared preview/play markers, source snapshot caching, save/reload, Undo/Redo, source export/import and artwork replacement | Complete actor/texture/audio replacement and fresh-install recovery remain only partially covered                          |
| Presentation          | Existing pictures, textures, animation/event slots and sound bindings; EN/UK copy; compact objective display and menu-launch fixes                                    | Reuses 77 existing pictures; no new original artwork or soundtrack is claimed                                              |
| Gameplay verification | 576 Team role-assignment runs; 1,296 Duel runs across difficulties, steering, both winning seats and equal-input draws                                                | Scripted successful routes; not every failure, recovery or competing strategy                                              |
| Distribution          | 24 offline chapter groups; earlier full package/ZIP; all chapter dependency audit; three chapter downloads reopened offline                                           | Package predates final main integration; physical targets and complete offline chapter journeys remain unqualified         |
| Delivery              | Changes committed, pushed and PR #1229 open                                                                                                                           | At the review cutoff, checks were still running, merge/public delivery were unconfirmed, and auto-merge was not configured |

The core level and mechanic deliverables of phases P0–P5 are delivered. Supplemental-campaign discovery and the full creator-media workflow remain partial, and the original human/device exit criteria are not all satisfied. P6 is partial. Calling the entire original plan complete would overstate the evidence.

The original plan also proposed chapter-sized PRs and incremental publication. Delivery instead consolidated all twelve families into one expansion PR. That increases review and rollback scope. Review the existing PR by content, simulation, Studio and distribution changes, and keep follow-up fixes small; splitting the current PR solely to recreate the original sequence is not the recommended next task.

**Proposed order**

| ID  | Remaining work                                        | Recommendation                                  | Reason                                                                                      |
| --- | ----------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------- |
| R1  | Complete PR checks and source integration             | Now                                             | The delivered implementation must reach main with its required checks                       |
| R2  | Recovery, support and simultaneous-event verification | Next, first                                     | Prevents rare but disruptive multiplayer failures                                           |
| R3  | All-chapter readability and navigation review         | Next, second                                    | Makes goals and danger understandable across the expanded catalogue                         |
| R4  | Complete Studio/media round trip                      | Next, third; first if creators are the audience | Directly completes the requested compatibility promise                                      |
| R5  | Strategy and progression audit                        | Next, fourth                                    | Tests whether authored choices work beyond one known solution                               |
| R6  | Resolve the five existing test failures               | Later bounded cleanup; promote if they block R1 | Restores useful regression signals without conflating unrelated defects with this expansion |
| R7  | Curate existing supplemental campaigns                | Later                                           | Adds discoverable variety without authoring more levels                                     |
| R8  | Final-source package and public delivery verification | When publication is scheduled                   | Establishes that the public/offline product contains the integrated changes                 |
| R9  | Physical controller, touch and handheld qualification | Deferred; promote for a target-platform launch  | Confirms actual input and device lifecycle behavior                                         |
| R10 | Target-device performance and storage measurements    | Deferred; promote for lower-end/mobile targets  | Protects responsiveness and reliable installation                                           |
| R11 | Audible cue and mix review                            | Deferred                                        | Confirms that warnings can actually be heard and distinguished                              |
| R12 | Paired human balance/enjoyment study                  | Waived; keep waived                             | Explicit user decision; automated evidence cannot substitute for it                         |

**R1 — Complete PR checks and integrate the source**

Check the final PR revision's required result, resolve any expansion-caused failures and conflicts, then complete the normal merge process. PR #1229 is open and conflict-free at the cutoff. Several hosted checks passed; others remain running. It has no automatic merge request, label or milestone at this snapshot, so it should not be described as guaranteed to merge automatically. Confirm whichever repository admission route applies rather than assuming metadata alone is authorization.

This brings the new content into the shared development baseline and prevents future work from depending on an isolated branch. Deferring leaves the content available locally and in the PR but not integrated. Completion means a recorded merge commit and successful required source checks. Public deployment is R8, a separate result. Scope is small if checks pass, variable if defects appear.

**R2 — Exercise imperfect play and interacting mechanics**

Add bounded scenarios using actual expansion levels: one player downed while a relay opens; early/late rescue around erosion; two exposed cuts under warning pressure; support abilities used during those events; stage completion while another event resolves; both Duel players racing different legal routes, losing or finishing nearly together. Preserve useful existing core tests; focus new coverage on untested combinations.

The 576 Team clears require both pilots to close cuts and exchange support-role assignments, but their recorded commands keep boost/support off and assert no player is downed. The Duel outcome matrix uses identical routes for draws or a moving winner against an idle rival. Existing environment and legacy tests cover individual failures and adjudication; the matrix is not exhaustive interaction coverage. This is an evidence gap, not a demonstrated defect.

The benefit is reliable rescue, shared progress and fair results when play deviates from a rehearsed route. Deferral risks rare stranded attempts, confusing support interactions or contested outcomes escaping detection. Done means reproducible legal-input cases for relevant mechanic combinations and retained replay results. Initial scope is medium and can be split by mechanic family.

**R3 — Review readability and navigation across every chapter**

Sample the introduction and most visually demanding level from each family in both modes. Check desktop, portrait and landscape; English/Ukrainian; large/plain text; reduced effects; player-number/shape distinction; warning, gate, erosion and stage states. Follow selection → briefing → play → pause → result → Next/Retry with keyboard navigation. Exercise supported assistive-technology paths separately before making accessibility claims.

We have focused browser evidence, including a real mobile objective bug found and fixed. That does not cover every chapter, theme and state. This work makes the increased content understandable and prevents controls, warnings or objectives disappearing in specific combinations. Without it, a solvable mission can still feel unfair or be unusable for some players. Done means a compact chapter matrix, captured failures and fixes, with actual assistive/device limits retained. Medium scope.

Color-independent shapes and complementary cue channels are consistent with [Xbox XAG 103](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/103). That guidance informs the review; it is not a claim of certification.

**R4 — Finish the complete Studio/media recovery workflow**

Use representative simple and advanced Team/Duel chapters to edit a level, swap terrain/actor presentation, change a sound binding, preview both seats, save and export the actual companion media, then restore into a fresh profile. Check launch, Next, Retry and offline reopen. Exercise missing/corrupt assets, cancelled preparation and storage failure while retaining the previous working content. Confirm custom artwork stays custom in a company/community edition.

Source round trips and background-picture replacement already pass. They do not establish the entire Asset/Theme/Sound Studio pipeline or full media recovery on another installation. This completes the creator promise: an edited chapter can be transported and recovered with its intended appearance and sound. Deferral risks source files that import correctly while media is missing, silently replaced or unavailable offline. Done means recovered bytes/identities and successful real-host launches, with portable backups containing the documented dependencies. Medium-to-large scope; complete local browser coverage before scheduling physical targets.

**R5 — Verify meaningful choices and progression without reopening human playtesting**

Inspect the shortest solved levels and the closest layout pairs first. Establish alternative useful routes for the eight pilots and representative chapter challenges, test different capture orders and quantify each pilot's practical contribution. Check the intended teaching → combination → finale progression. Rewrite a layout or briefing only when the review identifies a specific weak decision.

All 168 topologies are distinct under exact/reflected/rotated comparison. The closest pair has 87.6% occupied-cell overlap but different mechanics. That metric alone does not mean the pair is bad. Likewise, Team scripted clears of 4.4–86.8 seconds and Duel clears of 5.3–108.9 seconds do not establish human pacing. The original 2–5 minute Team / 45–150 second Duel targets remain hypotheses.

This brings stronger evidence for strategic variety and useful cooperation. Deferral risks dominant shortcuts, ineffective alternative routes or uneven difficulty. Done means a reviewed route/teaching matrix and targeted fixes, not artificially lengthened levels or claims about enjoyment. Medium initial sample; broader changes depend on findings.

**R6 — Repair the five known baseline test failures**

Investigate one standalone actor fixture lacking a real browser image decoder, two tests expecting older reader-focus behavior, and two tests expecting 71 soundtrack records when the catalogue has 77. Establish the intended contracts before changing fixtures; use a suitable decoder-capable test boundary rather than fabricating decoding success.

These failures also reproduced with exact main-module bytes. They are not established expansion regressions. Repair improves confidence in subsequent changes and reduces the temptation to dismiss future failures as noise. Deferral leaves known red results that can obscure new problems. Done means each case either passes against the intended behavior or has an explicit, justified environment boundary. Small-to-medium scope; raise priority immediately if a required gate depends on it.

**R7 — Finish supplemental-campaign discovery**

The original MP-01/P3 plan included reviewing existing Pursuit/Hunt chapters for ordinary library exposure. They were inventoried, but the reviewed default Team adapters add the expedition, existing Journey and Classic sources; they do not establish blanket admission of the supplemental catalogue. Direct entry to a supplemental route is not the same as curated discovery from the default library.

Audit eligibility, artwork, launch and offline ownership first, then expose qualified chapters with clear distinctions and no duplicate counting. This offers additional enemy/chase variety at lower content-authoring cost. Deferral leaves useful existing work harder to find; it does not remove any of the 168 new missions. Done means a documented allowlist and correctly owned library launches. Medium scope, lower urgency than R2–R5.

**R8 — Verify the integrated package and public delivery**

Use the existing publisher when a release is scheduled. Build/qualify the exact integrated source, verify its chapter/media inventory and budgets, test representative install/update/offline journeys from that artifact, and confirm the deployed revision and playable entry points. Expand offline browser coverage beyond the three chapters already exercised, with emphasis on distinct mechanics and dependency types.

The earlier full package and ZIP passed, but predate final main integration. Hosted full test/build jobs are skipped under current source-gate policy; a green focused gate does not itself establish a new complete distribution. Avoid a competing version or duplicate publishing route.

This brings the actual expansion to public players with traceable assets. Deferral means public availability and final-artifact recovery remain unconfirmed even after source merge. Done means exact-source artifact and deployment evidence plus scoped player journeys. Variable scope and publisher queue time. This remains separate from source-work priorities under the earlier production-review deferral.

**R9 — Physical controls and handheld behavior**

On the intended supported devices, test two controllers, mixed keyboard/controller input, connection loss/reconnection, input ownership, pause/resume, native foreground/background transitions, touch zones, orientation and safe areas. Include shared play with both players acting together.

Browser width changes and synthetic controller tests cannot establish actual hardware behavior. This brings confidence that the intended couch/mobile experience works outside the desktop browser. Deferral leaves device-specific risks such as seat reassignment, missed input or inaccessible touch controls. Done means a named device/input matrix with recorded results and limitations. Hardware-dependent; do not make it a source-merge prerequisite. [Xbox XAG 107](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/107) supports checking usable input paths and orientation rather than treating visual resizing as input qualification.

**R10 — Performance, decoded memory and storage pressure**

Measure cold launch, mission switching, frame-time consistency during simultaneous effects, decoded image memory, installed chapter size and recovery under low storage on representative targets. Start with advanced finales and the heaviest media chapters. Compare with the existing budgets before changing limits or sacrificing artwork quality.

The measured 68.3 MiB offline core fits its 80 MiB budget. That does not measure peak decoded memory or frame pacing. Likewise, reused source artwork totals are not per-level memory consumption. This work brings responsive controls and predictable downloads. Deferral risks stutter, slow transitions or storage-related failures on lower-end devices. Done means reproducible measurements and explicit target budgets; no blanket optimization without evidence. Browser storage can be evicted and writes can fail at quota, so portable recovery remains relevant even when one install succeeds. [MDN storage guidance](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

**R11 — Listen to warnings and the shared mix**

Listen to overlapping lane/erosion warnings, support/rescue, relay openings, stage changes and results with music on/off, small speakers and mono output. Check cue distinction, relative volume, repeated-event fatigue and duplicate playback from the two Duel boards. Use Sound Studio for targeted corrections and preserve visual alternatives.

Tests establish event bindings; the browser sessions were muted. This work brings warnings players can perceive in time and a less confusing shared soundscape. Deferral risks inaudible or indistinguishable dangers despite correct event code. Done means a recorded listening matrix and verified adjustments. Small-to-medium scope requiring audible access; currently deferred. Complementary visual/audio information follows [XAG 103](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/103).

**R12 — Human-pair balance and enjoyment: waived**

If reopened later, use novice, mixed-experience and experienced pairs to assess cooperation, idle time, fairness, teaching, difficulty and desire to replay. That would validate the experience the original plan aimed for, including whether the fastest routes or similar layouts are actually problematic.

Keeping the waiver means those subjective outcomes remain unknown. It does not invalidate the completed source or reproducible clears. No human study is scheduled or required by this proposed order; only a new user decision would reopen it.

**Scope choices for review**

More levels, newly commissioned art/music, full Solo-style frontier patrol/Sentinel ports, moving walls, opponent interference and a Duel finish replay are potential follow-ups, not unfinished commitments of this bounded expansion. Existing-art reuse and bounded Team adaptations were explicit plan decisions. Keep these below R2–R5 unless a specific product need changes the scope.

The recommended next sequence is **R1 → R2 → R3 → R4 → R5**, with R6 as bounded maintenance and R7 afterward. For a creator-first release, move R4 immediately after R1. For a near-term mobile/controller release, promote R9/R10 and coordinate R8/R11 with that launch. Keep R12 waived. No new all-platform qualification gate or broad full-suite restoration is proposed.

Evidence: [implementation plan](team-duel-expansion-plan-2026-10-14.md), [delivery register](team-duel-expansion-status.md), [authoring guide](../authoring/multiplayer-expeditions.md), [Team route checks](../game/test/multiplayer-expansion-routes.test.mjs), [Duel route checks](../game/test/duel-expansion-routes.test.mjs), [environment checks](../game/test/coop-expedition-environment.test.mjs), [Studio artwork checks](../game/test/multiplayer-expansion-media.test.mjs), [near-layout review](research/multiplayer-near-geometry-review.json), [distribution receipt](research/multiplayer-distribution-verification.json). PR/CI observations are a dated snapshot, not a promise about later status.
