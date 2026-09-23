# Reveal Line — completed work and remaining delivery plan

Status checked **23 September 2026, 00:00 UTC**. This is the current status and
priority register for the approved Xposed-led Journey and unified-library plan.
It supersedes older status/queue paragraphs, not their design contracts, source
observations or release evidence. The original P00–P15 version allocations are
historical estimates, not a record of what each later release contains.

## 1. Summary

- **Live and publicly accepted: v0.86.0.** The ordinary Pages release marker
  identifies source `c311e91b886c55039cda6e335a7408de8650110f`.
- **In release promotion: v0.87.0.** PR279 is merged and the immutable GitHub
  release is published. At this check, Pages still serves v0.86.0; v0.87.0 is
  therefore not marked delivered to normal players.
- Default redesigned Journey, the unified tagged mission selector, safer backup
  replacement, main-menu difficulty and global local-browser playtest controls
  are delivered features.
- The soundtrack framework and simplified player controls are delivered with 70
  cleared creator recordings across 15 hosted albums. The 77 distinct UA-FPV
  recordings are verified as private local imports, not public assets. The
  original-music milestone remains 0 of 36 approved recordings.
- The whole redesign is **not complete**. P00–P15 have implementation and scoped
  evidence, but each retains balance, content-review or qualification work.
- Do not give a misleading overall percentage: released functionality, candidate
  content and final human/device acceptance are different kinds of completion.

## 2. Completed and publicly delivered

| Item                                 | Delivered result                                                                                                                                                        | Release / evidence                                                                                                          |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Redesign integration checkpoint      | Combined redesigned Journey source, original mission pictures and retained historical editions                                                                          | v0.82.0 / v0.82.1 accepted checkpoints; not whole-plan balance approval                                                     |
| Release A: new Journey by default    | Ordinary Solo and Versus use the 91-mission Journey; Team uses its separately authored 12 missions. Old selections no longer determine the default                      | v0.83.0, PR263; Pages run35775874062; public first-capture/clear/Next in all three modes                                    |
| Release B: one mission library       | All / Journey / Classic / Custom, provenance-aware identity, same-screen search/filter/readiness and owner-specific launch/progression; old content retained            | v0.84.0, PR268 / selector274; public library201 Solo /201 Versus /14 Team before device-specific Custom additions           |
| Safer game-data replacement          | Explicit Keep/Replace review, source/destination checks, verified Undo where available, pending mastery-write protection and Restore focus                              | v0.85.0, PR275 / selector277; public availability accepted. Full recovery failure/device matrix is not closed               |
| Real difficulty and visible controls | Presets affect enemy pressure as well as lives; difficulty is on the main menu; bounded enemy/craft/density testing overrides and Reset are available across Solo/Couch | v0.86.0, PR278 / selector280; scoped public title/difficulty visibility and navigation accepted                             |
| Safe tuning identity                 | Fresh attempts receive versioned rules; active/restored attempts keep their recorded rules. Non-default admin playtests do not award normal progression                 | v0.86.0 source verification; historical gp1 preservation is extended by v0.87.0                                             |
| Continuous delivery and preservation | Reviewed source PRs, immutable releases, separate Pages selection, previous-version archives and public checks                                                          | Working pipeline; v0.86.0 main audit3917 files /615005113 bytes, zero final failures/skips, two recovered503 first attempts |

The v0.83.0 full suite passed11788 tests. Subsequent expedited releases used the
user-authorized automated-suite waiver. Skipped suites are not passes. Public
verification is bounded: a release being delivered does not certify every mission,
physical controller, mobile device, offline journey or human balance outcome.

## 3. Implemented content and framework, with acceptance still open

These capabilities are present in the integrated Journey or documented candidate
editions; this table does not promote every study or open PR into the default game.

