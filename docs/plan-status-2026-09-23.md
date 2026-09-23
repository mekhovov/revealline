# Reveal Line — completed work and remaining delivery plan

Status checked **23 September 2026, 13:35 UTC**. This is the current status and
priority register for the approved Xposed-led Journey and unified-library plan.
It supersedes older status/queue paragraphs, not their design contracts, source
observations or release evidence. The original P00–P15 version allocations are
historical estimates, not a record of what each later release contains.

The [player-feedback register](player-feedback-register-2026-09-23.md) maps
the user's gameplay, content, authoring and delivery feedback to explicit
requirements F01–F38, current scope and completion conditions. Deferred feedback
remains visible there rather than being treated as rejected or completed.

## 1. Summary

- **Live public baseline: [v0.93.0](https://mekhovov.github.io/revealline/releases/v0.93.0/site/game/).**
  Source [PR300](https://github.com/mekhovov/revealline/pull/300) merged as
  `6842203fbf24db198da21759e23d5c5c64d499dd`; selector
  [PR301](https://github.com/mekhovov/revealline/pull/301) merged as
  `8c63ce1f41de860c988f90e259197d7ba2a81291`. Pages publication run
  `35858678754` passed assembly and deployment, and the public release marker
  identifies v0.93.0 and the exact source. Its accepted scope is retained
  presentation output, visual-session v5 ownership, fresh verified Solo visuals,
  audio lifecycle ownership and session-only visual recovery. It does not close
  the full responsive/input/device/offline or gameplay/human-balance matrices.
- **Continuous Next is delivered in v0.90.0 and retained by v0.93.0.** Source
  [PR287](https://github.com/mekhovov/revealline/pull/287) merged as
  `c585bcd3220438da971e2927763b966f55ee8235`; selector
  [PR293](https://github.com/mekhovov/revealline/pull/293) promoted the immutable
  release before v0.91.0 superseded it.
- **Collision-only gp4 enemy courses are publicly delivered in v0.91.0 and retained by v0.93.0.** Source
  [PR290](https://github.com/mekhovov/revealline/pull/290) merged as
  `e771ca71b0e710ea878d54f8ff370707f7428ef8`; selector
  [PR294](https://github.com/mekhovov/revealline/pull/294) promoted it. The bounded
  acceptance proves identity, complete public inventory and selected fresh-gp4
  observation/history/pause/Stay/return paths. It does not prove continuous
  heading at every frame/collision, exact save reconstruction, whole-game balance,
  extended win/Next, devices, offline behavior or audio.
- Default redesigned Journey, the unified tagged mission selector, safer backup
  replacement, main-menu difficulty and global local-browser playtest controls
  are delivered features.
- The soundtrack framework and simplified player controls are delivered with 70
  cleared creator recordings across 15 hosted albums. The 77 distinct UA-FPV
  recordings are verified as private local imports, not public assets. The
  original-music milestone remains 0 of 36 approved recordings.
- User feedback F01–F38 is explicitly mapped, including capture-stop, clearer
  actors and trails, consistent keyboard/controller/touch navigation, removal of
  the “Take a breath” interstitial, contextual abilities, one shared touch-control
  system, a compact one-row mobile HUD, iPhone browser constraints, Steam Deck
  Confirm/Start and the in-game title shell.
- The whole redesign is **not complete**. P00–P15 have implementation and scoped
  evidence, but each retains balance, content-review or qualification work.
- Do not give a misleading overall percentage: released functionality, candidate
  content and final human/device acceptance are different kinds of completion.

### Status definitions

- **Completed** means the stated slice is merged, released to its intended public
  route and verified within the evidence named here. It does not close broader
  gameplay, device or content requirements.
- **Partial** means usable implementation exists in the accepted game, but at
  least one required behavior, content or qualification gate remains open.
- **Remaining** means the work is required and prioritized but is not yet accepted.
- **Deferred** means the work stays in scope after the browser-release priorities;
  it is not rejected or silently counted as complete.

### Current execution board

| State         | Scope                                                                                                                      | Current boundary / next gate                                                                                                                                                                                                                                                               |
| ------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Completed** | Public releases v0.83.0–v0.93.0                                                                                            | Default Journey, unified library, safer replacement, visible difficulty/testing controls, gp2 defaults, chapter recovery, Continuous Next, collision-only gp4 courses, Replay/Studio UX recovery and retained visual-session recovery are publicly delivered within their recorded scopes. |
| **Partial**   | Core game framework and authored content                                                                                   | 91 Journey Solo/Versus missions, 12 Team missions, retained Classic content, authoring, media, bonuses and threat roles exist; balance, presentation, recovery, devices and whole-campaign acceptance remain open.                                                                         |
| **Next — P0** | Close the v0.94 Team/presentation integration blocker                                                                      | Add one mixed exact-fpv58 visual-session-v5 + gameplay-tuning save/restore/resume proof, rerun exact-head review, merge only after approval, then version, publish and verify Pages.                                                                                                       |
| **Next — P1** | PNG/JPEG failure; current-speed pacing; capture-stop/action feedback; broader gp4 qualification                            | Release each correction separately with public Retry/Play or representative gameplay evidence. Keep v0.91 delivery distinct from human balance, all-collision and exact-save proof.                                                                                                        |
| **Next — P2** | Navigation, touch/controller parity, compact mobile HUD, iPhone behavior, Steam Deck Confirm/Start, save/media recovery    | Complete keyboard-only, controller-only and touch-only journeys; retain physical-device evidence separately from simulated checks.                                                                                                                                                         |
| **Then — P3** | Studio and Team stacks, reference dispositions, soundtrack review (F31–F38), whole-Journey and final browser qualification | Reconcile existing drafts against current main and close each feature's own content, listening, accessibility, offline and human-review gates.                                                                                                                                             |
| **Deferred**  | Native stores and network multiplayer                                                                                      | Separate platform lifecycle, packaging, hardware and authoritative-network phases after browser qualification.                                                                                                                                                                             |

At this cutoff, the retained open queue is **13 draft PRs**. Source PR300 and
publication PR301 are merged and v0.93.0 is live. CI-only PR302, audit-only PR303
and source-tool-only PR304 are also merged without changing shipped game bytes.
Original owner drafts PR234/236/238/239/240/243/244/245/247 remain open while
their 154-path successor is reviewed in PR305; they require exact successor
coverage and closure rather than a second merge. PR241 remains a deliberately
separate preview feature. None is counted as a completed feature or a reserved
release merely because it has an implementation branch.
The detailed queue and conditional effort ranges are in section 5.
Feedback-specific acceptance remains in F01–F38.

## 2. Completed — publicly delivered

| Item                                 | Delivered result                                                                                                                                                          | Release / evidence                                                                                                                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Redesign integration checkpoint      | Combined redesigned Journey source, original mission pictures and retained historical editions                                                                            | v0.82.0 / v0.82.1 accepted checkpoints; not whole-plan balance approval                                                                                                              |
| Release A: new Journey by default    | Ordinary Solo and Versus use the 91-mission Journey; Team uses its separately authored 12 missions. Old selections no longer determine the default                        | v0.83.0, PR263; Pages run35775874062; public first-capture/clear/Next in all three modes                                                                                             |
| Release B: one mission library       | All / Journey / Classic / Custom, provenance-aware identity, same-screen search/filter/readiness and owner-specific launch/progression; old content retained              | v0.84.0, PR268 / selector274; public library201 Solo /201 Versus /14 Team before device-specific Custom additions                                                                    |
| Safer game-data replacement          | Explicit Keep/Replace review, source/destination checks, verified Undo where available, pending mastery-write protection and Restore focus                                | v0.85.0, PR275 / selector277; public availability accepted. Full recovery failure/device matrix is not closed                                                                        |
| Real difficulty and visible controls | Presets affect enemy pressure as well as lives; difficulty is on the main menu; bounded enemy/craft/density testing overrides and Reset are available across Solo/Couch   | v0.86.0, PR278 / selector280; scoped public title/difficulty visibility and navigation accepted                                                                                      |
| Safe tuning identity                 | Fresh attempts receive versioned rules; active/restored attempts keep their recorded rules. Non-default admin playtests do not award normal progression                   | v0.86.0 source verification; historical gp1 preservation is extended by v0.87.0                                                                                                      |
| Continuous delivery and preservation | Reviewed source PRs, immutable releases, separate Pages selection, previous-version archives and public checks                                                            | Working pipeline; v0.86.0 main audit3917 files /615005113 bytes, zero final failures/skips, two recovered503 first attempts                                                          |
| Xposed-paced defaults                | Approximate reference-calibrated gp2 craft/threat motion with authored counts; frozen gp1 history remains readable                                                        | v0.87.0, source PR279 / selector PR282; full public audit 3,946 files / 615,244,291 bytes; scoped title/history/return accepted, not whole-game balance                              |
| Same-page chapter recovery           | Failed optional-chapter preparation keeps the player in context with actionable recovery guidance and retained selection                                                  | v0.88.0, source PR284 / selector PR286; full public audit 3,974 files / 615,463,127 bytes; natural failure-copy fault injection remains untested                                     |
| Deterministic field-enemy courses    | Seeded gp3 field-enemy course variation without changing speed or movement domains; historical rules remain readable                                                      | v0.89.0, source PR285 / selector PR288; full public audit 4,005 files / 615,708,592 bytes; open-flight fairness was corrected by v0.91.0                                             |
| Continuous Next                      | Next continues across campaign, pack and Collection boundaries in Solo, Versus and Team                                                                                   | v0.90.0, source PR287 / selector PR293; publicly delivered and retained by v0.91.0; broader boundary variants remain part of whole-Journey qualification                             |
| Collision-only enemy courses         | Fresh gp4 field enemies fly straight between collisions and only vary course at a true bounce; frozen gp3 history remains readable                                        | v0.91.0, source PR290 / selector PR294; full public audit 4,063 files / 616,196,229 bytes; bounded acceptance, not whole-game or human-balance approval                              |
| Replay and Studio UX recovery        | Replay display controls remain stable through Back; Studio uses a responsive 44px toolbar, visible validation labels and focus-safe Undo/Redo endpoints                   | v0.92.0, source PR297 / selector PR298; bounded receipt SHA256 `f9525a0880f99eb1898b95d1fe65c1587d2e92ed5e2758253246cb862b49c061`; broader recovery/device gates remain open         |
| Retained visual-session recovery     | Exact retained presentation output, visual-session v5 ownership, fresh Solo visual preparation, audio lifecycle ownership and exception-safe session-only visual recovery | v0.93.0, source PR300 / selector PR301; exact package identity and live Pages marker accepted; broader gameplay/device/offline and mixed historical tuning qualification remain open |

The v0.83.0 full suite passed11788 tests. Subsequent expedited releases used the
user-authorized automated-suite waiver. Skipped suites are not passes. Public
verification is bounded: a release being delivered does not certify every mission,
physical controller, mobile device, offline journey or human balance outcome.

## 3. Remaining — implemented foundations requiring acceptance

These capabilities are present in the integrated Journey or documented candidate
editions; this table does not promote every study or open PR into the default game.

| Capability              | Implemented scope                                                                                                                                                                                      | Still needed                                                                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared rules / geometry | Enemy-retained four-connected capture, foundations/interior spawns, terrain neutralization/erosion, relay connectors and directional fields                                                            | Human prediction of capture, map-specific route usefulness and current-speed regression review                                                                         |
| Content library         | 91 Journey Solo/Versus missions =71 core +12 Remixes +8 optional ornament/workshop missions;12 purpose-built Team missions;110 retained Classic Solo entries and2 legacy Team arenas                   | Whole-campaign pacing, weak-map cuts/fixes and mode-specific acceptance; counts are not quality evidence                                                               |
| Reference audit         | 110 old Solo missions and 64 supplied files audited; 48 numbered references have 66 declared adaptation links; PR303 ports the current-edition coverage audit                                          | Final keep/merge/redesign/reject dispositions for all 48; coverage does not establish a final disposition                                                              |
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

## 4. Recent releases — completed

### Completed — v0.87.0 Xposed-paced defaults

**Public delivery is accepted.** [Play v0.87.0](https://mekhovov.github.io/revealline/releases/v0.87.0/site/game/).
Source [PR279](https://github.com/mekhovov/revealline/pull/279) merged as
`08548aeabe72f396fb75aede938d5bcadcfdc00e`. The immutable
[GitHub release](https://github.com/mekhovov/revealline/releases/tag/v0.87.0)
was published at `2026-09-22T23:56:29Z`.

Delivered scope:

- Shared gp2 starting targets: craft 0.26, ordinary field keeper 0.325 and boundary
  patrol 0.24 original short-field lengths/second. Standard preserves authored
  enemy counts; main-menu difficulty and global playtest overrides remain.
- Two gameplay recordings measured; rates are approximations, not recovered
  Xposed constants or measurements of every enemy type.
- The frozen gp1 adapter preserves historical save/replay reconstruction.
  Existing attempts are not silently retuned; unmeasured attack roles retain
  prior pressure.
- Independent exact-head review and 34 focused tests passed. PR qualification
  `35794493627` and merged qualification/freeze `35797883977` succeeded within
  their recorded scope. Long automated suites were explicitly waived/skipped,
  not passed.

### Publication and public acceptance evidence

| Gate                         | Accepted evidence                                                                                                                                                                                                                      |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Selector                     | [PR282](https://github.com/mekhovov/revealline/pull/282), head `ae6c4f4571e29d275500c0b485e84a39dbbdc39f`, merged `0831a3f84572459bba3211ccc25d09f285a80e77`                                                                           |
| Preview / production         | Runs `35800863442` / `35801168401` succeeded; deployment `6603513566`, status `18704054707` success                                                                                                                                    |
| Production receipts          | Artifact `10725952208`, SHA256 `32bbf322aeacca3d60df73e6f5543578da0d3b29c7850946c65083b48f1e1e61`                                                                                                                                      |
| Complete deployed-file audit | Run `35801746074`: **3,946 files / 615,244,291 bytes**, zero failures, skips or retries                                                                                                                                                |
| Audit artifact / report      | Artifact `10726660654`, digest `99d47f9b181a56d32803e07afb3b2dc38e67f611cb80d2bcce919e5dceb98a0e`; report SHA256 `c33190e0185adfb3da8843a75d085889202f16c83144a99e53d034c19834eb68`                                                    |
| Scoped public browser        | Queryless root → title v0.87 → About/history with v0.86 Archive55 link → Back to v0.87; no product failure/reload or captured console warning/error. Receipt SHA256 `f69cfc5bd1e764ecbd0022eda9eb6d0e26b5daf929d0e7b68484c18f3c0e3da7` |
| Fresh identity               | Root, v0.87 release and build markers identify source `08548aeabe72f396fb75aede938d5bcadcfdc00e`; preserved v0.86 identifies `c311e91b886c55039cda6e335a7408de8650110f`                                                                |

The native receipt retains one automation locator correction (AX uppercase label
versus DOM title-case label). This was not a failed product download or reload;
it must not be silently omitted from the observation record.

Archive55 preservation deployed v0.86.0 through run `35800419227`, publisher
`288aaa3f`. Its separate scoped native receipt is
`c717070db09d6e3c396718bb418b5b46e27223d42ab7de7a725607081723dffa`.
Preservation and public promotion are complete; they are no longer queued steps.

**Still open:** old gp1/pressure-v2 scripted routes do not prove gp2 balance or
unchanged route feasibility. Reassess current-speed missions; do not relabel
historical 498-route evidence as gp2 proof. Full gameplay, physical-device,
controller, offline and listening qualification remain separate work. This
release closes its delivery scope, not the whole redesign.

### Completed — v0.88.0 same-page chapter recovery

[v0.88.0](https://mekhovov.github.io/revealline/releases/v0.88.0/site/game/)
is publicly accepted within its recorded scope. Source
[PR284](https://github.com/mekhovov/revealline/pull/284) merged as
`950f19045facacf5151c90661de1ca28d30658df`; selector
[PR286](https://github.com/mekhovov/revealline/pull/286) preserved v0.87.0.
Production run `35809170261` and deployment `6604852605` succeeded. Full HTTP
audit `35809535421` verified **3,974 files / 615,463,127 bytes** with zero final
failures, retries or skips. The chapter-failure copy was not naturally exposed
during public qualification, and no fault-injection pass is claimed.

### Completed — v0.89.0 deterministic enemy courses

[v0.89.0](https://mekhovov.github.io/revealline/releases/v0.89.0/site/game/)
is delivered and retained in release history. Source
[PR285](https://github.com/mekhovov/revealline/pull/285) merged as
`9374f7fab315a2b9145d699cb4548fb7807b1380`; selector
[PR288](https://github.com/mekhovov/revealline/pull/288) merged as
`126b947dcf8fedd553fabd2b4de384bc6d483739`. Production run `35811757995`,
deployment `6605286903` and status `18708092422` succeeded. Full HTTP audit
`35812128059` verified **4,005 files / 615,708,592 bytes** with zero final
failures, retries or skips. Fresh Solo/Versus motion, exact Resume and extended
suites were deferred rather than passed.

### Completed — v0.90.0 Continuous Next

Source [PR287](https://github.com/mekhovov/revealline/pull/287) merged as
`c585bcd3220438da971e2927763b966f55ee8235`; selector
[PR293](https://github.com/mekhovov/revealline/pull/293) merged as
`c2d4789f08fde3a50a7218bbc5c0d6a3b8997a4f`. Continuous Next across campaign,
pack and Collection boundaries in Solo, Versus and Team is publicly delivered
and retained by v0.91.0. Whole-Journey qualification still owns broader starts,
endings, failure recovery and every boundary variant.

### Completed — v0.91.0 collision-only enemy courses

Source [PR290](https://github.com/mekhovov/revealline/pull/290) merged as
`e771ca71b0e710ea878d54f8ff370707f7428ef8`; the immutable release was published
at `2026-09-23T05:27:44Z`. Selector
[PR294](https://github.com/mekhovov/revealline/pull/294) merged as
`3a7244dbd6220c8e802ac4a7c2ebf3a02173da1d`. Production run `35826568244`,
deployment `6607801868` and status `18713811980` succeeded. Independent public
audit checked **4,063 files / 616,196,229 bytes / 4,063 attempts** with zero
failures, retries or skips; admission-review SHA256 is
`9bd9ff5e7751e22fad4fbd51ceec2cb0884784bd64147515c8f0a1ce9c6c3325`.

The bounded native receipt passed 13 selected steps for fresh gp4 observation,
history, Pause, Stay and return. Its eight frames are a visual sample, not proof
of continuous heading or every collision. The 52 focused source checks remain
separate; the full suite was waived/skipped. No extended gameplay, win/Next,
physical-device, offline, audio, human-balance or exact-save claim is made.

### Completed — v0.92.0 Replay and Studio UX recovery

Source [PR297](https://github.com/mekhovov/revealline/pull/297) merged as
`b572e82765cb53e2e7420ea13ec7cfd5e55301df`; selector
[PR298](https://github.com/mekhovov/revealline/pull/298) merged as
`8232a8f90e1381e986a8d67d74f17592ccd9ff7b`. Production run
`35842300057`, deployment `6610614566` and status `18720317680`
succeeded.

The bounded public receipt observed 13 steps at `2026-09-23T09:33:17Z`:
root/title, History 136, v0.91 in Archive 60, Back from Replay, unchanged Replay
settings/history/opener, eight responsive Studio preview rows with 44px controls,
rotated Undo/Redo endpoint focus and visible invalid Content Studio field labels.
It recorded zero product failures, one automation-cleanup retry and zero reloads;
temporary tabs were closed and the viewport was reset. Receipt SHA256:
`f9525a0880f99eb1898b95d1fe65c1587d2e92ed5e2758253246cb862b49c061`.

Exact-head preflight and build passed. The long tests and release gate were
explicitly waived/skipped, not passed. This acceptance does not prove Replay
bfcache, denied-storage or nonzero persisted checkpoint recovery; full device,
offline, gameplay, responsive or human-balance qualification; or a new
byte-for-byte public artifact audit.

### Completed — v0.93.0 retained presentation and visual-session recovery

Source [PR300](https://github.com/mekhovov/revealline/pull/300) merged as
`6842203fbf24db198da21759e23d5c5c64d499dd` with the same reviewed tree.
Selector [PR301](https://github.com/mekhovov/revealline/pull/301) merged as
`8c63ce1f41de860c988f90e259197d7ba2a81291`. Publication run
`35858678754` passed exact frozen assembly and deployment. The public
`release.json` identifies v0.93.0, source `6842203f`, source archive SHA-256
`6e2d5add392a39cf99e1d91c3146592cd764a35e02d2495c78c20f7bb723ca3d`
and distribution SHA-256
`7c4c53e1cb43d20c3780eaf8d01a5947dadc07a12cd02113c65b88951ddfd807`.

The release accounts for all 154 paths of draft PR256 and its exact 139-path
PR233 subset once. Exact-head preflight/build, merged-source qualification and
read-only artifact inspection passed. The predecessor formatting failure remains
recorded and is not counted. Long automated suites and extended gameplay,
responsive, offline and device matrices were explicitly waived/deferred rather
than passed.

### In review — v0.94.0 Team/presentation integration

[PR305](https://github.com/mekhovov/revealline/pull/305) is a draft at exact head
`8d16f1ef9511ec4c7708b7c61031a8488d1e59c7` on current main `3539027a`.
Its 154-path historical Team stack, three conflict resolutions, 0.94.0 version
alignment, exact retained fpv58 bytes/closure, current revision-62 policy, PR239
coverage and PR241 exclusion have independent review support. Replacement run
`35865264053` passed required preflight and build; its broad test and release-gate
jobs were explicitly skipped.

The candidate is **blocked, not complete**. It separately proves exact fpv58
retention and visual-session v5 restore/resume across gameplay-tuning generations,
but lacks the requested combined case: an exact published fpv58 visual owner in a
tuned v5 save must restore and resume with checkpoint equality and without owner
drift or upgrade to revision 62. Add that focused proof, repeat exact-head review,
then merge, freeze, release, select for Pages and verify the public game. Until all
those gates pass, v0.93.0 remains the latest public release.

## 5. Remaining — prioritized execution queue

Estimates are focused effort after starting, not deadlines or additive promises.
Release/CI queues and human/device availability can extend elapsed time. Finish
one user-visible slice per reviewed PR/release rather than accumulating a large diff.

| Priority     | Item / current state                                                | Completion condition                                                                                                                                                                                | Indicative effort                                                |
| ------------ | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| P0           | v0.94 Team/presentation integration — PR305 blocked in review       | Add exact fpv58 + tuned visual-v5 save/restore/resume proof; obtain clean exact-head approval; merge, qualify/freeze, publish immutable v0.94.0, promote selector and verify actual public Pages    | 2–4h for proof/review if no defect; 2–5h release/Pages afterward |
| P1           | Broader gp4 gameplay qualification — public delivery bounded        | Prove representative continuous-heading/all-collision behavior, exact gp3/gp4 save and replay reconstruction, extended win/Next paths and human balance without rewriting v0.91 evidence            | 1–3 days initial bounded review; devices remain under P2         |
| P1           | PNG/JPEG mission-selection failure — unresolved                     | Identify affected mission/mode/asset and reproduce; repair actual cause; public Download/Retry/Play succeeds without deleting media or bypassing validation                                         | 2–4h diagnosis;3–8h scoped repair once reproducible              |
| P1           | Current-speed difficulty/pacing review                              | Representative early/middle/late Solo/Versus/Team routes; fair departures, enemy/craft ratios, useful geometry and no trivial one-cut bypasses outside teaching. Human feedback recorded separately | 1–3 days first pass;6–12h per map-fix release                    |
| P2           | Remaining save warnings, recovery focus and session-only continuity | Recheck latest accepted source; close only still-reproducible gaps, including two-tab ownership/Next and failed-save recovery                                                                       | 6–10h per bounded slice                                          |
| P2           | Ready/download usability — PR230/234                                | Same-page retry, preserved readiness/selection and visible opener focus; retain v0.92 Replay Back behavior while broader storage/bfcache recovery stays open                                        | 3–6h each after dependency reconciliation                        |
| P2           | Retained-media/presentation recovery after v0.93                    | Extend accepted exact-revision/session-only recovery through backup/import/failure and mixed historical tuning paths without rewriting v0.93 evidence                                               | 6–10h after the v0.94 blocker                                    |
| P2           | Twin Receivers — PR261                                              | Rebase reviewed study, adopt correct pictured Journey edition, reassess fast double-objective closures under gp2 and publish                                                                        | 6–10h                                                            |
| P3           | Studio rescue percentages — PR239                                   | Close the owner draft after PR305 proves exact inclusion once; retain same-tick board/HUD/note behavior and avoid a duplicate merge                                                                 | 1–2h after PR305 acceptance                                      |
| P3           | Team presentation/history stack — PR305                             | Close the mixed fpv58/tuned-v5 blocker, publish the integrated 154-path stack, then close covered owner drafts; keep PR241 separately reviewable                                                    | Included in P0; 4–8h follow-up closure/public checks             |
| P3           | Final 48 reference dispositions                                     | PR303 delivers the 48/48 coverage audit; add explicit current-edition keep/merge/redesign/reject decisions with evidence rather than treating link coverage as final disposition                    | 8–16h review, plus targeted fixes                                |
| P3           | Whole-Journey and Team qualification                                | All chapter transitions, endings, optional arcs, broader mastery/starts, real cooperation and refreshed gp2 pacing                                                                                  | 3–6 days initial bounded workstream; human availability required |
| P3           | Final accessibility/performance/offline/recovery                    | Physical keyboard/touch/controller matrix, reduced effects/contrast/captions, storage/download interruptions, measured performance and rollback                                                     | 3–5 days after functional blockers; devices required             |
| Support only | PR266 branch/worktree reconciliation                                | Refresh the census; reach zero unclassified refs and zero unique unaccounted patches while preserving owner worktrees and dirty changes                                                             | 2–4h first reconciliation slice; total depends on census         |
| Support only | Publishing efficiency after PR302                                   | PR302 now cancels only superseded checks in the same PR group. Observe a real superseding update, then add measured phase timing before any bounded-concurrency change                              | 1–3h observation/instrumentation                                 |

The [UX/device delivery mapping](player-feedback-register-2026-09-23.md#uxdevice-delivery-mapping-and-estimates)
tracks feedback F15–F38 explicitly: capture-stop; directional role readability;
trail/impact/failure/capture/pickup feedback; readable pixel UI; complete input
navigation; removal of the unnecessary “Take a breath” interstitial; contextual
abilities; shared touch overlays; compact HUD; iPhone viewport constraints;
Steam Deck Confirm/Start; the in-game title shell; and physical-device evidence.
It also records predictable collision-only enemy motion and the wider Xonix
mechanics research/application queue.
F31–F38 separately retain the music-quality, licensed-library, Ukrainian,
UA-FPV, reusable-MP3, simple-player, hosted-album and Now Playing requirements.
Its P1/P2 corrections join the applicable current-speed, navigation, Team and
accessibility slices above. Delivered foundations remain separate from unfinished
acceptance. Estimates overlap the existing programme ranges, not extra promises.

PR numbers denote retained work, **not merge-ready certification**.
The retained inventory contains **13 draft PRs** at this cutoff. These include
product, study, evidence and support work, not 13 independent finished features.
PR300 supersedes the accepted parts of PR256; PR303 supersedes the coverage-audit
part of PR260; PR304 supersedes the source-only sprite work in PR269; PR302 ports
the accepted PR235 scheduler correction. Owner branches remain preserved until
their successor coverage is accepted and closure is recorded.

The compatible Team/presentation dependency lane is now represented by PR305:
**accepted PR300/PR233 foundation → PR234 → PR236 → PR238 → PR240 →
PR243 → PR244 → PR245 → PR247**. Its machine ledger accounts for the
historical 154-path range. PR239 is included once through exact PR245 blobs and
policy; PR241 remains intentionally outside the stack as a separate preview
feature. This provenance is necessary but does not override the mixed fpv58/tuned
visual-session blocker above.

The full branch/worktree reconciliation is also unfinished. Its last dated raw
census recorded 520 local refs, 297 GitHub refs, 247 worktrees, 96 dirty worktrees
and 165 unclassified entries. Those counts are a checkpoint, not current truth or
completion. Closure requires a fresh census with zero unclassified refs and zero
unique unaccounted patches while preserving owner worktrees and dirty changes.

Publishing performance work remains a bounded support candidate. The four-file
deployment checkout is delivered; API phase timing and safe limited concurrency
are not. Any optimization must retain all required fresh passes, the final latest-
selection guard, deterministic output, rate-limit handling and fail-closed errors.

PR252/257 were consolidated into delivered v0.85.0 and closed as superseded;
do not list them as unfinished releases.

The image error has diagnostics, not a proven fix. Published bundle/hash checks
and one successful Orchard Crossing download did not reproduce the user's case.
Use the failing mission/mode/asset diagnostic if available; do not clear player
uploads or weaken static-image validation to make the error disappear.

## 6. Soundtrack — completed and remaining

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
- The separate soundtrack repository is an optional-media origin rather than a
  second game. Hash-bound catalogue entries connect it to RevealLine: the game
  streams only the current and next recording from its published URL, or copies
  permitted bytes into the game's IndexedDB when a player chooses offline install.
  This keeps hundreds of megabytes out of every core release while preserving
  direct in-game playback, titles, artists, credits and source links.
- The supplied UA-FPV folder contains 80 filenames for 77 distinct MP3 recordings.
  Four private additive `.rlsound` volumes preserve all names and exact bytes.
  All 77 distinct recordings passed native decoding; all four volumes were imported,
  saved and played through the actual game UI, including title/filename, menu,
  gameplay, Play and Next behavior.
- The 36 original briefs, genre/fusion allocation, production compiler and review
  ledger exist. Rejected procedural candidates are excluded from the trusted
  catalogue and do not count as completed music.
- The first A/B procedural candidates were rejected because their melodies and
  instrumental rhythms did not stay convincingly synchronized. Original production
  is deliberately paused at **0/36 approved** until a better method passes four
  complete pilots; this feedback is tracked explicitly as F31.

Technical decode, transport and catalogue checks are not complete listening or
musical approval. The public creator library still needs full-track subjective
review. UA-FPV local availability does not establish ownership, lyric/artwork
rights, public redistribution or recording-safe use.

### Remaining soundtrack work, in priority order

| Priority   | Item / current state                              | Completion condition                                                                                                                                                                                                  | Indicative effort                                 |
| ---------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| P1         | Production soundtrack UX and 70-track audit       | Current Pages style/playlist/shuffle, menu↔game continuity, install/offline/recovery and unavailable-network paths pass; every public track receives full listening, genre-fit, transition, volume and credit review | 4–8 h technical UX pass; 1–2 days listening       |
| P2         | More clearly redistributable licensed music       | Exact recording/license/hash/credit review, full audition, rights-aware catalogue admission and a small independently releasable album batch                                                                          | 1–3 days per 10–20-track batch                    |
| P2 blocked | Public UA-FPV album                               | Recording-specific public redistribution, game use, artwork/metadata and recording-video evidence for every admitted hash                                                                                             | No reliable estimate until rights evidence exists |
| P3         | Better original-production method and four pilots | One synchronized, memorable and game-ready 90s Synth, Metal, Ukrainian and fusion pilot; no weak local-procedural candidate is promoted                                                                               | 2–5 days for method and pilots                    |
| P3         | 36 reviewed originals                             | 12 per family including six fusions; masters and MP3s, loudness/peak checks, complete listening, in-game transitions and Ukrainian cultural review all pass                                                           | Approximately 3–6 weeks after pilot approval      |

Keep the four UA-FPV upload packs private and documented while rights remain
unverified. A YouTube page or playlist without an explicit grant does not authorize
publishing its MP3. Restricted licensed music may remain reference-only in shared
playlists; removing a download button does not create redistribution permission.
The [UA-FPV upload guide](ua-fpv-upload-guide.md) remains the supported path for
the supplied private recordings until recording-specific permissions are obtained.

The immediate music sequence is: verify the released player experience, finish
the 70-track listening audit, publish additional small cleared albums, pursue
UA-FPV permissions independently, then resume originals only after four strong
pilots prove the production method. The 36-original milestone must not block safe
incremental library releases and must not be marked complete from briefs or tests.
Feedback F31–F38 in the player register is the acceptance checklist for this work;
Ukrainian music remains equal in scope to 90s Synth and Metal throughout it.

## 7. Remaining — Xposed Journey P00–P15 closure checklist

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
- Current public marker at this cutoff: v0.93.0, source
  `6842203fbf24db198da21759e23d5c5c64d499dd`. Current accepted main is
  `3539027af095a5a8de6e304ccf327d8e5f71e547`; its later PR302–304 merges are
  CI/audit/source-tool work and do not change the selected frozen game bytes.
- PR305 cannot move from In review to Completed until its mixed historical
  visual/tuning compatibility proof, exact-head approval, merge/freeze, immutable
  release, Pages selector and public verification all pass.
- Local evidence: `.cache/ux-delivery-review-20260922/current-delivery-plan.md`,
  `journey-campaign-crosswalk.md`, `.cache/main-v0860-public-audit/REPORT.md`,
  `.cache/main-v0870-public-audit/REPORT.md`, and the bounded v0.92 receipt
  `.cache/ux-delivery-review-20260922/v0920-public-native-ux.json` with SHA256
  `f9525a0880f99eb1898b95d1fe65c1587d2e92ed5e2758253246cb862b49c061`.
  The receipt is scoped browser evidence, not physical-device, offline, full
  gameplay or byte-complete artifact certification. Historical checkpoint files
  are retained; this register resolves their stale queue summaries without
  overwriting the observations.
- After each release, record source/version, deployment, public evidence, exact
  scope and remaining gates. Move only the delivered slice into Completed.
- Keep one publisher and one prepared successor. Preserve user dirty work,
  installed packs/uploads/settings/Studio projects and all immutable editions.
- No full human, physical-device or all-level gp2 balance claim is made here.
