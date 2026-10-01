# Demo attract-mode plan status — reviewed 1 October 2026

This document reconciles the original six numbered phases (Phase 0 through Phase 5) with the implementation and retained qualification evidence. **Complete** means the planned behavior exists and its automated checks pass. It does not substitute for the physical-device, audible-output or human-viewer acceptance called out below. The 1 October review also separates public-release blockers from recommended product validation and optional expansion so the remaining work can be reprioritized without reopening completed implementation.

## Executive status

The feature implementation is substantially complete. Real levels run through the ordinary simulation, reviewed recordings and qualified live autoplay share one director, installed Standard levels receive replay-verified improvised coverage, and Demo/practice remain isolated from progression. The remaining work is release qualification rather than another broad feature build.

| Phase                                      | Status                                       | Result                                                                                                                                                                                                          |
| ------------------------------------------ | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 — Working baseline                       | **Complete**                                 | Strict replay playback, source identity, current simulation compatibility and genuine installed-level recordings are covered.                                                                                   |
| 1 — Isolated playback and reviewed content | **Complete**                                 | Sixteen authored scenes cover all twelve base maps; invalid or unavailable sources are skipped without affecting the ordinary run.                                                                              |
| 2 — Live bot                               | **Complete for the planned two-map scope**   | Orchard Crossing and Courtyard Exits are qualified under both steering policies and fixed seeds. Wider bot support remains optional expansion.                                                                  |
| 3 — Screensaver, presentation and handoff  | **Implemented; physical acceptance pending** | Entry, continuous rotation, fullscreen layout, tips, audio controls, earned-picture policy, automatic practice takeover and fresh play are implemented and automated.                                           |
| 4 — Qualification and release              | **In progress; focused blockers remain**     | PR #856 merged and exact-head capacity passed. A two-hour browser run still contains an unresolved 158-second visible/unfocused stall. Physical iPhone/input, audible-output and viewer acceptance remain open. |
| 5 — Player-performance reuse and variety   | **Core complete; expansion ongoing**         | Opt-in collection, manual Keep, verification, filtering and bounded local storage exist. More attributable human recordings and additional bot mechanic families are optional follow-ups.                       |

## Completed scope by phase

### Phase 0 — Working baseline

- The replay controller imports and passes its playback/fork checks.
- Recordings pin level, rules, options, equipment and input identity and reproduce authoritative checkpoints.
- Runtime-specific frozen replay alternatives preserve strict playback instead of weakening checkpoint comparison.
- First Flight remains a separate interactive teaching experience.

### Phase 1 — Isolated playback and reviewed content

- Demo uses separate players, painters and cancellation ownership; watching cannot mutate the ordinary run, recorder, suspended save or selected mission.
- The base catalogue now contains **16 authored scenes across all 12 base maps**: ten reviewed wins and six paced mistake scenes. The mistake scenes last 12.5–24.6 seconds, include visible repositioning, and retain ordinary deaths, respawns and two genuine complete losses.
- Scene selection starts from an approachable recording, shuffles compatible sources and avoids immediate same-level repetition when alternatives exist.
- Missing, corrupt, stale or runtime-incompatible recordings are quarantined for the session and fall through to another source.
- The source, distribution and hosted ZIP contain the catalogue, 26 frozen replay assets, provenance data, the improvised adapter and Worker. Replay bodies are intentionally outside mandatory web/company offline caches to preserve their byte budgets; fresh offline installs can still use compatible improvised sources.

### Phase 2 — Live bot

- The qualified planner supports Orchard Crossing and Courtyard Exits with seeds 1–3 under Immediate and Grid-center steering.
- Candidate planning runs in a Worker with bounded candidates, simulated ticks, checkpoint ownership and the unchanged one-second watchdog.
- Only ordinary directional inputs reach the real core. Successful performances are recorded and replay-verified independently.
- Safe-plan exhaustion hands off to a reviewed replay. Stale, late or failed plans cannot replace a newer scene.
- The final single Worker follow-up passed 179 scenes and 7,251.975 simulated seconds with exact verification and zero leaked owners/listeners. An earlier real-Worker watchdog timeout remains preserved and unexplained; the later pass does not erase it.

### Phase 3 — Screensaver, presentation and handoff