| Capability              | Implemented scope                                                                                                                                                                                      | Still needed                                                                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared rules / geometry | Enemy-retained four-connected capture, foundations/interior spawns, terrain neutralization/erosion, relay connectors and directional fields                                                            | Human prediction of capture, map-specific route usefulness and current-speed regression review                                                                         |
| Content library         | 91 Journey Solo/Versus missions =71 core +12 Remixes +8 optional ornament/workshop missions;12 purpose-built Team missions;110 retained Classic Solo entries and2 legacy Team arenas                   | Whole-campaign pacing, weak-map cuts/fixes and mode-specific acceptance; counts are not quality evidence                                                               |
| Reference audit         | 110 old Solo missions and64 supplied files audited;48 numbered references have66 declared adaptation links                                                                                             | Final keep/merge/redesign/reject dispositions for all48; selected-edition audit correctionPR260 remains open                                                           |
| Timed bonuses           | Announce, appear, expire, cooldown, eligible relocation, contact collection and deterministic state; integrated Border schedules and separate Team studies                                             | Broader timing/temptation, Depot both-active-rover mastery, human/controller review; not every mission has a timed pickup                                              |
| Ukrainian / FPV variety | Eight original-picture ornament/workshop studies exposed as two optional four-mission sequences                                                                                                        | Cultural/readability review, current-speed balance, useful additional designs and Team adaptation                                                                      |
| Studio / administration | Shared map/mission/campaign/pack compiler; create/duplicate/edit/reorder/archive/restore, copy-on-write, undo/checkpoints, preview/diagnostics and image overlay with manual geometry / explicit Apply | Open Studio usability/history/recovery PRs, crash/storage/device/accessibility qualification. Assisted tracing is a benchmark prototype, not shipped Studio automation |
| Enemy variety           | Existing perimeter/frontier/field/reclaimed-ground roles, erosion, trail impact, lane attacks and staged encounters                                                                                    | Optional scout/sentry host toggle, presentation/audio and Team semantics remain separate unfinished work                                                               |
| Art and feedback        | Mission originals, campaign presentation studies, shared functional cues and optional caption reactions                                                                                                | Complete theme/role treatments, listening and real-size human readability review; new original music production remains paused                                         |

**Accounting:**242 Solo candidates is a planning target, not shipped content or a
filler quota. The91 Journey missions already include the12 Remixes; do not count
them twice. Alternate artwork, presets and reference links are not new maps.
The older11-themed-campaign /132-mission programme is not completed by these
counts and is not silently added to the immediate release queue.

## 4. In progress: v0.87.0 Xposed-paced defaults

Completed for this release:

- PR279 merged as `08548aeabe72f396fb75aede938d5bcadcfdc00e`, preserving
  publication-controller history. Runtime/tests match reviewed head`ca0f4469`.
- Shared gp2 starting targets: craft0.26, ordinary field keeper0.325 and boundary
  patrol0.24 original short-field lengths/second. Standard preserves authored
  enemy counts; main-menu difficulty and global playtest overrides remain.
- Two gameplay recordings measured; rates are approximations, not recovered
  Xposed source constants or measurements of every enemy type.
- Frozen gp1 adapter preserves historical save/replay reconstruction. Existing
  attempts are not silently retuned; unmeasured attack roles retain prior pressure.
- Independent exact-head review and34 focused tests passed. PR35794493627 and
  merged qualification/freeze35797883977 succeeded; long suites were waived.
- Immutable GitHub releasev0.87.0 published at2026-09-22T23:56:29Z.

Remaining before calling v0.87.0 delivered:

1. Finish previous-release archive preservation/admission for the new selector.
2. Promote the reviewed Pages selector and obtain successful production deployment.
3. Verify the public release marker/source and required public asset integrity.
4. Complete the assigned bounded native/public availability checks; record any
   explicitly waived gameplay checks as deferred, never passed.
5. Publish the acceptance receipt and update this register to Delivered.

Owner: sole publisher, with the existing Pages coordinator and native acceptance
owner. No competing tags, asset uploads or deployments. Estimated remaining
elapsed time: **1–3 hours if release/archive gates pass first time**, not a promise.

**New qualification obligation:** old gp1/pressure-v2 scripted clear routes do not
prove gp2 balance or even unchanged route feasibility. Reassess current-speed
missions after delivery; do not relabel historical498-route evidence as gp2 proof.

## 5. Remaining work, in priority order

Estimates are focused effort after starting, not deadlines or additive promises.
Release/CI queues and human/device availability can extend elapsed time. Finish
one user-visible slice per reviewed PR/release rather than accumulating a large diff.

