# RevealLine audio plan — reviewed 1 October 2026

> **Historical snapshot:** this document records the 1 October 2026 audio review. Queue, deployment, pull-request status, release, capacity and recommendation statements below are dated evidence, not current instructions or current repository status.

This is the current audio-only plan. It reconciles the original five phases with
implemented source, retained verification and the user's listening decisions.
The chronological [implementation record](verification/spatial-audio/implementation.md)
and older receipts remain historical; their superseded blockers are not the current backlog.

## Character voice comfort correction — 4 October 2026

Spoken character/action reactions now default to **off**, including absent, invalid
or unavailable preference storage. Captions remain enabled; saved explicit speech
choices are preserved. Players can enable Spoken reactions in the audio settings.

The user reported that the newly added character/action voices dominate music and
sound effects. Starting from main `3bc7a923da`, lower fresh Dialogue volume from
65% to 25% and apply a shared 0.4 dialogue mix trim in both the main game and FPV
flight. Fresh main-game dialogue gain becomes 0.10 instead of 0.65 (about −16.3 dB).
Existing saved slider choices remain unchanged but play about 8 dB lower through
the new trim. Music ducking during a spoken reaction retains 90% instead of 65%,
so dialogue stays in the background. Dialogue mute/slider, captions, warning
priority, approved recordings and preferred startup remain available/unchanged.

Both generated FPV runtimes were refreshed and their reproducibility checks pass.
86 focused audio/reaction/flight tests pass, including default and saved volume,
storage failure, bus gains, mute and warning arbitration; changed-source lint and
format checks pass. A broader optional voice-download panel assertion (three
inspections versus two expected) also fails on unchanged main and is unrelated
to this correction. No new subjective listening or public release is claimed.
This implements the concrete comfort feedback without closing the wider A3/A5
listening/fit reviews. Radio Armed cues retain their separate existing mix.

## Delivery checkpoint — 1 October 2026