- Manual **Watch demo** and 60-second foreground-home idle entry exist, with reduced-effects and automatic-entry preferences.
- Demo fills the viewport, rotates indefinitely, exposes Pause/Resume, Next level and Want to play, and preserves spectator intent across focus/visibility changes while the browser continues executing.
- Keyboard, controller and board-touch gameplay intent automatically enters isolated takeover practice. UI controls own their input and cannot accidentally steer or trigger takeover.
- **Play from beginning**, locked-level fresh practice, exact-tick takeover and return-to-demo preserve ordinary save/replacement rules and never award progress.
- Event-driven tips, English/Ukrainian copy, level/source labels, recaps and the demonstrated level's character theme are implemented.
- Demo audio uses the ordinary Soundscape event/feedback path and the shared soundtrack player. Music transport, style, volume, mute, credits and Music-only versus Music-plus-game-sounds are independently controlled.
- Verified earned pictures display clearly. Unearned pictures use the analog receiver treatment. The opt-in privacy setting hides every Demo/practice picture without changing Collection or ordinary gameplay.
- Gameplay jammers reuse the receiver effect only on the revealed picture layer; terrain, trails, hazards and actors stay sharp.

### Phase 4 — Qualification and release remains open

- Static distribution, hosted ZIP and company-edition candidates include the current Demo modules and required dynamic assets. Missing sources fail over or return cleanly to Home.
- PR #856 merged into `main`. Its focused, candidate, preflight, optional-practice, release-ready and exact-head capacity checks passed. Capacity is no longer a Demo blocker.
- A real Chromium observation completed 7,204.141 monotonic seconds with unchanged served-source and sampled game-storage hashes. It measured hidden intervals, recorded/live rotation and independent early Demo/music pause behavior.
- That observation also captured a 158.0978-second visible/unfocused stale board and timer. Observer checkpoint persistence later failed during local `ENOSPC`, and post-close browser Worker/listener counters were unavailable. The duration therefore does not qualify the feature.
- Physical iPhone/browser/native inputs, actual audible output, target-device thermal/battery behavior and three unfamiliar viewers remain untested acceptance gates.
- The earlier capacity timeout was corrected by allowing the inspector enough job time. The successful exact-head result closes that infrastructure issue; it should not remain in the active work list.

### Phase 5 — Variety and player reuse already delivered

- **Keep for demo** stores an eligible completed ordinary run explicitly.
- **Use my successful runs in demos** separately enables future automatic collection and defaults off.
- Admission requires a completed, non-practice win, exact installed-content identity, strict replay verification and movement-quality checks.
- The disposable IndexedDB cache is separate from saves and capped at **12 recordings / 32 MiB**, with byte-accurate eviction, corruption/error recovery and clear controls.
- Every other compatible installed Standard level receives a seeded improvised source. Each preparation changes its seed, can win, recover or fail naturally, and must replay-verify before adoption.
- Journey and company sources retain exact installed owner, mission, roster, theme and picture identity; one community cannot borrow another community's content.

## Acceptance status

| Acceptance area                        | Status                                              | Evidence and limitation                                                                                                                                                                                |
| -------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Replay and takeover correctness        | **Automated pass**                                  | Exact checkpoints, live cuts, equipment, recovery and encounter phases are covered.                                                                                                                    |
| Save/progression isolation             | **Automated pass**                                  | Demo and practice do not write scores, rewards, unlocks, suspended runs or recording cache unless an eligible ordinary run is explicitly/automatically retained.                                       |
| Picture secrecy and earned clarity     | **Automated pass**                                  | Unearned frames fail closed; exact earned originals remain clear unless the privacy option is enabled. Physical visual review is still required.                                                       |
| Source breadth and community isolation | **Automated pass**                                  | All installed compatible Standard levels receive a source; public company bootstraps expose only their own levels.                                                                                     |
| Audio routing and intent               | **Automated pass; audible review pending**          | Shared transport/event routing and pause ownership pass modeled checks. Speakers, mobile autoplay recovery and track boundaries require real output devices.                                           |
| Background playback                    | **Blocked on anomaly**                              | A 7,204-second browser observation completed, including measured hidden intervals, but captured a 158.0978-second visible/unfocused stall.                                                             |
| Loading and fault recovery             | **Automated pass with retained historical failure** | Deadlines, cancellation and replay fallback pass. One earlier real-Worker timeout remains unexplained.                                                                                                 |
| Physical input and native lifecycle    | **Pending**                                         | Keyboard fixtures and modeled touch/controller paths pass; real remapping, Hold/Toggle, reconnect and wrapper lifecycle are unqualified.                                                               |
| Viewing quality and comprehension      | **Pending**                                         | Authored pacing improved, but the required three unfamiliar viewers have not been observed.                                                                                                            |
| Release/build admission                | **Merged; final-candidate rerun remains**           | PR #856 and its exact-head capacity check passed. Because `main` has continued to change, the eventual release candidate still needs one exact-source regression and packaging run before publication. |

## Rebalanced execution plan

### Priority 0 — required before a broad public release