| Priority     | Item / current state                                                   | Completion condition                                                                                                                                                                                | Indicative effort                                                |
| ------------ | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| P0           | Finish v0.87.0 promotion                                               | Gates in section4, actual default Pages build verified                                                                                                                                              | 1–3h conditional elapsed                                         |
| P1           | PNG/JPEG mission-selection failure — unresolved                        | Identify affected mission/mode/asset and reproduce; repair actual cause; public Download/Retry/Play succeeds without deleting media or bypassing validation                                         | 2–4h diagnosis;3–8h scoped repair once reproducible              |
| P1           | Current-speed difficulty/pacing review                                 | Representative early/middle/late Solo/Versus/Team routes; fair departures, enemy/craft ratios, useful geometry and no trivial one-cut bypasses outside teaching. Human feedback recorded separately | 1–3 days first pass;6–12h per map-fix release                    |
| P2           | Remaining save warnings, recovery focus and session-only continuity    | Recheck latest accepted source; close only still-reproducible gaps, including two-tab ownership/Next and failed-save recovery                                                                       | 6–10h per bounded slice                                          |
| P2           | Ready/download/replay usability — PR230/231/234                        | Same-page retry, preserved readiness/selection and visible opener focus; replay preferences restore after Back                                                                                      | 3–6h each after dependency reconciliation                        |
| P2           | Retained-media/presentation recovery — PR256                           | Preserve all exact revisions/session-only originals; qualify backup/import/recovery and failure paths                                                                                               | 8–12h                                                            |
| P2           | Twin Receivers — PR261                                                 | Rebase reviewed study, adopt correct pictured Journey edition, reassess fast double-objective closures under gp2 and publish                                                                        | 6–10h                                                            |
| P3           | Studio small fixes — PR237/239/258/262                                 | Mobile toolbar, rescue percentages, visible validation errors and Undo/Redo focus verified in current host                                                                                          | 4–7h each                                                        |
| P3           | Team presentation/history stack — PR236/238/240/241/243/244/245/247    | Dependency-aware integration; exact artwork/roles/history, export limits, import errors and both-seat readability retained                                                                          | 10–18h initial integrated slice                                  |
| P3           | Final48 reference dispositions / audit — PR260                         | Explicit current-edition keep/merge/redesign/reject decisions with evidence, not just link coverage                                                                                                 | 8–16h review, plus targeted fixes                                |
| P3           | Whole-Journey and Team qualification                                   | All chapter transitions, endings, optional arcs, broader mastery/starts, real cooperation and refreshed gp2 pacing                                                                                  | 3–6 days initial bounded workstream; human availability required |
| P3           | Final accessibility/performance/offline/recovery                       | Physical keyboard/touch/controller matrix, reduced effects/contrast/captions, storage/download interruptions, measured performance and rollback                                                     | 3–5 days after functional blockers; devices required             |
| Support only | PR266/269 branch/sprite provenance reconciliation; PR235 CI efficiency | Account for unique work and dependencies without losing source or delaying player-visible repairs                                                                                                   | 2–4h bounded reconciliation/CI slice                             |

PR numbers denote retained work, **not merge-ready certification**. At this check,
22 PRs remain open including this documentation-only status PR; the other 21 are
retained product, study, evidence or support work, not 21 independent finished
features. Six currently report merge conflicts. Stacked changes must be reconciled
against current main. PR252/257 were consolidated into delivered v0.85.0 and
closed as superseded; do not list them as unfinished releases.

The image error has diagnostics, not a proven fix. Published bundle/hash checks
and one successful Orchard Crossing download did not reproduce the user's case.
Use the failing mission/mode/asset diagnostic if available; do not clear player
uploads or weaken static-image validation to make the error disappear.

## 6. Soundtrack delivery: completed and remaining

### Completed and technically verified

- Soundtrack catalogue/library v3, stable recording identities, hash-bound rights,
  continuous repeat-all playback, shuffle, scene-aware menu/gameplay selection,
  90s Synth / Metal / Ukrainian / Fusion / My Mix, uploaded MP3s, custom
  playlists, credits/source links, offline installation and recovery are integrated.
- The simplified player view makes style, playlist and shuffle-all selection the
  primary actions, with advanced creation/recovery controls collapsed. Fresh
  libraries default to 90s Synth.
