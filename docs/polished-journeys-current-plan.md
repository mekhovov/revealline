# Polished learning journeys and real-radio FPV: current plan

Reviewed **30 September 2026 (Europe/Berlin)**. This is the current
planning view for the user-approved company/discovery campaigns and revised
**Phase 2 → Phase 3 → Phase 4 → Phase 6** priorities. It supersedes current-status
claims in the [discovery ledger](discovery-rewards-phase-status.md) and
[historical flight delivery ledger](polished-flight-delivery.md), preserving their
original evidence and failures. This review changes documentation, not gameplay.

## 1. What the review changes

The shared game, content catalogue and simulator foundation exist. There is no
need to rebuild the simulator or fill a supposedly missing 108-mission catalogue.
However, **Phase 6 is partly implemented, not complete**: measured coaching,
comparison against a previous flight, complete authoring of guidance/modes/reward
media, optional stick visibility and simulator sound remain genuine feature work.
These precede further campaign-count expansion.

Keep three independent statuses:

1. **Implemented:** source/data exist in main or an identified PR.
2. **Observed/validated:** a named procedure covers exact source/artifacts and scenarios.
3. **Promoted/released:** original artifacts and their reviewed publication selection
   have completed the release process. Main deployment alone does not establish this.

Historical passing test counts cannot be presented as a fresh suite pass. The
current [test policy](../publishing/test-policy.json) waives automated suites;
record them as **WAIVED_SKIPPED_NOT_PASSED**. Builds, lint, localization/source
validation, dependency/capacity checks and artifact integrity remain required.
Human learning, pacing, artwork and physical-radio/device evidence remains
**deferred by the user and unverified**; software work continues without waiting.

## 2. Source and publication snapshot

