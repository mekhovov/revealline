# Character motion, game feel and authentic artwork

Approved scope updated 28 September 2026 through nine implementation batches and the user’s C3–C6 priority revision. This replaces the earlier character-improvement order; the [current delivery checkpoint](plan-status-2026-09-28.md) and single publisher still own release acceptance. Source base: `bb9b3640270dc26633d37cfdf4a306aecda277b6`; the seventh checkpoint is `efa33669249402ede3e1e651f1d4f3ad8f840c03`. An implemented candidate below is not a published release.

## Batch policy and current delivery state

The latest user instruction supersedes one-PR-per-phase ordering: keep compatible C0–C7 work in **draft [PR761](https://github.com/mekhovov/revealline/pull/761)** while the publisher queue is occupied. Develop independent features in parallel, review and commit bounded changes inside that PR, then freeze the verified subset when the publisher admits it. Do not wait for a merge to prepare independent art, tools or evidence; do not delay a ready release for unrelated unfinished production.

Latest main observed for this review is `a10fcbf8ae982f31d684f8abdc265d7e0338b3db`; the ordinary live selector now reports v0.142.1 with game source `7138e7b6187bf69991d50313c3f9ac1620427778`. The separate 17-input player-readiness batch is merged as PR768. Its published selector identity is verified here; this branch does not repeat or expand the publisher’s public-play evidence. This branch remains an unversioned feature input. That owner reconciles it onto accepted source, checks overlap with queued UX fixes, assigns a version and owns publication. Existing tags, source originals and historical evidence remain unchanged. No release or public acceptance is claimed for this actor batch.

## Implemented and awaiting integration

**28 September proportion revision:** the user's actual-size review rejected the first declared-rig propellers as too small. Prior motion checks remain evidence of animation only. C1 delivery now requires the [larger-propeller comparison and reference review](drone-reference-review.md), including smaller hubs and slimmer bodies; do not release the old visual result as accepted. All 22 newly supplied examples have been inspected and 24 additional official references located. The user selected the generated 16-machine roster as the desired visual direction. Preserve that richer appearance while preparing separate native bodies and correctly handed moving parts; concept approval does not establish runtime readiness.

- C1 proportion candidates now cover all seven FPV classes in native 32/64px and a separately rigged border-patrol body. Sixteen exported PNGs total 6,739 bytes. They remain outside published collections; existing 30 sprite constructions and immutable originals are unchanged.
- The presentation reader supports explicit per-anchor direction/phase with unchanged fallbacks for historical rigs. New fields require a compatible reader and new asset revision; old strict readers must not receive them in a retrofitted record.
- C1 research distinguishes props-in/out, six-hub and coaxial arrangements, aircraft propellers, wheel/track motion and wakes. The candidate quad uses the researched props-in convention; this does not claim a named Ukrainian manufacturer's exact configuration.
- C1's second batch adds four native **reference-v3 scout/carrier body PNGs**, in 32/64px treatments, totaling **1,829 bytes**. Their equipment, camera and frame detail is drawn at each native size, with no baked moving blades. They inherit the exact reference-v2 rotor centres, sizes and directions; all sixteen v2 source rasters remain unchanged. The [body-detail comparison](verification/rotor-motion/body-detail.html) keeps the old and new bodies separate. These candidates still require actual-size/full-board art review and explicit production adoption; the wider richer-body roster remains open.

- C0 current-entry audit compiles the actual 91 Solo / 91 Versus / 12 Team defaults, preserves exact content and artwork identities, identifies nine used authored roles, seven FPV classes and 61 actor slots, and detects the stale saved inventory. See [baseline and reproduction](actor-motion-live-baseline.md).
- C1-A restores declared prepared player rotors, shares connected blade construction between Solo/Versus and Team, bounds apparent phase advance, and preserves manual/original image precedence. Fourteen player sprites retain their exact bytes and geometry; no new patrol rig is inferred. See [rendered evidence](verification/rotor-motion/README.md).
- C0/C7 now generates a reproducible disposition queue across 194 current mission/mode owners, 631 placements, 125 distinct actor bindings, 103 exact mission-artwork bindings and all 335 compiled slots. It distinguishes **Keep 228 / Repair 15 / Review 332 / Replace 0**, with five explicit unknown scopes. No missing slot binding is found; this is not visual production approval. See [the queue and policies](verification/actor-motion/README.md).
- C2 retains the [Game Feel Lab](../authoring/game-feel-lab/) for its authored feedback sequence, independent capture/actor/trail-effect controls, reduced effects, pause/step/seek and bounded local draw-cost sampling. The second batch adds a separate [playable comparison](../authoring/playable-benchmark/) using three existing current-source missions: **First Return**, **A Return in Reserve** and **Crossed Bands**. Both views share one real fixed-step simulation, standard difficulty, Scout, immediate turns and seed 1. The host retains the accepted exact original artwork and approved FPV actor lease without promoting candidate artwork's review status.
- The playable host adds win/loss feedback, deliberate Retry with the existing **600 ms ready cue**, reset presentation phase, and replacement rollback that preserves the prior paused run on failed or cancelled loading. It clears held controls, cancels stale work on departure, returns from BFCache paused, and releases owned assets/listeners on final disposal. Delayed result focus respects intervening user navigation. It writes no awards, persistent data or replay records. This source authoring benchmark does not establish public, full-product, audio/haptic or physical-device acceptance; Workshop alone also does not supply the optional Phase originals for offline play.
- C3 separates prepared Team body artwork from functional contact/identity cues: remove the duplicate painted face/centre cover, keep an outlined exact contact radius and the numbered circle/diamond player badges. Missing artwork retains its established fallback. This repairs one readability issue; it does not complete the roster or every Team state.
- C6 extends Motion Lab's per-hub CW/CCW and phase controls with normalized **X/Y** and width-relative **radius** editing, live anchor/sweep guides and complete-sweep clearance validation through the production geometry validator. It accounts for image aspect ratio and pivot; rejected geometry preserves the previous valid draft and preview. EN/UK labels, validated rotor-array JSON import/export, exact unmodified/reset rig representations and stale-edit protection are covered. Historical rigs are not silently migrated or corrected; missing per-hub radius and reader limits are explained. Drafts stay inside the authoring session. Studio integration follows in the third batch below; other moving parts, state authoring and collection policy export remain open.
- C5 preparation incorporates the licensed CC0 **Synevyr Lake rafts** original as an explicit opt-in authoring comparison. Its exact original bytes, author/license/source revision and decoded-memory estimate are retained. Default gameplay stays pixel art; no mission artwork or awarded original is replaced. A bounded reviewed board derivative is required before production use.

The third implementation batch connects the v3 Scout study to the actual playable
comparison. The reference keeps its approved appearance; an explicitly selected
comparison loads separately verified candidate bytes and retained rigs. Failed,
cancelled and stale loads preserve the accepted paused view. Candidate identity
and provenance never become an approved appearance pin. Its three optional
Workshop files add 23,583 bytes without adding them to any mode's core closure.
The complete-board comparison confirms the candidate works in play, but its
slimmer central body still needs contrast review before art adoption.

The same batch adds independent **capture pulse** and **extra event flash**
comparison controls. Local loss/contact, recovery, threat and live-cut information
remain visible and simulation timing remains identical. Broader actor-reaction,
audio and haptic toggles remain open. Asset Studio now exposes native per-hub
position/radius/direction/phase controls, uses its existing full geometry and
slot validator, and retains advanced JSON, stale-edit guards, source bytes and
immutable revision history. This closes the narrow Studio rotor-editing task,
not the whole C6 authoring phase.

Second-batch verification records **149/149 focused checks passing** and body-detail rendered checks with **768 changed frames / 1,536 held poses**, covering both dark and light backgrounds. See the [second-batch evidence](verification/actor-batch-2/README.md). Final browser review exercised EN/UK rotor editing, actual keyboard and on-screen-control wins, deliberate Retry and full-board layouts at 1280×800, 390×844 and 844×390 CSS. These results do not establish whole-roster art acceptance or public/device qualification. The current Team production-review guard still passes **one of two checks**: its source-stage recipe/fingerprint requires explicit production adoption. Keep that failed gate visible and preserve historical fingerprints rather than rewriting them to make the guard pass.

Third-batch verification, including the cancellation-focus follow-up, passes **110/110 focused tests**, repository/scoped lint and formatting, and content/presentation validation. Real-browser checks cover the candidate win and retained Retry, Studio invalid/valid edits, EN/UK status and 44px controls, and the three agreed CSS layouts. See [third-batch evidence and limits](verification/actor-batch-3/README.md). Cancellation now restores its actual Mission/Load/Actors opener or the visible native setup summary; initial and stale delayed operations are covered. The final integrated build, production adoption and public acceptance remain pending.

The fourth batch adds an explicit source-only **reference-v4 Scout contrast**
comparison and bounded, opt-in measurement of actual frame intervals and both
painters' JavaScript draw duration. Its two native PNGs total 838 bytes and keep
the existing silhouette and rig; they decode to a 20,480-byte candidate-only RGBA
lower bound. Source fingerprint/PNG validation and atomic load ownership remain
required. Full-board small-size prominence still needs improvement; this is not
production art approval. The 129-test focused cohort and actual First Return win,
retained Retry, reduced-effects and responsive checks are documented in
[batch 4](verification/actor-batch-4/README.md). Measurements exclude interrupted
segments, retain slow valid samples and distinguish unknown shared/GPU memory.
One local two-painter run does not complete C0 performance qualification.

The fifth batch adds immutable **reference-v5 Scout optical-body** art and a
shared-painter v4/v5 comparison. Broader central equipment keeps the same overall
bounds and rig; no global actor size, contact radius or old candidate changes.
Its 868 bytes of PNGs preserve the 20,480-byte decoded candidate lower bound.
The 137-test cohort and actual 384 changed / 768 held raster checks pass. First Return
again completes with the retained original at tick 414 / 3.45s. The foreground
contact cue remains visible by contract; moving it behind the body would hide it
in interior play, so full-board cue/art balance remains an explicit review item.
See [batch5](verification/actor-batch-5/README.md) and its exact production-adoption
checklist. The current default routes are unchanged by merged PR768, but main's
FPV97 / audio49 history must survive reconciliation of this older FPV93 branch.

The sixth batch studies the remaining centre-cue obstruction without hiding the
physical contact point. An explicit **Fine outline** comparison narrows only the
dark backing from three to two renderer units, preserving each renderer's existing
scale convention. Its complete bright circle and geometry remain unchanged.
Solo/Versus and Team share this bounded choice. Native raster verification found
a later Team pass still painting a filled marker over prepared drone bodies;
the correction moves the single prepared outline into that final foreground pass.
Fallback markers and Solo defaults remain unchanged. The playable comparison retains it on Retry
and pauses safely on changes. A separate native raster study exercises real
renderers over static edge, overlap and light/dark fixtures; it is not a mission
playthrough. Actual loss/recovery/capture messages now use the existing localized
failure explanations and core events, replacing stale internal-code feedback.
Terminal narration has one live-region owner. See [batch 6](verification/actor-batch-6/README.md)
for exact checks, corrected fixture failures and remaining adoption limits.

## Seventh batch: benchmark parity and combined threat guidance

The next review found that the comparison tool created a run from its authored
level without the ordinary fresh-attempt Standard tuning. It now applies the
shared pure tuning recipe once, retains the owned effective level for Retry,
and displays authored and effective runtime identities separately. Player
preferences, originals, actor pins and simulation rules remain unchanged.
Earlier batch 1–6 benchmark outcomes remain **untuned authored-level evidence**,
not public Standard balance proof; their visual checks keep their original scope.

Independent tests compare all three benchmark missions with the ordinary source
attempt preparer: initial state, 240 ticks each (720 total), and retained Retry.
Paired effective routes establish locked targets, 90-tick warning, bounded
commitment, capture cancellation and the consequence of extending a cut. Enemy
cooldown does not clear a travelling line impact. Human readability and fairness
still need player sessions.

Field details now compose pursuit/interception state with trail-impact capability
for explicitly combined actors. Current v1 benchmark missions do not set that
explicit carrier flag; their pressure text is preserved. This is a narrow
information correction for supported combined actors, not a new enemy behavior
or a claim that every role description is finished. Slow benchmark decoding
also keeps its loading message until preparation actually finishes.

**65/65 benchmark tests and 20/20 mounted Details/combined-threat tests pass.** See [batch 7 evidence](verification/actor-batch-7/README.md) for exact checks,
retained failures and native-browser observations. This is another bounded
checkpoint in the same PR761, with no extra release or version allocation.

## Eighth batch: parallel C3–C6 implementation

- **C3:** a complete seven-class native body cohort uses the retained C1 rigs.
  Scout and six-rotor Carrier preserve their accepted candidate bytes; five
  additional equipment silhouettes have native 32/64px treatments. Fourteen
  PNGs total 6,240 bytes. The source-only [roster review](verification/rotor-motion/roster.html)
  uses the actual Solo/Versus and Team painters, exact PNG bindings and bounded
  frame checks. Runtime production adoption, tiny contact-cue/art balance,
  wider enemy roles and Team state coverage remain open.
- **C4:** optional scout/sentry authoring no longer downgrades v9 pressure
  recipes to v8 across the project. Untouched missions retain their simulation
  identities. Explicit on/off, both turn policies, combined attacks,
  replay/restoration, cancellation and Studio Undo/export pass focused checks.
  At this checkpoint the live-preview guard and Team restriction remained in
  place; batch 9 below supplies the Solo practice dependency. No current mission
  gains an attack. See [the authoring contract](combat-pressure-authoring.md).
- **C5:** three original Ukrainian/community scene sources, recorded prompts
  and structured references are retained byte-for-byte. Their 7,633,598 bytes
  remain source candidates outside runtime collections. Prepared board
  derivatives, cultural correction, branding and cross-mode review are next.
- **C6:** the actual Asset Studio imports/exports a bounded `.rlart` collection
  packet, checks all original hashes before native image decoding, preserves
  accepted content on failure/cancellation and records explicit pixel-art or
  photographic-reveal treatment. EN/UK controls and provenance keep source
  links intact; treatment edits retain selection and increment the draft
  revision. This separate source draft does not change historical `.rltheme`
  records or approve runtime assets. See [format and limits](artwork-collection-packets.md).

See [batch 8 verification](verification/actor-batch-8/README.md) for focused
checks, actual packet round trips, the corrected selection/link defects and
raster evidence limits. C3–C6 remain partially implemented phases. C2 is not a
prerequisite for their next bounded production/authoring slices.

## Ninth batch: actual optional-combat practice preview

The shared Solo/Versus `BoardPainter` now renders existing optional scout/sentry
bodies, locked warning rays, travelling projectiles and optional cosmetic scrap.
Warning bodies remain below exposed trails and ordinary keepers; projectiles
remain below the player. Malformed active combat fails before the painter changes
its clocks, caches or canvas. Absent/disabled combat preserves the existing drawing
commands. This adopts presentation for existing behavior; it creates no attack,
changes no default mission and does not enable Team combat.

Content Studio can now launch **Play exact Solo preview** for an explicitly enabled
combat edition. The practice child keeps the authored scenario, bypasses ordinary
fresh-attempt tuning and awards no progress. A post-ready frame failure latches
the child in a visible failure state, stops simulation and gameplay input, and
cannot be resumed. Close/Return and a fresh parent launch remain the recovery
path. Static inspection and validated export remain available.

Source checks cover the real painter with combined pressure/sentry states and the
practice failure/relaunch contract. The historical held patch and its evidence
remain unchanged. The effects provenance list now includes the combat view,
presentation and consumed geometry helpers; this deliberately reopens production
review. Exact production adoption/reapproval, integrated frozen bytes and actual
public play remain required. See [current authoring guidance](combat-pressure-authoring.md).

Continue C3 roster/enemy/Team-state work, C4 counterplay qualification, C5 artwork
cohorts and C6 authoring in parallel. Do not hold those independent slices for C2
human sessions or the serialized release queue.

## Tenth batch: Team intent, optional remains and real asset preparation

- **C3:** Team hunters face their locked warning point, then their actual charge
  velocity; recovery holds the pose. Pause preserves heading, and reduced effects
  remove banking even if enabled while paused. Core rules and timings are unchanged.
- **C4:** Content Studio offers a next-preview-only **Show enemy remains** control
  for enabled optional Solo combat. It affects inert residue, not live actors,
  warnings, shots, sparks, scores, checkpoints or replays. Ordinary play is unchanged.
- **C5:** the workshop, Poltava and Synevyr originals now have separately retained
  1152×576 board candidates, plus a 768×576 workshop contain-fit example. Source
  records/bytes survived the actual native export and reimport exactly. Cultural
  corrections and production pixel/art review remain open.
- **C6:** Asset Studio prepares bounded contain/centre-crop derivatives with explicit
  parent/sampling/fit provenance. Motion Lab edits existing wings, thrusters, pulse
  and blink anchors/rates, with validated per-character drafts and useful keyboard
  increments. This does not add new simulation states or change historical recipes.

[Batch 10 evidence](verification/actor-batch-10/README.md) distinguishes focused
checks and actual browser work from production adoption. The full production guard
has **6 passes / 2 failed review assertions**: changed Team source still requires
new reviewed successors. Preserve these failures and historical approvals. Runtime
body adoption, global encounter preferences, broader encounters/cohorts, state
playback, integrated release and public validation remain unfinished. C2 stays last.

## Priority revision: C3–C6 first; C2 last

The latest user instruction supersedes the earlier “C1/C2 before expansion”
condition. **C3, C4, C5 and C6 are the active parallel tracks. C2 is last.**
Publication is a serialized acceptance step, not a dependency for independent
implementation. Keep compatible slices in PR761 with separate commits and
feature evidence; the publisher may freeze a ready subset without waiting for
unrelated work.

| Priority         | Work                                                                                                                  | Required dependency and acceptance                                                                                                                          | Effort remaining after start                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Parallel release | Integrate and publish a verified subset of PR761                                                                      | Preserve current main, immutable history and exact reviewed body/rig dependencies; resolve applicable production gates, build, provenance and public checks | Publisher admission plus integration; no extra version allocated here                                         |
| C3 — active      | Adopt the seven-class native cohort; complete current enemy silhouettes, Team state presentation and native-flow gaps | Use C1’s shared rigs; validate pixels, moving-part clearance, actual-size readability, states and retained appearances per cohort                           | 3–5 days for the remaining phase; native roster slice implemented; production adoption open                   |
| C4 — active      | Qualify existing optional pursuit/interception/patrol/sentry variants through the actual practice preview             | Preserve registered recipes and unaffected identities; complete counterplay, full-mission, retained-artwork and public checks after production reapproval   | 3–5 days; safe authoring and actual Solo preview implemented; broader qualification remains                   |
| C5 — active      | Community/Ukrainian, cultural, Retro and Coupa cohorts                                                                | Original source/provenance and deliberate native artwork; compatible C3 rigs and C6 artwork policy where used; no dependency on C2 pilot                    | 2–4 days per cohort; three sources and four board candidates prepared; cultural/art and runtime review remain |
| C6 — active      | Finish authoring moving parts/states, structured references and collection artwork policy                             | Version new envelopes; keep historical strict readers intact; exercise real import/edit/export/preview and invalid/stale operations                         | 2–3 days in parallel                                                                                          |
| Supporting C0/C1 | Refresh exact affected coverage; finish necessary rigs and per-cohort performance/bounds checks                       | Only the dependency needed by that cohort. Do not wait for unrelated whole-game baseline collection                                                         | Fold into C3–C6 slices; ½–1 day for wider baseline later                                                      |
| C7 / UX6         | Whole-content/player qualification and outstanding terrain/pickup/art/history corrections                             | Every current distinct binding and ordinary flow reviewed; hardware/offline limitations separate                                                            | 4–7 days plus device availability                                                                             |
| C2 — last        | Three-mission game-feel assessment, audio/haptics comparisons and six-player pilot                                    | Two consented rounds with newcomers/experienced players; report fairness and enjoyment, not inferred retention                                              | 2–3 days plus participants/listening/hardware, after the prioritized programme                                |

**Still required immediately:** source/byte identity, provenance, strict-reader
compatibility, moving-part geometry, bounded resources, deliberate input,
retained artwork and applicable focused/browser checks. Simulation changes need
determinism and replay checks. These do not move to C2.

**Off the critical path:** further Scout-only contrast studies and comparison UI,
audio/haptic experiments, the six-player pilot, an exhaustive baseline unrelated
to a changed cohort, new bulk mission production, and unrelated creator/admin
polish. Existing comparison tools remain available; maintain them when shared
changes require it, but do not extend them instead of completing C3–C6.

Ranges are implementation estimates, not guaranteed publication dates. Failed
checks block the affected change’s acceptance; they do not stop independent
work. Source candidates remain candidates until visual review and explicit
production adoption. Neither a pending release nor C2 availability blocks
preparing the next compatible cohort.

## Stable design contract

Original pixel art is the default. Licensed community photographs are optional reveal pictures; characters, effects and controls remain pixel art. Community/museum websites are reference-only unless an applicable license or permission is recorded. Preserve exact originals and prepare separately identified board derivatives. Keep collection artwork treatment distinct from simulation/content identity.

The core loop is immediate trusted controls → understandable danger → connection/seal/reveal/score/sound → useful result → fast deliberate Retry/Next. Never add global multiplayer hit-stop or delay simulation input for decoration. Confirm cannot carry into Cancel/Retry. Retry retains accepted visuals/setup and the existing agreed 600 ms cue; loading keeps the old result/run recoverable.

Use existing roles before adding a behavior system. Optional pursuit asks when to close; interception asks when to change a committed route; patrol/sentry asks when/where to cross; Team combinations ask whether to split or remain near rescue range. Warning, committed action and recovery must read differently. Preserve immediate/buffered steering contracts, original records/replays and independent mode completion.

## Reference and artwork benchmark

The implemented playable comparison uses First Return, A Return in Reserve and Crossed Bands with their existing originals. The **workshop**, **Poltava courtyard** and **Synevyr-inspired landscape** now have original [source candidates and complete prompts](../authoring/library/community-art-cohort-v1/README.md). Their unchanged 1774×887 outputs are verified by the new Studio packet workflow; they are not production-size board derivatives or approved mission bindings. The Poltava candidate still needs regional-detail correction and review. No current mission or earned original is replaced.

- [DroneAid workshops](https://drone-aid.nl/en) and [Social Drone UA](https://www.socialdrone.com.ua/): original practical workshop compositions, recognisable frames, repair details and volunteer collaboration; reference-only.
- [Pyrohiv Kuntseve house](https://www.pyrohiv.com/exponat/khata-iz-sela-kuntseve) and [Polissia](https://www.pyrohiv.com/exposition/polissya): regionally coherent materials, roofs, windows and setting; reference-only.
- [Honchar bandura](https://honchar.org.ua/collections/detail/2135) and [regional clothing](https://360.honchar.org.ua/): cultural silhouettes with regional attribution; cited bandura image is not unrestricted commercial artwork.
- [Synevyr rafts](https://commons.wikimedia.org/wiki/File:Synevyr_Lake_rafts.jpg) and [Lviv High Castle panorama](https://commons.wikimedia.org/wiki/File:Lviv_High_Castle_Sun.JPG): CC0 source candidates, preserving creator/source and derivative identity if incorporated.
- [Celeste control forgiveness](https://www.mattmakesgames.com/articles/celeste_and_forgiveness/index.html), [Deepnight game-feel comparison](https://deepnight.net/games/game-feel/), [Dead Cells design](https://media.gdcvault.com/gdc2019/presentations/Benard-Sebastian-DeepCells.pdf), [Into the Breach postmortem](https://media.gdcvault.com/gdc2019/presentations/Into%20the%20Breach%20Postmortem%20Final.pdf), and [Valve handheld guidance](https://partner.steamgames.com/doc/steamhardware/compat) inform feedback/readability/control decisions, not claims of platform certification.

The current research refresh confirms three useful implementation decisions: [Deepnight](https://deepnight.net/games/game-feel/) supports independent comparison controls, [Dead Cells](https://deadcells.com/patchnotes/29) supports separating optional feedback and background contrast from essential warnings, and [Valve](https://partner.steamgames.com/doc/steamhardware/compat) prioritizes complete controller access and readable 1280×800 handheld layouts. These inform the lab and qualification matrix; they are not evidence of improved retention or platform certification.

The Synevyr photograph is now incorporated only in the optional authoring preview. [Its provenance](../authoring/library/real-world-references/synevyr-lake-rafts.json) records Jan Pešula, CC0-1.0, the exact source revision and SHA-256. The 4,590,659-byte original decodes to approximately 63,489,024 RGBA bytes before decoder/GPU overhead, so it loads only on explicit selection and is not a production runtime dependency. The whole image is contain-fit through secured cells; the source remains unedited. Workshop and museum imagery remains reference-only. The Poltava benchmark should retain the Kuntseve house's coherent roof/window/material details rather than combine unrelated regional motifs.

Current authored pursuit and interception each appear in six Solo and six Versus placements. Scout/sentry capability and three greybox studies already exist but have no current authored default placements. C4 must qualify opt-in teaching, counterplay, configuration/replay identity and fairness, rather than duplicate an existing behavior system.

## Qualification and delivery

Require actual rendered frame changes, stable pause/downed/reduced states, 30/60/120 FPS plus degraded sampling, 20/24/32 CSS pixel review, four headings/edges/overlaps, bright/dark pictures and full-board responsive controls. Compare performance/storage to C0 and preserve existing budgets. Keep modeled timing, actual browser pixels, complete playthroughs and physical-device evidence separate.

C2 needs two short rounds with at least three newcomers and three experienced players: unaided start, recognising safe ground/trail/threat, explaining losses, finding another approach, captures remaining readable, and voluntary Retry/Next. Record locally with consent; no completed human sessions or retention study is claimed.

Use this bounded multi-phase PR as one compatible publisher input. Preserve separate feature evidence and reversible commits inside it; unfinished subfeatures stay explicitly unaccepted. Keep one publisher. That owner adopts exact provenance and preserved historical metadata, assigns the next version, qualifies the integrated source, freezes and publishes immutable bytes, admits the selector, verifies Pages and ordinary play, then marks the batch accepted. Long suites waived by the committed temporary policy remain explicitly waived; focused checks and failed gates stay visible. Unrelated workspace work, original artwork and published releases remain intact.
