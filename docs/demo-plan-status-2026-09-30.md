# Demo attract-mode plan status — 30 September 2026

This document reconciles the original six numbered phases (Phase 0 through Phase 5) with the implementation and retained qualification evidence. **Complete** means the planned behavior exists and its automated checks pass. It does not substitute for the physical-device, audible-output or human-viewer acceptance called out below.

## Executive status

The feature implementation is substantially complete. Real levels run through the ordinary simulation, reviewed recordings and qualified live autoplay share one director, installed Standard levels receive replay-verified improvised coverage, and Demo/practice remain isolated from progression. The remaining work is release qualification rather than another broad feature build.

| Phase                                      | Status                                       | Result                                                                                                                                                                                                  |
| ------------------------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 — Working baseline                       | **Complete**                                 | Strict replay playback, source identity, current simulation compatibility and genuine installed-level recordings are covered.                                                                           |
| 1 — Isolated playback and reviewed content | **Complete**                                 | Sixteen authored scenes cover all twelve base maps; invalid or unavailable sources are skipped without affecting the ordinary run.                                                                      |
| 2 — Live bot                               | **Complete for the planned two-map scope**   | Orchard Crossing and Courtyard Exits are qualified under both steering policies and fixed seeds. Wider bot support remains optional expansion.                                                          |
| 3 — Screensaver, presentation and handoff  | **Implemented; physical acceptance pending** | Entry, continuous rotation, fullscreen layout, tips, audio controls, earned-picture policy, automatic practice takeover and fresh play are implemented and automated.                                   |
| 4 — Qualification and release              | **In progress; release blocking**            | Packaging and automated suites pass. A two-hour browser run completed with an unresolved visible-return stall and checkpoint-storage failure. Device, audible-output and viewer acceptance remain open. |
| 5 — Player-performance reuse and variety   | **Core complete; expansion ongoing**         | Opt-in collection, manual Keep, verification, filtering and bounded local storage exist. More attributable human recordings and additional bot mechanic families are optional follow-ups.               |

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
- Focused, candidate, preflight, optional-practice and release-ready jobs passed on PR #856's previous exact head. The rebased head still requires its own complete CI result.
- A real Chromium observation completed 7,204.141 monotonic seconds with unchanged served-source and sampled game-storage hashes. It measured hidden intervals, recorded/live rotation and independent early Demo/music pause behavior.
- That observation also captured a 158.0978-second visible/unfocused stale board and timer. Observer checkpoint persistence later failed during local `ENOSPC`, and post-close browser Worker/listener counters were unavailable. The duration therefore does not qualify the feature.
- Physical iPhone/browser/native inputs, actual audible output, target-device thermal/battery behavior and three unfamiliar viewers remain untested acceptance gates.
- The hosted capacity job repeatedly exhausted its fixed ten-minute whole-job limit. The identical inspector passed locally in 7m11s, so the timeout is a CI reliability blocker rather than a demonstrated byte-cap failure.

### Phase 5 — Variety and player reuse already delivered

- **Keep for demo** stores an eligible completed ordinary run explicitly.
- **Use my successful runs in demos** separately enables future automatic collection and defaults off.
- Admission requires a completed, non-practice win, exact installed-content identity, strict replay verification and movement-quality checks.
- The disposable IndexedDB cache is separate from saves and capped at **12 recordings / 32 MiB**, with byte-accurate eviction, corruption/error recovery and clear controls.
- Every other compatible installed Standard level receives a seeded improvised source. Each preparation changes its seed, can win, recover or fail naturally, and must replay-verify before adoption.
- Journey and company sources retain exact installed owner, mission, roster, theme and picture identity; one community cannot borrow another community's content.

## Acceptance status