These items protect promises already made by the feature. Skipping one means knowingly releasing behavior that can stop, fail on a previously affected device, or differ from the ordinary game.

#### 1. Fix the visible/unfocused playback stall

- **What it is:** During the completed two-hour Chromium run, observer sampling continued but the unpaused Demo board, timer and canvas remained unchanged for 158.0978 seconds while the page was visible but unfocused. Playback resumed after another visibility change. The evidence does not yet show whether the simulation clock, renderer or browser scheduling owner stopped.
- **Why it is needed:** Continuous spectator playback while unfocused is an explicit product requirement. This is the only retained observation showing the core promise fail for more than two minutes.
- **What it brings:** Reliable kiosk/screensaver behavior, confidence that a returning viewer sees a current frame, and a precise regression test around the responsible clock transition.
- **Impact of skipping:** A public demo may appear frozen even though its controls say it is playing. That makes the headline feature unreliable and can look like a crash. **Recommendation: do not waive for broad release.**
- **Completion boundary:** Reproduce with timestamps for animation frames, fallback timer, simulation ticks, focus/visibility and canvas checksums; fix the established owner; add a focused regression that exercises the same transition.

#### 2. Verify the fix with one clean source-pinned endurance run

- **What it is:** Repeat the continuous run only after item 1 is resolved, with adequate disk space and one frozen production build. The earlier run proves duration and rotation, but its stall and observer-storage failure prevent it from being the final acceptance record.
- **Why it is needed:** Short tests are good at state transitions but poor at finding timer throttling, accumulated listeners, delayed Workers, resource growth and scene-rotation failures.
- **What it brings:** Evidence that recorded and live scenes rotate for two wall-clock hours, Demo and music pauses remain independent, hidden/visible transitions recover, and source/storage hashes remain stable.
- **Impact of skipping:** The fix would be supported only by a short regression, while the feature is specifically designed to run unattended for long periods. **Recommendation: keep the two-hour run for public release; a 30-minute run is acceptable only for an internal beta.**
- **Completion boundary:** No stale interval, no unexplained diagnostic, repeated recorded/live rotation, explicit pause checks, song boundaries, final hash comparison and post-close Worker/listener cleanup evidence.

#### 3. Qualify iPhone and real input ownership

- **What it is:** Exercise real iPhone Safari/WKWebView first, then representative desktop/native environments with touch, keyboard and physical controllers. Include automatic takeover, held controls, remapping, Hold/Toggle, disconnect/reconnect, screen lock and return to the preserved flight.
- **Why it is needed:** The original “No compatible demo” defect was reported on iPhone, and automated DOM fixtures cannot reproduce mobile media policy, touch synthesis, controller firmware or native lifecycle timing.
- **What it brings:** Confidence that people can watch and take over on the devices that previously failed, without a held button reopening menus or steering accidentally.
- **Impact of skipping:** Desktop success could hide an iPhone regression or a takeover/input bug. **Recommendation: iPhone plus touch is release-blocking; additional controller models can be sampled rather than exhaustive.**
- **Completion boundary:** At least one current iPhone browser and wrapper path, one desktop browser, one physical controller and touch complete entry, watching, takeover, pause, background/foreground and exit journeys without source errors or progress mutation.

#### 4. Verify real audio and mobile autoplay recovery

- **What it is:** Listen through actual speakers/headphones while testing Music only, Music + game sounds, mute, volume, style, Pause, Next, track credit links and blocked-autoplay recovery. Confirm Demo effects match ordinary gameplay for the same events.
- **Why it is needed:** Code-path tests prove event routing and intent; they cannot prove that the browser actually emits sound, respects mobile autoplay rules, avoids bursts after catch-up or schedules pleasant track boundaries.
- **What it brings:** A trustworthy audiovisual attract mode rather than a visually correct demo with silent, duplicated or stale sound.
- **Impact of skipping:** The Demo can still function silently, so this may be waived for an explicitly silent internal beta. It should block a public release advertised as a music-enabled demo. **Recommendation: combine it with the iPhone/device session instead of running a separate campaign.**
- **Completion boundary:** Audible parity for representative capture, death, hazard and ability events; no catch-up burst; persistent mute/volume/style; music continues or pauses only according to explicit controls.

#### 5. Freeze and recheck the actual release candidate

- **What it is:** Once items 1–4 pass, choose one commit and run the focused Demo, candidate, capacity, offline and native staging checks on that exact source. PR #856 passed its own checks and merged, but later changes on `main` are outside that evidence boundary.
- **Why it is needed:** A collection of passing historical PRs does not prove the final combined build. Packaging, menus, audio and optional content continue to change around Demo.
- **What it brings:** One auditable source hash connecting tests, packages and the release decision.
- **Impact of skipping:** Regressions introduced after PR #856 could ship under old evidence. **Recommendation: mandatory, but perform it last so it is not invalidated by more code changes.**
- **Completion boundary:** All required checks complete without timeout on one commit; release owner reviews the remaining limitations before promotion.