- The separate `revealline-soundtracks-01` host contains 70 cleared creator
  recordings across 15 albums. The game catalogue can stream those exact hosted
  files and install permitted recordings for offline use without adding the whole
  collection to every core game release.
- The supplied UA-FPV folder contains 80 filenames for 77 distinct MP3 recordings.
  Four private additive `.rlsound` volumes preserve all names and exact bytes.
  All 77 distinct recordings passed native decoding; all four volumes were imported,
  saved and played through the actual game UI, including title/filename, menu,
  gameplay, Play and Next behavior.
- The 36 original briefs, genre/fusion allocation, production compiler and review
  ledger exist. Rejected procedural candidates are excluded from the trusted
  catalogue and do not count as completed music.

Technical decode, transport and catalogue checks are not complete listening or
musical approval. The public creator library still needs full-track subjective
review. UA-FPV local availability does not establish ownership, lyric/artwork
rights, public redistribution or recording-safe use.

### Remaining soundtrack work, in priority order

| Priority | Item / current state | Completion condition | Indicative effort |
| -------- | -------------------- | -------------------- | ----------------- |
| P1 | Production soundtrack UX and 70-track audit | Current Pages style/playlist/shuffle, menu↔game continuity, install/offline/recovery and unavailable-network paths pass; every public track receives full listening, genre-fit, transition, volume and credit review | 4–8 h technical UX pass; 1–2 days listening |
| P2 | More clearly redistributable licensed music | Exact recording/license/hash/credit review, full audition, rights-aware catalogue admission and a small independently releasable album batch | 1–3 days per 10–20-track batch |
| P2 blocked | Public UA-FPV album | Recording-specific public redistribution, game use, artwork/metadata and recording-video evidence for every admitted hash | No reliable estimate until rights evidence exists |
| P3 | Better original-production method and four pilots | One synchronized, memorable and game-ready 90s Synth, Metal, Ukrainian and fusion pilot; no weak local-procedural candidate is promoted | 2–5 days for method and pilots |
| P3 | 36 reviewed originals | 12 per family including six fusions; masters and MP3s, loudness/peak checks, complete listening, in-game transitions and Ukrainian cultural review all pass | Approximately 3–6 weeks after pilot approval |

Keep the four UA-FPV upload packs private and documented while rights remain
unverified. A YouTube page or playlist without an explicit grant does not authorize
publishing its MP3. Restricted licensed music may remain reference-only in shared
playlists; removing a download button does not create redistribution permission.

The immediate music sequence is: verify the released player experience, finish
the 70-track listening audit, publish additional small cleared albums, pursue
UA-FPV permissions independently, then resume originals only after four strong
pilots prove the production method. The 36-original milestone must not block safe
incremental library releases and must not be marked complete from briefs or tests.

## 7. Xposed Journey P00–P15 phase closure checklist