| Acceptance area                        | Status                                              | Evidence and limitation                                                                                                                                                                                                                                                                             |
| -------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Replay and takeover correctness        | **Automated pass**                                  | Exact checkpoints, live cuts, equipment, recovery and encounter phases are covered.                                                                                                                                                                                                                 |
| Save/progression isolation             | **Automated pass**                                  | Demo and practice do not write scores, rewards, unlocks, suspended runs or recording cache unless an eligible ordinary run is explicitly/automatically retained.                                                                                                                                    |
| Picture secrecy and earned clarity     | **Automated pass**                                  | Unearned frames fail closed; exact earned originals remain clear unless the privacy option is enabled. Physical visual review is still required.                                                                                                                                                    |
| Source breadth and community isolation | **Automated pass**                                  | All installed compatible Standard levels receive a source; public company bootstraps expose only their own levels.                                                                                                                                                                                  |
| Audio routing and intent               | **Automated pass; audible review pending**          | Shared transport/event routing and pause ownership pass modeled checks. Speakers, mobile autoplay recovery and track boundaries require real output devices.                                                                                                                                        |
| Background playback                    | **Blocked on anomaly**                              | A 7,204-second browser observation completed, including measured hidden intervals, but captured a 158.0978-second visible/unfocused stall.                                                                                                                                                          |
| Loading and fault recovery             | **Automated pass with retained historical failure** | Deadlines, cancellation and replay fallback pass. One earlier real-Worker timeout remains unexplained.                                                                                                                                                                                              |
| Physical input and native lifecycle    | **Pending**                                         | Keyboard fixtures and modeled touch/controller paths pass; real remapping, Hold/Toggle, reconnect and wrapper lifecycle are unqualified.                                                                                                                                                            |
| Viewing quality and comprehension      | **Pending**                                         | Authored pacing improved, but the required three unfamiliar viewers have not been observed.                                                                                                                                                                                                         |
| Release/build admission                | **Pending**                                         | Candidate, focused, preflight, optional-practice and release-ready checks passed on PR #856's prior exact head. The capacity job repeatedly hit its fixed ten-minute whole-job timeout while the same inspector passed locally in 7m11s. The branch must be rechecked after its latest-main rebase. |

## Updated execution plan

### Priority 0 — Release blockers

1. **Diagnose the visible-return stall.** Reproduce it with clock-source, requestAnimationFrame, timer-fallback, visibility/focus and canvas-checksum timestamps. Confirm whether simulation stopped, painting stopped, or both. Fix only the established owner and add a regression around the observed transition.
2. **Run a clean exact-build observation after the fix.** Use adequate disk headroom and a source-pinned production build. Require two wall-clock hours, visible and hidden intervals, repeated recorded/live rotation, independent Demo/music pauses, song boundaries, no stale frame on return, final source/storage comparisons and explicit cleanup/resource evidence.
3. **Make the capacity gate reliable.** Keep its byte limits and assertions unchanged. Either reduce setup/inspection wall time or give the whole GitHub job enough time for the locally measured inspector, then obtain an exact-head result. A timeout is neither a capacity pass nor evidence that the product exceeded the cap.
4. **Qualify real devices and inputs.** Cover iPhone Safari/WKWebView first because the earlier compatibility error was device-specific, then supported desktop browsers/native wrappers, keyboard, touch and real controllers. Exercise remapping, Hold/Toggle, reconnect, foreground/background, screen lock where applicable, automatic takeover and safe return to the preserved flight.
5. **Qualify audible output.** Verify music-only and music-plus-game-sounds, mute/volume/style persistence, Pause/Next independence, actual game-effect parity, blocked-autoplay recovery, track credits and scene-boundary scheduling through real speakers/headphones.
6. **Observe three unfamiliar viewers.** Use the retained worksheet. Each viewer should identify how a cut closes, recognize exposed-line danger, find ordinary play and practice without coaching, and report comfort/readability on the analog treatment. Record confusion and scene-interest data before adjusting tips or weighting.

### Priority 1 — Final release review

1. Repeat desktop, portrait-phone and short-landscape presentation checks with large text, English, Ukrainian, reduced motion/effects and both menu layouts.
2. Freeze one candidate only after Priority 0 passes; rerun focused, candidate, capacity, offline and native staging checks against that exact source.
3. Have the release coordinator review the complete evidence, preserved anomalies and target-specific results before removing the release hold or promoting the milestone candidate.

### Priority 2 — Optional post-acceptance expansion

1. Add attributable successful human recordings only through explicit local opt-in or **Keep for demo**; keep authored and generated sources labeled truthfully.
2. Extend the planned bot one ruleset/mechanic family at a time. Each addition needs multi-seed, both-policy safety, exact replay verification, pacing review and fallback coverage.
3. Use viewer observations to tune scene weights, recap timing and failure frequency. Do not infer engagement from deterministic tests.
4. Add installed custom levels to rotation only when they have a compatible reviewed recording or pass the same qualified source gates.

## Release definition of done

The feature is release-qualified only when Priority 0 and Priority 1 evidence belongs to one frozen candidate, all release-blocking checks complete without timeout, the visible-return anomaly is resolved or explicitly rejected by the release owner with evidence, and the physical-device and three-viewer worksheets are complete. Priority 2 remains optional and must not hold the first accepted release.