### Priority 1 — product validation before calling the Demo effective

#### 6. Watch three unfamiliar people use it

- **What it is:** Let three people who have not been coached watch a short rotation and then try a level. Observe whether they understand leaving safe ground, closing a cut, exposed-line danger, normal play versus practice, and where the controls are.
- **Why it is needed:** Automated tests can prove correctness but cannot prove that the Demo attracts attention or teaches the mechanic—the original reason for building it.
- **What it brings:** Direct evidence about scene pacing, tip clarity, analog-effect comfort, failure frequency and which demonstrations create interest.
- **Impact of skipping:** The feature may run perfectly while failing its product goal or teaching the wrong lesson. **Recommendation: block a marketing/public-success claim, but do not block an engineering beta.**
- **Completion boundary:** Three completed observation worksheets, with confusion and interest notes converted into bounded copy/weighting changes or explicitly accepted findings.

#### 7. Complete the presentation and accessibility sweep

- **What it is:** Review desktop, portrait phone and short landscape with large text, English, Ukrainian, reduced motion/effects, earned and hidden pictures, and both menu layouts.
- **Why it is needed:** Demo is unusually dense: game canvas, captions, audio controls and play choices share limited space. Automated layout rules do not assess clipping, visual dominance or readability over motion.
- **What it brings:** A polished experience for phones, Steam Deck-style screens and accessibility settings without weakening the full-screen presentation.
- **Impact of skipping:** Controls or captions may be technically present but difficult to find or read. **Recommendation: combine with items 3 and 6; fix only observed issues rather than opening a general redesign.**
- **Completion boundary:** No clipped or unreachable control, no clear unearned-image frame, readable captions, and acceptable reduced-effects behavior across the stated matrix.

### Priority 2 — optional variety after acceptance

#### 8. Add more attributable human recordings

- **Why:** Real successful runs add personality and strategies that generated playback cannot imitate.
- **Benefit:** More believable variety and less repetition over long displays.
- **If skipped:** The existing 16 authored scenes, two qualified bot maps and per-level verified improvisation still provide complete coverage. **Recommendation: optional; use only explicit local opt-in or Keep for demo.**

#### 9. Extend qualified bot support to more mechanics

- **Why:** A planner that understands another ruleset can react live rather than relying on a prepared or improvised performance.
- **Benefit:** More dynamic viewing on hazard/equipment-heavy maps.
- **If skipped:** Those levels still play through their compatible recording/improvised source. Expanding the bot increases safety and qualification cost. **Recommendation: add one mechanic family at a time after release data shows repetition is a real problem.**

#### 10. Tune scene weights, tips and failure frequency from observation data

- **Why:** The current mixture is intentionally varied, but the ideal win/loss ratio and caption timing are product judgments.
- **Benefit:** Better pacing, fewer repeated-feeling routes and clearer teaching moments.
- **If skipped:** Current behavior remains correct and varied; it may be less engaging than possible. **Recommendation: wait for viewer or telemetry evidence instead of guessing.**

#### 11. Admit custom levels selectively

- **Why:** Installed community content could make each installation's Demo feel personal.
- **Benefit:** Larger catalog and better creator visibility.
- **If skipped:** Official and company levels remain covered and isolated. **Recommendation: require a reviewed recording or the same qualified source gates; never auto-admit arbitrary content.**

## Recommended order and possible trade-offs

1. Fix the stall.
2. Run one combined iPhone/touch/audio/presentation session while the fix is under review.
3. Run the clean two-hour endurance check.
4. Conduct the three-viewer study and make only evidence-backed pacing/copy adjustments.
5. Freeze one release candidate and rerun exact-source admission.

For an **internal beta**, items 1, a shorter endurance run, iPhone/touch smoke coverage and exact-candidate checks are sufficient if the build is clearly labeled unfinished and sound/viewer effectiveness is not claimed. For a **broad public release**, keep all Priority 0 items and the three-viewer/presentation review. Priority 2 should not delay either route.

## Release definition of done

The feature is release-qualified for broad public use only when Priority 0 evidence belongs to one frozen candidate, the visible-return anomaly is resolved, the physical iPhone/input and audible-output journeys are complete, and the Priority 1 viewer/presentation findings are either addressed or explicitly accepted by the release owner. Priority 2 remains optional and must not hold the first accepted release. Capacity is already closed and should not be reopened unless package contents or limits change.