- Reviewed main refreshed to `60407a7ce4b4592372e66ef1961f3aa85562cefd`,
  including the compact landing/Settings changes in #854. The detailed content/FPV
  audit began at `09a43d83351af276f184293ed3c72261575ed8bc`; the subsequent delta
  changes shared menu routes, not the counted content or simulator model.
  [PR #853](https://github.com/mekhovov/revealline/pull/853) is merged: bundled FPV
  worker/icons, offline preparation with game-return links, query-bearing offline
  navigation and shared-icon projection are implemented. Its
  [rolling Pages run](https://github.com/mekhovov/revealline/actions/runs/36759567741)
  completed deployment/public verification. This is separate from immutable release admission.
- [PR #862](https://github.com/mekhovov/revealline/pull/862), reviewed at
  `1236e5b50ae9040bd7b282bff6310517ac332ebb`, contains the focused-control pause fix,
  actual 0.5×/1× replay and frozen runtime/retention observers. It was subsequently refreshed to
  `aa06ee358963de51faf2fd271fe3829942269453` with the same #854 menu delta. It is
  open, ready for review and assigned to existing milestone
  [v0.150.0 — Unified native experience](https://github.com/mekhovov/revealline/milestone/57).
  At the latest-head checkpoint, optional-package build and preflight succeeded;
  release-ready was queued and company candidate/default-capacity were running.
  The earlier 1236 head passed its source gate, focused-policy job and
  default-capacity check, but its company candidate was cancelled during refresh.
  Broad build/test jobs were skipped under the active policy. These statuses are a snapshot, not permission
  to claim a later head qualified or merge it without coordination.
- Latest immutable GitHub release observed:
  [v0.142.3](https://github.com/mekhovov/revealline/releases/tag/v0.142.3).
  Milestone v0.150.0 is planning authority, not a release date or a published version.
- Both [edition](../publishing/pages-controller/editions.json) and
  [optional-package](../publishing/pages-controller/optional-packages.json)
  publication selectors have empty `releases` arrays. Dedicated frozen standalone
  cohorts have not been promoted through them. This does not mean their runtime
  is absent from the default game, rolling main or candidate previews.

## 3. Completed content and shared systems

### Catalogue

The catalogue contains **18 edition manifests**: six Coupa, seven Netherlands
DroneAid, one historical Portuguese DroneAid, and four discovery editions. Editions
are audience/package selections; this count is different from campaign count.

| Content family               | Campaigns | Arcade missions | Current depth                                                                            |
| ---------------------------- | --------: | --------------: | ---------------------------------------------------------------------------------------- |
| Coupa                        |         5 |              30 | Official flower/brand presentation; 24 lesson definitions in four learning campaigns.    |
| DroneAid Netherlands         |         6 |              36 | Workshop/community-themed routes and FPV presentation.                                   |
| Historical DroneAid Portugal |         1 |               3 | Preserved separately from the Netherlands identity and claims.                           |
| Social Drone UA              |         2 |              12 | Discoveries and the Community Connections showcase.                                      |
| Victory Drones               |         2 |              12 | Discoveries and the Ideas into Understanding showcase.                                   |
| Ukraine: Living Culture      |         6 |              36 | Textile, craft, Crimean Tatar, voice, city and everyday-culture campaigns.               |
| FPV Learning                 |         8 |              48 | Parts, bench concepts, soldering, controls, flight patterns, families, context and care. |

The **four discovery editions** implement the planned **18 campaigns / 108 arcade
missions / 18 standard finales**. Coupa/DroneAid content is additional. The separate
first-person simulator has **12 drills**; those are not arcade missions or the
historical assisted overhead gym.

The new catalogue has 108 different serialized map layouts and 108 distinct mission
picture hashes, plus four home scenes and 18 campaign key scenes. These establish
nonidentical authored content, not human-confirmed route quality, pacing or art
quality. All 108 mission-art records remain `review: "candidate"`; public asset
admission and human artwork approval are different decisions.

### Discovery, rewards and learning

- Shared reward definitions, exact promises/receipts, Collection, first-win grants,
  locked teasers, campaign exhibits, optional mastery, pinned goals and personal
  bests are implemented. The new discovery catalogue has **130 reward definitions**:
  108 first-win discoveries, 18 finales and four optional application bonuses.
- A standard finale requires all six declared, distinct wins. One last-mission win
  cannot replace missing earlier wins. Optional application bonuses additionally
  require a verified lesson; they do not alter the promised six-win finale.
- Four showcases each have six missions. They have **12 bounded workbenches total**,
  on missions 2, 4 and 6 of each campaign—not 24 or 108 verified exercises.
  Those activities expose evidence, allow recoverable choices and explain outcomes:
  workshop handoffs; fair civilian comparisons; museum labels and a second object;
  aircraft component and information/energy relationships.
- The three reading profiles and EN/UK discoveries exist. Profile prompts are
  different explanations/reflections, not separate proof of learning. Complete
  localization of every older company screen is not inferred from these sidecars.
- Rich media support exists for images, knowledge, URL/QR, public codes, audio/video,
  exploration and cosmetics. Authored discovery content currently includes five
  exploration payloads, one video and two audio payloads. Most missions are concise
  picture/knowledge discoveries. Full multimedia depth is not implemented everywhere.
- Coupa/DroneAid explicit discovery sidecars remain pilot coverage: Spend in Motion
  and Workshop Lights each have six discoveries and a finale, with one additional
  source-to-pay reward. The framework supports further coverage; every older
  company mission does not yet have this sidecar.

Source authorities: [edition catalogue](../game/editions/catalog.json),
[company campaigns](../game/content/company-campaigns/),
[reward model](../game/rewards/model.mjs),
[reference assets](../game/company-campaigns/curriculum-reference-assets.mjs).
Real examples retain individual attribution: two Met shirt fragments, hardware and
workbench photographs, flag/state-emblem references. Illustration, museum metadata
and visual interpretation remain distinct. Official marks/icons for the four new
community/topic editions are not yet bound: their logo/icon asset IDs are null and
original presentation markers are used. Do not imply community endorsement.

### Shared shell and studios

Home, expedition map plus accessible list, ready/play/results/Collection flows,
shared input ownership and responsive board layout are implemented. The result
arrival animation is 800 ms, with reduced-motion handling and immediate Next/Retry.
Shared arcade rules remain authoritative; branded presentation does not fork
collision, scoring or enemy behaviour.

The latest compact landing moves FPV Simulator and Practice into **Settings →
Extras**; **Settings → Controls → Controller Lab** retains its optional-package
entry. Launch handlers remain wired, but a prominent direct Home button is no
longer present. Verify discoverability and return/focus behaviour on the final
compiled edition; do not report the old Home placement as current or the simulator
as unreachable. Preserve the shared compact-landing design while improving cues.

Guided lesson and exploration editors, lesson-sidecar creation, wrong/correct/resume
previews and compiler/export/import support exist. Historical Studio-to-Collection
and native-browser examples are evidence for their particular fixtures and sources;
they do not constitute a current exhaustive matrix across every edition and input.

### Radio and simulator foundation

The separate `civilian-fpv` package already provides:

- USB-joystick Gamepad diagnostics; arbitrary channel mapping; full-travel throttle;
  calibration, inversion/dead zones; Mode 1–4 diagrams; optional switches; separate
  radio and flight-response profiles; validated profile transfer.
- One movement owner; neutral input on interruption; fresh arming after reconnect;
  airborne control pickup. Physical compatibility is still recorded per radio,
  firmware, OS and browser, not inferred from a brand name.
- Two procedural environments; first-person/chase/overview cameras; FOV/tilt controls;
  Self-level with manual throttle and Acro; a fixed 50 Hz integer/quaternion model,
  swept directional gates, stable primitive contacts and consecutive hold/landing criteria.
- Twelve drills, demonstrations, verified replay, separately stored transcripts and
  notebook rewards: twelve distinct completions in either mode, plus an all-Acro
  distinction. Review/authoring sessions cannot earn arcade or practice completion.
- Course Studio's gate/hold/landing editing, bilingual text, revisions, JSON editing,
  validated course/proof/reward transfer and non-earning preview.

The conceptual Control Lab teaches which control affects what. The simulator adds
manual throttle, attitude, momentum, braking, heading and spatial judgement. It is
a fictional educational model, not real-aircraft certification or a live connection.

## 4. Revised phase status

| Phase                            | Correct status                                      | What remains                                                                                                                   |
| -------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 0 — Baseline/framework inventory | Established; refresh per batch                      | Review moving main, dependencies and existing promises before each change.                                                     |
| 1 — Reward foundation            | Implemented                                         | Preserve exact grants, requirements, receipts and historical recovery.                                                         |
| 2 — Game feel and authoring      | Implemented for the planned showcase framework      | Final-source route/accessibility/performance qualification; Flight Studio gaps are tracked under Phase 6 below.                |
| 3 — Four playable slices         | Implemented; original three-mission slices exceeded | No missing slice count. Broader human quality review stays deferred.                                                           |
| 4 — First finales/control lab    | Implemented                                         | Final-source six-win/application/backup and full authoring-to-player acceptance.                                               |
| 5 — Content expansion            | Planned 108-mission count implemented               | More interactive depth/company rewards/identity polish are explicit follow-up content work, not missing missions.              |
| 6 — Optional FPV flight          | Foundation implemented; completion work remains     | Coaching, compatible previous-attempt comparison, full authoring, overlay toggle and sound; integrate #862.                    |
| 7 — Qualification and promotion  | In progress                                         | Exact integrated artifacts, meaningful measurements, installation/update/rollback, reviewed selection and public-byte closure. |

## 5. Remaining implementation, in priority order

### P1 / next Batch G — make each flight teach something specific

**G1. Attempt-specific coaching.** The app currently repeats the course's static
lesson after an attempt. Existing verified-attempt analysis already exposes
`heightRange` and `landingSpeed`, but the player does not get a selected actionable
observation about their own flight. Start by reusing those values and the accepted
outcome to show one useful explanation and one next action, in EN/UK. Add overshoot
or gate-approach observations only where the transcript provides unambiguous evidence.
Cover failed and successful attempts; incorrect actions remain recoverable.
The completion verifier currently rejects incomplete attempts. Analyze failures
through bounded replay without treating them as accepted completion evidence;
only accepted completed proofs enter the existing reward receipts.

Done: live results provide bounded non-earning failure feedback; completed attempts
show the same advice in results and Notebook revisit. Imports cannot inject
fabricated advice/completion; advice is useful for both flight modes;
no new scoring, tolerance, physics or duplicate progress store is introduced.

**G2. Compare with a previous attempt.** Current review displays the flight being
reviewed; reset clears that route. It is not an optional previous-flight path during
new practice, and there is no comparison interface. Add explicit opt-in comparison
from verified stored transcripts. Require compatible model, course revision, mode
and response identity; visibly explain incompatibility instead of comparing them.
Keep the cue readable and optional, including in first-person view as appropriate.

Done: a compatible prior route/summary can guide a new attempt; incompatible or
missing proofs produce recovery; cue removal/retry/edition switching releases
resources; guidance never changes physics or completion criteria.

**G3. Optional stick visibility.** Add an accessible show/hide control using the
existing presentation/settings conventions. Keep calibration verification visible
where it is essential; hide only the optional in-flight overlay.

Done: keyboard/controller/touch can toggle it, the preference is restored safely,
and hidden presentation does not disable or seize flight controls.

### P1 / Batch H — finish the promised Flight Studio workflow

The Studio has a working foundation, but the original full authoring promise is
not met. Current demonstration authoring works through validated JSON import/export;
guided selection or recording would improve usability, but is not a missing
mandatory recorder from the approved scope. `FlightCourse.v1` has no separate authored cue field,
both modes are hardcoded, and Studio reward validation permits knowledge payloads
only, excluding teaser media, audio groups and cosmetics without a selected-asset adapter.

Implement this through the existing course, reward and asset systems:

1. Preserve working demonstration import/export and verification; improve selection
   and preview where useful. Add guided recording only as optional authoring polish.
2. Versioned guidance/cue authoring and previews. Cues explain; they do not silently
   modify published tolerances or simulation.
3. Explicit permitted-mode authoring with backward-compatible old-course behaviour.
   Keep the built-in twelve drills available in both modes; restrictions belong
   to explicitly versioned custom courses, without rewriting existing finale promises.
4. Selected-asset reward/teaser/cosmetic support through shared reward/media authorities,
   exact revisions, rights/dependency inventories and unchanged package limits.

Done: **edit → preview → export/import → compile/admit → ordinary practice completion
→ Notebook/Collection revisit** preserves languages, cues, demonstrated proof,
permitted modes, reward references and media. Preview/demonstration never earns.
Old courses/proofs retain their existing meaning. Unsupported media are rejected
clearly rather than silently removed or admitted through arbitrary URLs.

### P2 / Batch I — complete presentation, without expanding the mission count

- **Restrained simulator sound:** no simulator sound/cue adapter is currently
  delivered. Add a small shared adapter for readable environment/success/failure
  cues that respects mute, volume and ownership, releases resources on pause/exit,
  and fits existing package/source budgets. Audio remains optional information.
- **Community identity/icons:** prepare approved original or cleared official marks
  and installation icons for the four new discovery editions. Keep attribution,
  exact sources and the absence of endorsement explicit. Human art review stays pending.
- **Learning/content depth:** extend a selected company pilot or specific worked
  discovery with additional meaningful interactions and later application. Use
  reviewed batches of up to three missions. This is enrichment of existing content;
  no additional campaign quota is needed to complete the current count.

These items can run alongside qualification after Batch G/H interfaces settle.
Sound and identity are unfinished presentation promises; wider content enrichment
is optional scope and should not delay core simulator coaching/authoring.

## 6. Qualification that accompanies those batches

### P1 / Q1 — integrate and admit the selected exact source

Finish #862's remaining candidate work under release coordination. For the final
combined source, retain reproducible runtime/source ZIP checks, public eligibility,
selected dependency exclusions and original source hashes. Validate the complete
selected hosted graph—not a sum of capacity reports from different commits.
The 1236 default-capacity success is newer than historical overage guesses;
the aa06 refresh was still running its capacity check at this snapshot. Neither
a partial result nor an older report establishes final full-site selection capacity.

Retain core 64 MiB/2,000 files, edition assets 32 MiB, optional runtime/source
8 MiB/64 files, and main hosting 950,000,000 bytes. Follow the current
[main-repository-only policy](main-repository-publishing.md): overflow is handled
through reviewed selections/download-only content, not new archive repositories
or increased caps. Old recommendations for more hosting repositories are superseded.

### P1 / Q2 — targeted player and authoring acceptance

On the selected compiled editions, exercise the complete journey and Studio round
trip for each showcase, wrong/correct/later application, resumed workbench, exact
six-win finale, Collection revisit, backup/import and unavailable media. Confirm
immediate Next/Retry, visible board edges, focus/Back/Pause ownership, neutral input
while reading and reduced motion. Use existing harnesses and evidence formats.
Keep native-browser, synthetic-device and human/physical evidence labelled separately.

### P1 / Q3 — precise performance and retention closure

Performance has been measured; it has not been universally qualified. Historical
matched arcade pairs met the scoped 5% p95 target. Later first-win observations
recorded 41.539 ms timeline and 49.061 ms CPU-profile samples, superseding older
70 ms callbacks as the latest scoped optimization evidence. They still do not
establish exclusive reward-work ≤50 ms across final scenarios.

Next: use the final artifact and a comparable baseline/device/browser/procedure;
measure ordinary first win, result, media open/close and next challenge. Attribute
actual reward/save work before selecting a fix. Preserve outliers and failures.
For the simulator, use #862's frozen-plan runtime/retention observers, then interpret
retained paths and resource lifetimes. Stable DOM/GPU counters alone are not a
leak-free verdict; an eight-second sample is not input-to-photon latency.

The committed September 30 diagnostic summary observes **bf7a365**; #862's body
also records **c7f098e**. Both had successful scoped procedures. Latest **1236e5b50**
changes admitted app/copy/HTML/radio/offline dependencies, so those receipts cannot
silently qualify it. The later aa06 head adds the reviewed shared-menu delta. Its available optional
artifact is source-bound to that head:
`optional-flight-candidate-aa06ee358963de51faf2fd271fe3829942269453`, outer SHA-256
`9405e717f2b0ea2b904369ca6b4728713ed4a2ecb2bf4079503d378f949c6e30`
([candidate run](https://github.com/mekhovov/revealline/actions/runs/36761266255)).
Use whichever exact artifact the release owner finally selects; this pointer is a
checkpoint, not a request to benchmark every superseded head.
Carry evidence forward only when its relevant byte identities and scope actually match.

### P1 / Q4 — installed/offline lifecycle and real release acceptance

Infrastructure and historical actual standalone-PWA evidence already exist.
`optional-installation-83706c992.json` covers two installations, offline coexistence,
distinct candidate update, failed-install pointer preservation, rollback and scoped
removal. The saved proof/profile fixture is synthetic; it is not physical-radio evidence.

Recheck the final changed package paths: bundled language/game-return navigation
offline; two independent installs; interrupted/corrupt update; current/previous
version restoration; removal without harming the other package; retained real
software-earned proof/profile data. Keep model/schema migrations separate from a
code-only update. After publication, verify actual downloaded/deployed originals
and ordinary player behaviour/rollback on the real target.

## 7. Publication decision and deferred work

Continue one coherent source batch at a time and parallelize independent code,
content and diagnostic work. Keep compatible changes in one owner integration PR
while it is open and not already under frozen qualification. A qualifying head is
left unchanged; a later source batch is combined by the release owner when ready.
Documentation-only status work does not reserve another product version.

For the next implementation PR, develop Batch G feedback/comparison and Batch H
authoring in parallel against the same shared contracts, with reviewed commits per
slice. Combine compatible P2 sound/identity work only while that head is still open
for implementation. Run scoped validation as each slice lands; perform the full
selected-artifact qualification once the batch settles. Do not wait for unrelated
PRs to merge, repeatedly freeze every content increment, or append unrelated work
to an already qualifying head.

Release coordination still owns versions, merge order, one selected immutable
candidate, upload, selector changes and public acceptance. A new PR, passing
candidate job or milestone assignment is not publication.

There is a real deferred-review boundary: dedicated edition promotion currently
requires `human-pacing-and-comprehension` and asset review; optional-package
promotion requires `human-learning-and-pacing` and `asset-and-license-review`,
with evidence-bound passed gates.
See [edition promotion](../publishing/edition-promotion.mjs) and
[optional review](../publishing/optional-package-admission.mjs). Keeping these
reviews deferred permits source integration and candidate previews, but does not
satisfy those dedicated promotion validators. When promotion is next, either
complete the required review or make a separately authorized, explicit policy
change. Do not invent passed receipts or silently convert the deferral into a waiver.
Download-only edition promotion still requires complete frozen review; a capacity
selection is not a review bypass. This does not block continuing the technical
batches above or undo rolling-main availability.

Deferred: human pacing/comprehension/artwork review and the physical radio/device
matrix (actual model, firmware, USB mode, OS/browser, calibration, reconnect,
latched switches and airborne recovery). Software input fixtures do not replace them.

Later extensions, outside this delivery: Bluetooth/wireless qualification, drivers
or aircraft connections, imported Betaflight rate profiles, more realistic aircraft
emulation, multiplayer/authentication, native branded app identifiers/storage and
large simulator environments/media libraries. Hands-on training remains civilian.

The original Coupa proposal for mandatory lesson completion before progression
is not restored implicitly. Current lessons are optional; the later approved
six-win finale plus separate application-bonus contract remains authoritative.
A future compulsory-learning audience edition would need new declared requirements
and compatibility treatment, not changes to already-earned promises.