These identifiers belong to the Xposed Journey contract, not the older whole-game
programme. Its separate [P00–P18 remaining-work crosswalk](cross-mode-execution.md#original-whole-game-phases-remaining-work-crosswalk)
retains UI, presentation, community-production and device obligations. Completing
a Journey phase does not automatically complete a similarly numbered older phase.

Every row has implementation and scoped technical evidence. **No row has full
final acceptance.** Current releases close deployment gaps for integrated content,
not every later study or human/device requirement in its historical phase record.

| Phase | Implemented                                                                     | Remaining to close                                                                                                                                                  |
| ----- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P00   | Audits, shared capture/progress, direct-flow fixtures                           | 48 final dispositions; current-edition audit; human capture-rule understanding and complete public flow matrix                                                      |
| P01   | Foundations, interior spawns/topology, opening missions and art                 | Useful islands/return choices, current-speed short-clear review, native/device/human validation                                                                     |
| P02   | Border/frontier teaching, bonuses, Studio CRUD/manual images                    | Timed-relocation temptation/mastery, pacing, cancellation/crash/conflict and authoring usability                                                                    |
| P03   | Signal terrain, actor catalogue, presentation/trace benchmark                   | Hazard-neutralization decisions, optional-goal pacing, audio/device/human review                                                                                    |
| P04   | Neon and Remix                                                                  | Meaningful frontier shaping; fix bypasses/short routes; current-speed pacing                                                                                        |
| P05   | Rover and Sorting Yard successors                                               | Threat activation, useful escape/return corridors, quota cleanup and human balance                                                                                  |
| P06   | Fracture, erosion, anchors and Two Districts                                    | Repair priorities, discoverable enclosures and optimized-route balance                                                                                              |
| P07   | Phaseworks, trail-impact and Reserve successors                                 | Readable impact/failure explanation, shortcuts and closure-race fairness                                                                                            |
| P08   | Livewire and routing successors;42 historical mastery cases qualified           | gp2 requalification, departure timing, warning overlap, route choice and human pacing; do not resurrect the resolved ten-case historical gap                        |
| P09   | Relay and permanent connectors                                                  | Bypassed/unhelpful shortcuts, post-objective cleanup and useful traversal                                                                                           |
| P10   | Crosswind directional fields without drift                                      | Precision/readability, mastery and short-clear geometry at current speed                                                                                            |
| P11   | Sentinel/receiver layouts                                                       | PR261 pictured adoption, fast Twin closures, meaningful shield approaches and balance                                                                               |
| P12   | Apex and field-finale alternatives                                              | Finale duration, quota tails, roamer bypasses, broader starts and mastery                                                                                           |
| P13   | Integrated91-mission library,12 Remixes, direct flow and selector               | Whole-Journey pacing/cuts, refreshed route evidence, optional endings, public failure/navigation matrix and human replay interest                                   |
| P14   | 12 pictured Team missions and timed/changing-return studies                     | Complementary simultaneous play, both-rover mastery, two-person/controllers, presentation stack and current-speed balance                                           |
| P15   | Compatibility, immutable editions, preservation and scoped rollback/performance | Final human sessions, accessibility/devices/performance/offline, rollback proof and full closure report; Legacy remains available until separately approved removal |

## 8. Deferred — not required for the immediate fixes

- New enemy families, additional level production and new artwork/music. Finish
  the current release and existing defects first; do not expand scope by default.
- Optional fictional scout/sentry encounter host integration, explicit toggle,
  non-graphic impacts/remains, audio and Team semantics. Runtime/authoring studies
  exist but do not constitute a finished player-facing feature.
- Assisted image tracing UI; current supported authoring is upload/overlay plus
  manual geometry, validation, preview and explicit Apply.
- Complete FPV/DroneAid/Ukrainian/Retro/other themed campaign programmes, final
  character sets and collections. Shared geometry or a theme swap is not a new
  finished campaign. Reconcile older programme targets before expansion.
- Original soundtrack production remains paused until the four-pilot method in
  section 6 succeeds. Stories, Collection/learning/support and community-creation
  guide qualification stay separately tracked, not secretly accepted by Journey
  releases.
- Hosted administration, full Ukrainian translation, persistent co-op saves,
  online multiplayer/Deathmatch and native-store distribution.
- Removal of Classic missions or historical releases: not authorized now.

## 9. Evidence and update rules

- Working source contracts: `docs/xposed-journey-plan.md`,
  `docs/unified-mission-library.md`, `docs/default-journey-release.md`,
  `docs/gameplay-pressure-controls.md`, and
  `docs/research/xposed-motion-calibration.md` on accepted main. Older status
  paragraphs in those documents must be interpreted at their recorded cutoff.
- Release facts: GitHub PR/release/run readbacks plus the actual public
  `https://mekhovov.github.io/revealline/release.json`, not GitHub Latest alone.
- Local evidence: `.cache/ux-delivery-review-20260922/current-delivery-plan.md`,
  `journey-campaign-crosswalk.md`, and `.cache/main-v0860-public-audit/REPORT.md`.
  Historical checkpoint files are retained; this register resolves their stale
  queue summaries without overwriting the observations.
- After each release, record source/version, deployment, public evidence, exact
  scope and remaining gates. Move only the delivered slice into Completed.
- Keep one publisher and one prepared successor. Preserve user dirty work,
  installed packs/uploads/settings/Studio projects and all immutable editions.
- No full human, physical-device or all-level gp2 balance claim is made here.
