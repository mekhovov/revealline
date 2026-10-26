# FPV delivery review — 16 October 2026

This is the current priority and research review. It supersedes the older
“Current state” and “Next delivery order” sections in the
[large-worlds plan](fpv-large-worlds-delivery-plan.md). Preserve those sections as
history. The [delivery log](fpv-continuous-delivery.md) retains exact receipts and
failed attempts; the [per-offer public report](fpv-public-map-availability-20261016.md)
remains the detailed launch matrix.

Reviewed source: main `aac03bf056d9e6b1d0e883841f6116ed948f2dc1`, including merged
Alpine Library admission [#1535](https://github.com/mekhovov/revealline/pull/1535).
Public observations below have their own identities and do not automatically
inherit later main commits. Research uses official manuals, publisher pages and
technical documentation, accessed 16 October. It is documentary research, not a
new hands-on comparison or a competitor performance benchmark.

## What is completed, and what remains unqualified

| Area                      | Completed evidence                                                                                                                                                                                                                  | Remaining acceptance                                                                                                                                                                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public map access         | Main menu More → SIM, all 14 built-in environments, all 20 Worldpacks with one course sampled each, and 13 of the earlier 23 regional editions actually launched publicly. Those 13 cover all ten authored families.                | Ten older regional edition launches and newest Alpine R6 public flight. R6 public source delivery is now verified. These counts overlap by family and are not 57 distinct landscapes.                                                           |
| Content integrity         | All earlier 23 regional descriptors and 11,492 supporting files passed public integrity checks; all 20 Worldpack hashes and 41 course definitions validated.                                                                        | R6 is additive: main and the byte/AST-verified public catalogue now contain 24 offers. R6 descriptor/pin checks pass on deployed `aac03bf0`; actual public launch remains separate.                                                             |
| Regional capacity         | Approved regional-only 512 MiB limit merged in #1531; actual Pages marker `3e43dc1d` and four relevant modules were independently byte-verified. Early checks and EN/UK capacity errors are implemented.                            | Actual native retention above 256 MiB and coexistence of all 24 editions. Logical accounting of 427,609,228 bytes fits 512 MiB; that is not an observed installation or browser disk overhead.                                                  |
| Alpine station R6         | Source, immutable delivery and Library admission are merged. Exact optional and Company original archives qualify. Bounded local native download, cached start, three cameras, safe mode/input changes, EN/UK and two reopens pass. | Public catalogue/capability/descriptor checks now pass. Actual public R6 flight, whole-region art acceptance and physical-device qualification remain open. Local success does not repair the separate public persistence failures.             |
| School and demonstrations | All 178 bundled proofs independently complete in software: 58 School, 24 Academy and 96 other ordinary proofs. One full Acro tilt demo completed publicly.                                                                          | All 58 School native demonstration/HUD comparisons. Another 86 ordinary entries lack bundled demonstrations: 30 Adventure use a separate archive and 56 Hunt/pursuit have none. Prioritize demonstrations where a player needs to learn a task. |
| Reliability               | Exact package, rollback, repair, retained revision and bounded normal reopen checks exist. Recording/archive D6 increments are merged.                                                                                              | Public closing-database transaction failure and later zero-visible-saved-maps failure; full restart, network-wide offline, quota/eviction and interrupted-flight recovery.                                                                      |
| Performance               | Shared simulation, bounded resident windows, render/collision ownership, observer tooling and short native diagnostics are implemented.                                                                                             | No qualifying authored two-hour flight. Four failed full attempts and the later bounded diagnostic failure remain negative evidence. Actual scheduling/JS/GC/driver cause is unknown.                                                           |
| Art and activities        | Ten regional families, existing practice/challenges, Library packs and bounded Alpine/Lunar visual improvements are available at different qualification stages.                                                                    | A final representative quality standard, cohesive districts and activity coverage, later named regions, sustained performance and physical acceptance. Area or offer count alone is not quality.                                                |

R6 public source gate: Pages run `38830488894` succeeded; the actual deployment
marker is `aac03bf0`. The canonical catalogue and imported capability module match
the reviewed structure, including all 24 expected offers, and the offered R6
descriptor matches SHA-256 `92b7ed6acb426a04b007006a72536b8178bd0ad59bba7182637e25fd0d4cf804`.
The [durable public receipt](https://github.com/mekhovov/revealline/pull/1535#issuecomment-6205549263)
has hash `ead3757b811f32ce2448006877ad45de27dc7ca000efe54fe716bd31720f7118`.
This is an HTTP/source gate, not a public UI install, flight or persistence test.

The later public Library reopen showed zero saved regional rows and no installed
Worldpack cards, after a separate closing-connection error. No Remove, reset,
import or restore occurred. Actual original database contents and cause remain
unobserved. Earlier successful 13-region/20-pack retention is historical evidence,
not a current reliability pass. Capacity expansion is not a causal storage repair.

## Recommended priorities and exit gates

### P0 — Diagnose saved-map visibility and connection ownership

**Work:** reproduce the actual failure with bounded, read-only lifecycle evidence
in the affected supported browser context. Distinguish failed/unknown reads from a
successfully empty Library. Identify the connection owner and lifecycle trigger
before changing connection behavior. Preserve existing maps, revisions, recordings
and diagnostic packages. A usable last-known list may be shown as stale/unknown;
it must not imply that absent rows were deleted.

**Why / benefit:** a player must trust that downloaded worlds and practice records
remain available. **If skipped:** more content can increase downloads and effort
without making saved content dependable.

**Done when:** an evidenced cause has a focused fix and meaningful regression;
normal close/reopen, safe mode/input changes, interrupted preparation and recovery
preserve the affected data and explicit arming. Actual restart/offline/eviction
journeys are separately recorded. Do not clear stores, create replacement empty
databases or blindly reconnect to obtain a green result.

**Independent increment:** [Draft #1537](https://github.com/mekhovov/revealline/pull/1537)
reduces temporary asset materialization during metadata-only Library listing. Its
current software sample changes batched asset-bearing row
reads into one-row cursor projection while preserving order and fields. Independent review, CI and package/native qualification remain open. Native
memory/time benefit is unmeasured; this does not explain or fix the public errors.

### P0 — Finish the public map delivery ledger

**Work:** reconcile the actual deployed commit, catalogue and immutable offer bytes;
finish the ten older regional launches and newest R6 public flight. Keep an explicit
per-offer distinction between source merged, package qualified, local native,
public bytes, public launch and persistence. A later passing attempt never erases
an earlier interruption or failure.

**Why / benefit:** completed development becomes discoverable and playable from the
normal SIM menu. **If skipped:** a merged change may still be unavailable, stale or
unusable for players.

**Done when:** the current public catalogue exposes the intended compatible editions,
each remaining offer launches through normal UI, and results/known limits are in
the per-map report. Verify all-24 coexistence and reopen after safe headroom is
available, in an explicitly identified supported verification context. Preserve
the affected public context while its saved-data visibility remains unexplained;
do not repopulate it to hide the failure. A separate-context coexistence pass cannot
close the original persistence issue. Do not count descriptor downloads as gameplay
or logical capacity as native retention. This lane can proceed during unrelated
source work and queues.

### P1 — Establish stable performance before another endurance attempt

**17 October evidence review:** the preserved 9207 failure has a 516.9 ms
begin-to-begin interval, with 515.7 ms between the preceding measured end mark
and the next begin mark. No retained observer entry explains that interval;
this does not establish a scheduling, GC or GPU cause. The
[boundary review and next native trace protocol](fpv-authored-terminal-gap-review-20261017.md)
and [derived receipt](fpv-authored-terminal-gap-review-20261017.json) identify the
next bounded diagnostic. No runtime optimization or new elapsed run is claimed;
all existing gates and failed reports remain unchanged.

**Work:** obtain actual phase/caller evidence for long frames, then optimize the
measured bottleneck. Compare the same scene, route, browser, viewport and quality
before/after; record frame-time percentiles and maxima, resident resources and
memory where observable. Measure input sampling and callback delay separately
from input-to-photon latency. Preserve immediate actual-input response and keep
HUD/layout work outside simulation dependencies.

Add a **latency-priority graphics preset** only as a bounded render tradeoff:
reduce costly optional effects/resolution before reducing flight visibility.
Keep geometry, collision, physics and accepted proof outcomes equivalent. Make
any automatic quality change understandable and reversible; do not oscillate
quality during a manoeuvre.

**Why / benefit:** predictable response matters more than extra decoration when
flying close to obstacles. **If skipped:** long sessions and denser art can amplify
stalls; a prettier still image may feel worse to fly.

**Done when:** a justified optimization passes same-workload comparison and a fresh
actual two-hour authored run meets the existing clock, route, visibility, contact,
resource and 250 ms maximum-gap gates. Never sum smoke runs, accelerate time or
relax a gate. The retained 60 fps desktop / 30 fps mobile targets require named
actual devices and browser versions; current desktop browser samples do not prove
iPhone or Steam Deck performance.

### P1 — Simplify Library discovery and session setup

**Work:** review the existing catalogue against a **one-card-per-region** presentation,
with a Versions drawer for preserved editions. Recommend the newest reviewed
compatible offer without silently replacing an installed revision. Offer activity,
download state and environment filters, a recommended safe start and concise map
extent/quality labels. Keep Preview distinct from qualified content. Show real
download size, stored state and optional offline behavior before starting.

Keep Play → download if needed → Ready/disarmed → explicit Arm short. Preserve
saved places and camera/mode preferences. Reuse the existing camera shortcut,
shared paused setup, radio actions and calibration rather than adding parallel
settings screens. No silent removal, activation or bulk download.

**Why / benefit:** players choose a place and activity rather than understand a list
of engineering editions. **If skipped:** catalogue growth makes discovery harder,
while multiple versions can appear to be duplicate maps.

**Done when:** keyboard, touch, D-pad, controller and radio menu paths reach Play,
Pause, Reset, View, flight mode and setup with visible focus and safe returns.
Version selection preserves exact IDs and recordings. Verify controller behavior
on an explicit browser/OS/device matrix; desktop USB success does not establish
iOS browser, PWA or Steam Deck support. Profiles can express detected capabilities
without promising unavailable buttons or hardware bridges.

### P1 — Qualify learning clarity, HUD and practice flow

**Work:** audit all 58 School demonstrations against authoritative objective checks
and the visible teaching state. Preserve continuous example stick positions across
step boundaries, retained Acro attitude, immediate takeover and indefinite manual
practice. Check automatic step recognition, named steps, targeted retry and recorded
Watch → Try → Repeat journeys. Prefer a brief cue plus honest requirement/progress
indicators; keep detail and explanations safely paused.

Prioritize missing demonstrations by teaching need: an unfamiliar manoeuvre or
tracking objective needs an example more than an already clear optional activity.
Use existing proof/revision compatibility and supported recordings. Do not claim
an observed outcome from an illustrative stick animation.

**Why / benefit:** a player can understand the next correction and practice a skill
without repeated menu work. **If skipped:** more lessons increase confusion and
teach incorrect expectations when the diagram and accepted rules diverge.

**Done when:** all School native comparisons pass, including tilt with centred
sticks, wrong-side gates, impacts/elevated pads, inverted flight, occlusion,
ordered catches and phase changes. Guided/Minimal/Detailed, large text, themes,
EN/UK and the established portrait/landscape/handheld layouts stay clear of world
openings, sticks and menus. Keep flight mode selectable and touch comfort available;
optional assists never lock advanced content. Novice/physical feedback remains an
honest pending gate and does not block independent implementation.

### P2 — Finish a representative visual standard, then apply it in order

**Work:** finish **Reservoir** as the representative quality standard. Compare
pilot-height FPV, chase and overview under matched conditions: grounded scale,
coherent materials, relief, readable landmarks, reachable gaps, consistent lighting
and restrained ambience. Alpine station work can supply reusable material and
structural lessons in parallel, but its bounded R6 acceptance is not final art.

Once the standard and performance tradeoffs are accepted, deliver **Festival →
Harbor → Canals**, one coherent environment at a time. Compare every graphics tier
for equivalent visibility and collision; decoration must not close a useful route.
Use original or individually licensed assets and preserve archive/source receipts.

**Why / benefit:** a credible quality slice gives every later map a practical bar,
with reusable art rules. **If skipped:** many large regions remain visually flat,
and independent props/materials produce inconsistent results.

**Done when:** the representative slice passes actual flight and matched visual
review, sustained resource checks and all applicable package/public gates. Each
following environment independently meets the same standard. Do not label a larger
terrain rectangle, an attractive screenshot or a native source preview as final
whole-world player acceptance.

### P2 — Make existing worlds rewarding to revisit

**Work:** author named freestyle lines and optional short practice loops within the
existing regions. Reuse compatible personal-best ghosts, section replay, saved
places and random selection where already implemented. Add bounded moving-subject
follow/observe/filming routes and curated challenges that lead through useful gaps.
Audit existing Hunt contact/fire/destruction rules, hit feedback, actor animation,
audio and shared gore/effects preferences; label the required interaction clearly.

Keep free flight uninterrupted. Activities are optional and must not crowd the
FPV view. Start with a small representative set and increase variety through
composition, route choices and difficulty rather than spawning unlimited actors.
A local curated rotation can provide variety without a new online leaderboard or
multiplayer service.

**Why / benefit:** pilots have reasons to return and improve after seeing a map.
**If skipped:** greater area can still feel repetitive, and static or nonreactive
subjects undermine interaction.

**Done when:** each activity has clear start/goal/failure/feedback and a verified
completion path; replay, pause and reset remain consistent. Moving actors respect
collision, reachable space and a measured resource budget. Publish accurate
activity labels in the Library rather than promising every activity on every map.

### P3 — Expand authored districts and later worlds

**Work:** complete navigable districts, landmarks, safe spawns and
beginner/intermediate/advanced routes across existing families before admitting
further large regions. Preserve the intended dense 4×4 km, natural 8×8 km and
Desert 16×16 km design targets; some terrain extents are implemented, while authored
density and complete qualification remain uneven. Re-evaluate each dimension
against actual flight variety and resource limits.

Aim for six distinct districts and twelve meaningful landmarks per full region,
with optional activities and connected free flight. Then take **Castle Valley**
and **Retro Metropolis** one at a time. The existing Castle Courtyard pack does not
constitute the planned Castle Valley region. Generation may assist authoring;
unlimited runtime terrain remains deferred.

**Why / benefit:** large worlds support extended practice when their spaces have
recognizable purposes. **If skipped:** later regions remain absent; if rushed,
quantity and download cost outrun quality and reliability.

**Done when:** each region independently meets source/license, reachable
visual/collision, all-tier, package, Library, native and public gates. Retain earlier
editions. Competitor maps and Workshop downloads are references, not automatically
licensed imports.

### P1/P4 and D6 — Close integrated release evidence continuously

**Work:** keep applicable functional checks in every increment; add the remaining
D6 regression matrix around observed failure paths. Cover old proof identities,
recording/export/import, revision retention, interrupted downloads, quota/eviction,
context loss, mode/input changes, safe recovery, all hosts, shared settings and
music, themes/locales and actual offline/browser-process restart. Distinguish a
stopped development server, a closed tab and a restarted browser process.

**Why / benefit:** features must coexist and retain player progress through updates.
**If skipped:** isolated green checks can conceal integrated regressions.

**Done when:** exact combined packages and original archives qualify, public
identity and actual SIM launches match, and each acceptance row has evidence or an
explicit open limit. Physical radios, gamepads, iPhone/PWA and handheld acceptance
remain separate from simulated input and CSS viewport checks. Never mark the whole
plan complete because source and package checks pass.

## Fresh references and decisions

The observations below describe documented features. The adoption column is our
inference and planned adaptation, not evidence of equivalent implementation or
permission to reuse executable code, artwork, music or proprietary map layouts.

| Official reference                                                                                                  | Relevant observation                                                                                                                                             | Decision for this SIM                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [WebFPV](https://webfpv.org/)                                                                                       | Browser flying, authored tracks, freestyle obstacles, named gaps and moving drift cars.                                                                          | Organize maps by activity and named routes; reuse bounded chase/filming challenges. Its Betaflight claim is not our physics or latency benchmark.                                                                                                |
| [Flight Division](https://flightdivision.com/about)                                                                 | An ordered curriculum moves from takeoff and turns to stopping, calm control and flow.                                                                           | Improve existing demonstration → takeover → targeted retry before adding lesson count. The current `/sim` entry requires sign-in; public marketing and actual entry should be distinguished.                                                     |
| [VelociDrone desktop manual](https://www.velocidrone.com/desktop_manual)                                            | Next-gate/edge navigation, configurable sticks/OSD, own-best references, slow playback and saved reset position.                                                 | Qualify current world cues, section replay, ghosts and saved places; make the next action visible without a large numerical coach.                                                                                                               |
| [VelociDrone mobile manual](https://www.velocidrone.com/mobile_manual)                                              | A separate mobile presentation/scenery path makes performance tradeoffs explicit.                                                                                | Preserve route/collision meaning across tiers and publish actual input/device capabilities rather than assuming desktop parity.                                                                                                                  |
| [Uncrashed Workshop](https://steamcommunity.com/app/1682970/workshop/)                                              | Discoverable community environments/races; publisher update 2.7, dated 2 July 2026, advertises configurable OSD and race browsing.                               | Improve activity discovery and bounded HUD presets/reset. Defer arbitrary drag-anywhere HUD editing and cloud synchronization. Workshop listing is not an asset license.                                                                         |
| [TRYP official store page](https://store.steampowered.com/app/1881200/TRYP_FPV__The_Drone_Racer_Simulator/)         | Scenic landscapes and varied race/freestyle/scenario flying, including moving subjects.                                                                          | Build coherent districts and optional follow/filming routes; measure usable flight variety rather than square kilometres alone.                                                                                                                  |
| [The Zone official store page](https://store.steampowered.com/app/3491280/The_Zone__FPV_Drone_Simulator/?l=english) | Emphasizes real-scale environments and flying through navigable architecture.                                                                                    | Review clearances and grounded scale. Treat its planned features and inconsistent map counts cautiously; do not represent moving obstacles as verified shipped behavior.                                                                         |
| [FPV Logic official store page](https://store.steampowered.com/app/2398030/FPV_LOGIC?l=english)                     | Freestyle spaces, camera views and simplified tuning; the listing identifies Steam Deck as unsupported.                                                          | Learn from flow and camera choices, while requiring our own actual handheld acceptance. A desktop reference is not a compatibility guarantee.                                                                                                    |
| [Festival FPV public player](https://fpvfestivalsimulator.com/play/)                                                | Previously inspected public player source exposes quality/effects controls, a latency-oriented option, optional stick display and direct arm/reset/view actions. | Add a measured latency-priority render preset, quiet overlays and simple actions. An estimated stick-to-pixels display is not measured input-to-photon latency. The page exceeded this refresh tool's fetch size; no new native test is claimed. |
| [KillZone FPV developer listing](https://apps.apple.com/tw/app/killzone-fpv/id6792595058)                           | Mobile controller-first flying, saved calibration and a demonstration mode; radio connectivity uses specific supported paths.                                    | Qualify retained profiles and arm/reset/view/menu actions by platform. Wi-Fi or hardware radio bridges are separate capabilities, not universal browser support.                                                                                 |
| [FPVSIM manual](https://app.fpvsim.com/how-tos/fpvsim-reroute-manual)                                               | Joystick-mode setup and controller-specific calibration flows.                                                                                                   | Audit automatic device/profile recall and safe action mapping; keep a generic wizard and explicit verification instead of unsafe guessed assignments.                                                                                            |
| [Liftoff mentor announcement](https://www.liftoff-game.com/news/virtual-mentor-reveal)                              | Console tutorial/assisted flight and mentoring, announced 2 September 2020.                                                                                      | Keep optional guidance and a practical first-flight path. This historical console reference is not a newly shipped 2026 PC feature.                                                                                                              |
| [Minecraft FPV source](https://github.com/minecraft-fpv/mfpv-client)                                                | A GPL-3.0 mod repository demonstrates a separate voxel-world approach.                                                                                           | World-building inspiration only. A voxel engine, competitor code and Minecraft assets are outside the current authored-region delivery.                                                                                                          |

“Zaruba FPV” was not verified as a distinct simulator in this review; search results
for unrelated radio/drone hardware are not simulator evidence. This review does
not claim to enumerate every released FPV game.

[Browser storage documentation](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
distinguishes browser-managed origin quota and persistence from an application's
own logical limit. Plan storage estimates and explicit recovery around that
boundary; it does not establish why the observed Library rows disappeared.
[Rendering guidance](https://web.dev/articles/rendering-performance) and
[Long Animation Frames documentation](https://developer.chrome.com/docs/web-platform/long-animation-frames)
support targeted frame attribution and avoiding repeated layout work. Use the
existing bounded observers to locate a cause, not to infer one from counters.
[Xbox objective/feedback guidance](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/109)
supports accessible current-goal cues and reviewable instructions. Keep text/shapes
alongside color and retain paused explanations.

## Parallel delivery order and unchanged constraints

1. **Immediately:** finish current exact public-delivery reporting and diagnose
   storage ownership/visibility. Continue the independent metadata-listing PR and
   measured performance investigation while protected publication runs.
2. **Next engineering increments:** Library family/version navigation, integrated
   control/setup qualification and native School/HUD coverage. Functional fixes
   from actual failures take precedence over more catalogue rows.
3. **Parallel art/content:** finish Reservoir's representative standard; reuse
   bounded Alpine improvements. Then Festival, Harbor and Canals in sequence,
   with a small set of named routes/activities to demonstrate each environment.
4. **Later content:** expand authored regions after their quality and delivery
   dependencies pass. Two-hour qualification remains P1 and proceeds once actual
   attribution and headroom permit, independently of art. D6, physical/device and
   offline work can proceed throughout; the final integrated release declaration
   requires all applicable environment and reliability gates.

Use independent focused PRs unless one change actually depends on another. For a
necessary dependency, use the native stack workflow; keep required checks and
holds. A queued PR never blocks unrelated engineering or content. Every published
increment records completed and open gates and updates the per-offer report where
player availability changes. Source publication, immutable/package delivery,
Library admission and actual public launch are distinct milestones.

Budgets remain **core 72 MiB; regional retention 512 MiB; Worldpack retention
256 MiB; 256 retained revisions**, with all existing per-asset, runtime residency,
geometry and texture ceilings. The approved retention increase is not permission
to increase any other budget. Local heavy work requires a **stable 3 GiB free-space
floor**. Current internal observations are below that floor, so builds/extraction
stay external or cloud; avoid bulk native installations while headroom is unsafe.
Preserve all unfinished work, source/commits, failed packages and player storage.

Re-estimate remaining effort after the storage cause, a stable matched performance
benchmark and the representative art slice are understood. Earlier phase estimates
are historical, not a reliable current delivery date. Development continues without
waiting for novice feedback, while physical and first-time-player acceptance stays
explicitly unverified. New physics engines, unlimited procedural runtime worlds,
multiplayer, cloud sync and arbitrary HUD editors require separate scope review;
they do not displace the priorities above.