- Main audio redesign: merged in [PR #817](https://github.com/mekhovov/revealline/pull/817).
- Current-host qualification: merged in [PR #851](https://github.com/mekhovov/revealline/pull/851).
- Missing-recording recovery, installed-pack evidence and first plan reconciliation: **merged** in [PR #858](https://github.com/mekhovov/revealline/pull/858) on 30 September, 23:42 Europe/Berlin. Merge commit: `8afd55fd777bc587a7d469d73dff48cd9b330fa5`.
- At its final head `49a517046b928aad6b4f2836fc3cf16a19dc7d3d`, release-ready, focused, candidate, default-capacity, preflight, reconcile and optional-practice checks succeeded. Ordinary test/build jobs were skipped; their status is not reported as a test pass. A1's source integration work is closed.
- This plan review starts from main `955c539a757c08c534c9038500785b20e64abb36`. No subsequent changes to the inspected director, movement mapping or effects bank were found between the #858 merge and this checkpoint.
- The retained audio build embeds `06fe0afbe5a3b8b28714454b8d12b01ff7d85a42`. Its native/offline evidence remains tied to that source, rather than being relabeled as current public acceptance.
- Milestone **v0.150.0 — Unified native experience** remains open, with no due date. GitHub's latest-release endpoint reports v0.142.3 at this review. This does not establish which build a Pages visitor receives; final public audio delivery remains unverified here.
- PR #795 remains untouched. This review changes the audio plan only; soundtrack-library work in other PRs is not taken over.

## Completed implementation by phase

| Original phase                      | Status and player outcome                                                                                                                                                                                                              | Evidence and limits                                                                                                                                                                                                                 |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Baseline and audition            | Complete for the current cohort. Inspected actors/events/terrain, retained source recordings and licenses, built interactive movement/capture/menu audition scenarios and responded to repeated user listening feedback.               | Recorded movement was preferred over generic noise. That approval is useful direction, not a final 20-minute mixed-playback acceptance.                                                                                             |
| 2. Shared sound/VFX infrastructure  | Implemented. Presentation-only director, event ownership, cue variations, preload without stale replay, gain/pan, loop limits, master authority and coordinated reveal effects. Existing simulation and save/replay formats preserved. | Focused source tests and browser decode/mix evidence. Missing-file/decode failures now back off for five seconds instead of retrying every frame; explicit activation permits immediate recovery. That follow-up is merged in #858. |
| 3. Gameplay and spatial integration | Implemented across Solo, Versus, Team, company, replay and Demo integrations. Movement follows displayed bodies; authoritative state supplies warnings/actions.                                                                        | Catalogue and host tests cover mappings and lifecycle. Current installed-pack browser play covers Solo; it does not close every mode/device journey.                                                                                |
| 4. Menus, themes and polish         | Implemented for current source scope. Independent menu/movement/radio settings, recurring-cue calibration, distinct capture tiers, material accents and original startup restored.                                                     | 56 runtime cues; families are intentionally shared, not 56 actors or a unique recording for every skin. Full state-by-state visual/listening acceptance remains deferred.                                                           |
| 5. Qualification and release        | Partially complete. Focused tests, bank integrity, native SFX headroom and installed-pack offline Solo checks pass at their recorded checkpoints.                                                                                      | The #858 source checks are complete; publication/public acceptance, sustained listening and broader platform qualification remain open.                                                                                             |

### Actor, obstacle and event coverage

- **Actors:** explicit movement assignments for 28 shipped player bodies and seven enemy roles across four legacy worlds (28 world/role combinations), all 12 Journey material palettes, company appearances and custom fallbacks. Recorded rotor, wings, paper/grain, wheels and motor are supplemented by ceramic, wood, bell and ratchet accents. Motionless actors and decorative idle animation remain quiet; stationary enemies use action cues.
- **Enemies and abilities:** rover warning/activation/cancellation, eroder preparation/actual or blocked erosion, lane/relay phases and openings, combat lock/fire/impact/cancellation, and Team attacks/interceptions/down/revive/rescue/support have event feedback. Body movement and equipped ability are separate inputs.
- **Spatial mixing:** board-space curve reaches −6 dB at 0.25 of the shorter board dimension, −20 dB at 0.60 and silence at 0.80, with near level through 0.08. Gains ease; pan is capped at ±0.6. Important warnings retain foreground presence. Four continuous layers maximum; Versus reservations prevent one board taking all decorative voices; Team shares sources with the nearest active listener.
- **Obstacles:** held-direction wall contact is transition-based. Slow terrain, directional flow and signal zones have state-dependent feedback. Terrain capture/erosion produces neutralized/reactivated accents; textures follow authoritative cells, with one source per zone. Gates release immediately with local feedback. Supplies, class switches and deployment have distinct event cues.
- **Picture capture/results:** newly claimed area excludes walls from its denominator. Small <2%, medium 2–8%, large ≥8% use 200/400/650 ms gestures. Larger capture adds breadth, not merely loudness. Closure/reveal/material layers are coordinated; victory supersedes the ordinary capture ending. Reveal decoration is cell-clipped; gate pulses and existing win/loss timing are retained. Start/retry/damage/respawn/loss/win remain separate.
- **Controls:** Menu sounds/volume default to enabled/35%, Movement sounds/volume enabled/50%, and FPV radio enabled/35% after audio activation. Preferences are independent; master mute governs all. Movement opt-out retires actor layers without removing warnings. Paused menus retain menu feedback.
- **Comfort:** confirm, paper, pickup, contact and reveal families were softened and varied. Whole-bank rolling 50 ms RMS targets, transient/peak limits and within-family checks replaced partial calibration. Numeric matching is complete; perceptual balance with music remains unapproved.
- **Startup decision:** keep the user's preferred original synthesized ESC-style start/retry. Authentic recorded launch beeps were auditioned and rejected; they are not a remaining required replacement. Official EdgeTX English/Ukrainian Armed recordings, source bytes, recipe and GPL-2.0 license are retained. Do not describe the synthesized startup as a real Betaflight recording.

### Verification already completed

1. [Merged-main qualification](verification/spatial-audio/merged-main-qualification.md): 138 focused plus 24 Couch host checks passed. Native browser decoded 56/56 cues. Seven actual SFX overlap measurements, with four movement layers and no compressor, remained unclipped in stereo and averaged mono; maximum stereo peak was −19.48 dBFS. These measurements exclude music.
2. [Installed audio and recovery qualification](verification/spatial-audio/offline-ready-qualification.md): 167 integration checks passed with no skips at the implementation checkpoint. The count supersedes the earlier cohort; do not add the overlapping totals.
3. Exact built bank: 56 runtime cues, 4,479,040 bytes (4.27 MiB), approximately 12.8 MiB decoded at 48 kHz, within the 8/32 MiB targets. The optional pack has 58 WAVs because it also includes two redistribution source recordings. Asset, inventory and source hashes agree.
4. Fresh browser installed Starter plus Optional spatial sound effects. With the origin server stopped, cached Solo play covered capture/victory/Next, partial capture, damage/respawn and pause/resume. Cache verification found zero missing or corrupt files. Later native-key steering preserved explicit master unmute. Earlier locator-driven captures did not reliably retain that state and are gameplay evidence only.
5. The former core-cache budget failure and obsolete Couch test navigation were resolved. Sound WAVs now belong to the deliberate optional pack; metadata remains core. No new investigation of those resolved blockers is scheduled absent a regression.

## How to read the remaining work

**Implemented** means the game contains the behavior. **Verified** means a specific
check passed on an identified build. **Released** means players receive it in the
published game. These are different milestones: working sound files and passing
tests do not establish that a player finds repeated cues pleasant.

The open checks below are not evidence that the game is broken. They describe
uncertainty we have not yet resolved. Do not generate extra features merely to
make the checklist longer. Fix confirmed problems and preserve approved sounds.

The recommendations below are **proposed for user review**, not a claim that the
user has lifted the existing deferral of extended listening/device review. Per
[delivery priorities](delivery-priorities.md#current-instruction--29-september-2026),
that work stays deferred, not passed, and does not block independent source work.

- **P0:** delivery correctness; complete before claiming this audio work is publicly delivered.
- **P1:** most valuable next player-quality work; recommended when qualification resumes.
- **P2:** broaden confidence after the main experience is checked, or promote when a target platform/mode matters now.
- **P3:** optional polish; do only for a demonstrated benefit.

| ID  | Updated recommendation                            | Current status                                           | Plain-language outcome                                                        |
| --- | ------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------- |
| A1  | Closed                                            | Source integration complete                              | The audio follow-up is merged; do not keep waiting on #858.                   |
| A2  | P0, coordinated with release                      | Scheduled; public acceptance unverified                  | Players actually receive the correct sounds and working settings.             |
| A3  | P1, first listening work                          | Deferred                                                 | Frequent sounds remain pleasant through a real session with music.            |
| A4  | P1, common lifecycle first                        | Source coverage exists; built playback matrix incomplete | Sounds stop/resume correctly and both players hear useful feedback.           |
| A5  | P1 targeted review, P2 exhaustive sweep           | Source coverage exists; perceptual review incomplete     | The sound matches what visibly happened and helps explain it.                 |
| A6  | P2 generally; P1 for an immediate target platform | Deferred                                                 | Audio works on the devices and offline situations we intend to support.       |
| A7  | P3                                                | Optional                                                 | Extra recordings add useful identity where existing shared sounds fall short. |

### A2 — Make sure players receive the finished audio

**What we do:** the canonical publisher includes the merged source in its final
release, then we check the published version, menu controls, bank files and the
Optional spatial sound effects download. Confirm that selecting/installing the
pack and returning to play makes the recorded sounds available. We do not create
a competing release or change PR #795.

**Why / benefit:** local success is of little value if the published game still
uses an older build or cannot deliver the files. This closes the gap between
finished code and the experience available to players.

**If postponed:** source work remains usable and merged, but players may not yet
receive it. We cannot truthfully call the final audio follow-up publicly delivered.
The optional-pack policy also means recorded sounds are not guaranteed merely
because the basic game was installed; the published install journey needs checking.

**Priority and scope:** P0 for delivery claims, not an instruction to wait idly
before other work. The check is bounded; publication timing is a publisher dependency.
Done means a named version/source, matching deployed files and a successful public
install/play/settings smoke check. Do not reopen completed A1 unless new changes fail.

### A3 — Check whether repeated sounds stay comfortable

**What we do:** play at least 20 minutes using the current sound bank with music.
Include frequent small captures, paper/pickup/confirm cues, large captures,
continuous movement, nearby enemies and warnings. Compare speakers, headphones
and mono. Record the build, music and volume settings and the moments that feel
sharp, repetitive, tiring or too quiet; adjust those specific cues and compare again.

**Why / benefit:** equal measured volume is not equal perceived comfort. A bright
click can be irritating despite a low peak, and music can hide an otherwise clear
warning. This directly addresses the user's repeated complaints rather than adding
more content. It can produce a quieter, more cohesive game with clearer danger cues.

**If postponed:** all files can pass numeric tests while players still mute the
game or miss a warning. That is a plausible unresolved risk, not an observed failure
of the current mix. Existing SFX-only headroom and simulated soaks do not answer it.

**Priority and scope:** P1 and the first subjective review to resume. Bounded but
requires real listening; engineering measurements can help locate problems but
cannot replace a listener's comfort judgment. The agent can prepare comparisons,
collect measurements and implement fixes; a human listening pass is still needed.
Done means retained listening notes and retested fixes, not just 20 minutes elapsed.

### A4 — Check pause, restart and shared-screen play

**What we do:** first exercise ordinary pause/resume, background/foreground,
retry, character switch and sound toggles. Then test Versus with two active boards
and Team with shared enemies, downed players and rescue. Check replay seeking and
practice transitions where those modes are in the delivery scope. Listen for loops
that continue after leaving a scene, duplicated attacks and one board drowning out
the other. Include music in the built-game checks.

**Why / benefit:** these transitions are where sound ownership becomes complicated.
A correct single-player loop does not prove that two boards share the sound budget
fairly, or that returning from another tab restores the intended state. Closing
this check makes audio predictable during everyday play and couch sessions.

**If postponed:** a player could encounter lingering motors, missing movement,
doubled effects or confusing warning direction. Existing regression tests reduce
that risk; native playback of the full matrix has not yet ruled it out.

**Priority and scope:** P1 for common lifecycle and any advertised couch experience.
If near-term delivery is Solo-only, move the extra couch/replay journeys to P2,
while retaining pause/retry/background checks at P1. This is several bounded mode
journeys, not a request to rewrite the mixer. Done means actual build observations
with no stale/duplicate sources and clear warnings for the intended listener.

### A5 — Check that the sound fits the visible action

**What we do:** start with representative high-impact examples: ceramic/wood/metal
contact, a moving bird versus a drone, blocked versus successful erosion, a relay
opening, terrain becoming safe/dangerous, and capture leading to victory. Compare
timing and meaning with the animation, including reduced effects. Expand to the
remaining Journey/world/company/custom combinations after that targeted pass.

**Why / benefit:** mapping every actor to a sound family prevents silence, but does
not prove a pottery character feels like pottery or that a scrape occurs precisely
when contact happens. This is the final check of the original request for sounds
that suit bodies, materials, actions and reactions. Correct timing and material
identity improve both atmosphere and understanding of gameplay.

**If postponed:** the game may be technically complete yet feel generic or convey
an ambiguous state change. Shared recordings are not automatically a defect; only
replace or retime sounds when the observed combination is unconvincing or misleading.

**Priority and scope:** promote the representative pass from the previous P2 to
**proposed P1**, alongside A3, because fit was a central user goal. Keep an exhaustive
all-material/all-mode sweep at P2. Done means recorded examples for the selected
matrix, with any mismatches fixed; it does not require unique recordings per skin.
Visual changes stay limited to synchronized audio feedback in this workstream.

### A6 — Check the devices and offline situations players will use

**What we do:** select actual near-term targets, then verify first audio activation,
background/lock interruptions, saved settings and downloaded-pack playback on
those devices/browsers. Extend offline journeys to needed multiplayer modes and
test genuine disconnection plus missing/corrupt-file recovery. Test physical devices
when making physical-device claims, rather than treating desktop emulation as proof.

**Why / benefit:** browser audio permissions, interruption behavior and storage differ.
A desktop Chromium success cannot establish iPhone/Safari or Steam Deck behavior.
This prevents device-specific silent starts or offline surprises.

**If postponed:** the checked desktop/Solo experience still has its evidence, but
other platforms remain uncertain and must not be advertised as qualified. The risk
is more important if those platforms are the main audience for the next release.

**Priority and scope:** P2 by default; promote the specific platform to P1 if it is
being launched now. Do not test every possible device before source work continues.
This is the broadest item and depends on hardware availability. Done means an honest
list of tested devices/scenarios and unresolved limitations, not a blanket native-ready label.

### A7 — Add more unique recordings only where they help

**What we do:** use findings from A3/A5 to choose a small number of weak spots.
Audition replacements at matched levels, preserve licenses/originals/recipes, and
check that they fit the mix and memory budget. Additional radio phrases must convey
real gameplay state rather than invented telemetry.

**Why / benefit:** a well-chosen accent can give a particular actor or material more
identity. This is refinement, not missing baseline actor coverage.

**If postponed:** some actors keep shared family sounds. That is acceptable when
the sound fits; there is no established correctness defect from sharing a recording.
Adding too many variants can also harm cohesion and increase download/review work.

**Priority and scope:** P3, optional and narrowly selected. Earlier optional polish
already delivered ceramic, wood, bell and ratchet accents. Keep the preferred original
startup: the recorded hardware alternative was rejected. No new startup replacement
or broad sound-library search is required without a new reason or user decision.

## Proposed sequence and decisions for rebalancing

1. Keep A1 closed; coordinate A2 with the canonical release rather than making it
   a recurring implementation task.
2. When listening review resumes, combine A3 with the representative A5 examples.
   Fix repeated-cue discomfort and misleading feedback before adding recordings.
3. Complete A4's ordinary lifecycle checks, then the modes actually shipping.
4. Complete A6 for the immediate audience's devices; broaden A5/A6 afterwards.
5. Use A7 only for specific remaining weaknesses.

**Recommended balance:** comfort and fit first, reliable behavior next, platform
breadth according to audience, additional content last. If the user's aim is only
getting the existing source released quickly, keep A2 first and retain the deferred
checks explicitly. If the next launch is mobile or couch-focused, promote that part
of A4/A6 ahead of the exhaustive theme review.

The useful decisions are: (1) resume comfort/fit review now or keep release-first
with deferred listening; (2) which platform and Solo/Team/Versus modes matter first;
(3) whether any specific existing sound still needs replacement. These are scope
choices, not a request to approve every technical step. Until the user rebalances,
recommendations remain proposed and the existing deferrals remain in force.

## Acceptance accounting

- **Implemented and regression-tested:** spatial curve/pan/voice policy, foreground warnings, actor mappings, capture tiers/coalescing, independent settings, no stale async cue replay, lifecycle cleanup and failed-download backoff.
- **Measured within a defined scope:** packaged bank budgets/integrity, browser decode, SFX-only stereo/mono headroom, and one installed-pack Solo offline journey.
- **Not yet established:** full mixed-music listening comfort, every mode/material's audiovisual acceptance, physical platform support, and public acceptance of this final follow-up. Source integration and the #858 release-readiness checks are now complete.
- **Preserved design constraints:** no changes to steering, collisions, scoring, simulation randomness or replay formats are intended. Focused compatibility checks support this; they are not a substitute for the final repository-wide candidate gates.

Historical receipts remain unchanged. This plan supersedes their old open-item
lists, not their measurements or source identity. This review changes documentation
only and does not claim new runtime tests, listening approval or publication.
