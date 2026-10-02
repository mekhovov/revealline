# FPV implementation continuation — approved 1 October 2026

This plan supersedes the original remaining-work estimate in
`fpv-worlds-implementation.md`. Keep the completed native UI, radio calibration,
fullscreen and existing simulation/content contracts. Direction: grounded
realism, primary Acro learning, optional self-level assistance and consistent
main-game presentation. All activities remain immediately selectable.

## Remaining phases and delivery order

| Phase | Scope                                                                             | Working estimate         | Target    |
| ----- | --------------------------------------------------------------------------------- | ------------------------ | --------- |
| R0    | Reconcile stacks, correct transactional reimport, verify public entry             | 2–3 days                 | Week 1    |
| R1    | Truthful shared drone guide in both SIM hosts                                     | 3–5 days                 | Week 1–2  |
| R2    | 14 primary Acro lessons, 12 optional self-level lessons, installed demonstrations | 8–12 days                | Week 3–4  |
| R3    | Shared menu navigation, HUD scale, sound groups and clear result actions          | 3–5 days parallel        | Week 3–4  |
| R4    | Material/lighting tiers, three detailed quads, safe shader preparation            | 8–12 days parallel       | Week 3–5  |
| R5    | Art and animation across all eight worlds                                         | 10–15 days               | Week 5–8  |
| R6    | Original 120 demonstrations, compatible ghosts, targeted practice                 | 4–6 days partly parallel | Week 6–8  |
| R7    | Deferred unit coverage, full regression and human/device qualification            | 5–10 days                | Week 8–10 |

These estimates assume two developers, an environment artist and recurring
player sessions, with two additional contingency weeks. Re-estimate after the
first realistic environment benchmark and novice sessions. An authored challenge
or machine-verified proof is not human/content-art acceptance.

## Contracts and acceptance

- Preserve original lesson IDs, course identities, recordings, rewards and
  playlist revisions. Twelve new Acro lessons plus the two existing introductions
  produce 26 learning challenges and 86 total. Temporary Acro/FPV/Gentle settings
  restore the player's previous flight preferences on exit.
- Teaching follows observe, practise, feedback, independent flight. Use actual
  command recordings, slow playback, clearly labelled example controls, optional
  explanations and real objective progress. Observe at least five first-time
  players across radio/keyboard before novice acceptance.
- The shared drone guide reads state only: applied command, full quaternion,
  thrust direction, heading and measured travel. Keep Off/Compact/Learning,
  persistent preferences, safe pause/reconnect and Mode 1–4 stick layouts.
- Performance/Balanced/Quality caps remain DPR 1/1.5/2, no/1024/2048 dynamic
  shadows. Presets retain identical gameplay fog, sight lines, collision, target
  readability and replay results. Pixel materials keep nearest filtering.
- Reuse Kenney scenery and main-game UI assets. Record author/license/changes/
  hashes for any new material or environment resources. Poly Haven/ambientCG are
  candidates until selected, optimized and actually shipped. No new decoder is
  implied by this work.
- Polish hangar/meadow, courtyard/woodland, warehouse/stadium, then yard/garage.
  Keep imported-world disposal, animation tied to simulation time, shader
  preparation before arming and cosmetic preference preservation.
- R6 retains exact challenge/mode compatibility for PR #913 ghosts. Original
  demonstrations remain 120; school proofs are separate. Results should offer
  retry, section practice, demonstration and playlist continuation without locks.
- Functional checks accompany every increment. New unit coverage stays in R7.
  Preserve 8 MiB/64-file Academy and 16 MiB/96-file World Studio package policies,
  archive limits and all publication guards. Name actual devices before reporting
  sustained 60/30 fps or memory measurements.

## Continuous publication

Publish each completed, functionally verified feature as a focused PR. Native
stack #902 contains the school/guide dependency chain; #889 holds remaining
original demonstration content. Inspect live membership and exact heads before
acting. Independent repairs can target main. Do not mix graphics WIP into ready
teaching PRs, retarget native members manually, remove holds without their
required evidence, or change global release authority. Verify both the public
deployment identity and a successful simulator launch before calling work live.

The execution checkpoint and current next item live in
`fpv-continuous-delivery.md`; read its latest entry rather than historical tables.

## Player feedback revision — controls lab and rear reference

The 1 October screenshots expose mirrored front-view roll, side-view pitch that
resembles roll, a separate illustration that does not follow live input, and
legacy green surfaces. Prioritize these R1/R3 corrections before further art.

| Increment         | Implementation                                                                                                                                             | Estimate                      | Verification gate                                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Controls teaching | One quaternion-based rear-reference diagram in lessons and both flight hosts; distinguish front/rear, pitch depth, bank, yaw and measured travel.          | 1–2 working days              | Positive/negative pitch and roll, yaw, inverted Acro, unchanged replay.                                         |
| Live controls lab | Explicit Example / Try controls; isolated Gentle simulation, keyboard, calibrated USB radio/gamepad and touch controls; reset, stop and visible ownership. | 1–2 working days              | Real flight remains paused, no rewards/recording mutations, release on blur/menu/exit, Mode 1–4.                |
| Input and shell   | Larger labelled gimbals, main-game navy/amber/cyan tokens, keyboard/controller/radio menu navigation, fullscreen throughout menus/lessons/flight.          | 1–2 working days, parallel    | Every menu and nested dialog, select/range controls, neutral/release gates, EN/UK, mobile, fullscreen fallback. |
| Publication       | Frozen package admission, committed-input/replay checks and packaged-browser acceptance; focused PR in native stack 902.                                   | After each verified increment | User playtest URL rebuilt; no claim of physical-radio or novice acceptance without observation.                 |

The diagram remains an observer. Its camera follows heading to keep the view
behind the drone without locking physics or hiding Acro inversion. The amber
front marker and rotating ground/start-heading reference distinguish yaw from
bank. Near vertical, retain the last usable camera heading. The lab advances only a separate unscored simulation; it never
arms or changes the paused lesson. Native fullscreen may require a pointer or
keyboard gesture; controller activation must offer a clearly labelled full-window
fallback when the browser rejects native fullscreen.

Research decisions:

- [Xbox UI navigation guidance](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/112) supports consistent directional focus, digital-only paths, visible confirm/back hints and predictable return behavior.
- [EdgeTX USB joystick documentation](https://manual.edgetx.org/color-radios/model-settings/model-setup/usb-joystick) describes configurable axes/buttons. Reuse normalized calibrated controls; do not hardcode TX15 channels or assume arm switches are menu buttons.
- [Liftoff's virtual mentor](https://www.liftoff-game.com/news/virtual-mentor-reveal) is an example of guided simulator onboarding. Here, pair the explanation with immediate, clearly separated practice.
- [MDN fullscreen documentation](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen) documents asynchronous requests and user activation requirements; preserve an explicit exit and safe pause on transitions.

No additional unit coverage is introduced here. R7 and the original outstanding
art, original demonstrations, main-game integration qualification and human/device
acceptance remain in scope. Completion evidence belongs in the delivery log.

### Implementation status — 2 October 2026

The controls teaching, live controls lab, directional stick HUD, theme palette,
SIM menu navigation and fullscreen increment is implemented in
[#929](https://github.com/mekhovov/revealline/pull/929), following #926 in native
stack #902. Its final refinement follows current heading to keep the camera
behind the aircraft; real yaw stays visible against the ground reference.
The independent Solo TX15 full-menu preset is in
[#928](https://github.com/mekhovov/revealline/pull/928). See the latest delivery
checkpoint and feature notes for qualification and exact publication heads.
Existing holds, CI, protected merging and public deployment remain separate gates.
Physical radio, unfamiliar-player and sustained hardware acceptance remain open.
The R4–R7 art, original demonstration and qualification backlog is unchanged.

### Player feedback refinement — 2 October 2026

This replaces the earlier **Example / Try controls** selector with automatic
input takeover. Implement the current feedback as one focused child of #929:

| Work                                                | Estimate                    | Acceptance                                                                                                                                               |
| --------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full-travel looping examples and automatic takeover | 1 working day               | Both signs in Acro/self-level; real slow example commands; normal-speed keyboard/touch/calibrated radio; no host progress changes; safe pause/reconnect. |
| Four-prop schematic and ground motion               | 1 working day, parallel     | Independent illustrative motor signs; tick-based animation; real-position ground and height; full attitude and reduced motion.                           |
| Peripheral gameplay aids                            | 0.5–1 working day, parallel | Small transparent HUD, larger touch targets, uncluttered objectives, desktop/mobile/fullscreen and both hosts.                                           |
| Functional qualification and focused publication    | After the increment         | Actual browser input/lifecycle checks, original lesson replay, frozen package admission and rebuilt player URL.                                          |

See `fpv-motion-teaching.md` for the behavior and its motor-mix limitations.
These estimates cover the feedback refinement only; the R4–R7 art, content,
deferred unit coverage and human/device qualification backlog is retained.

### Player feedback refinement — endless practice, 2 October 2026

The next focused R1/R3 increment removes automatic timeout and contact stops
from manual controls-lab practice and adds a drone-centred fullscreen practice
view. Estimate **1–2 working days**, including functional qualification and
focused publication. The practice volume remains bounded to ±80 metres
horizontally and 0–80 metres vertically; ground and boundary collision remain.

Use a lab-only unscored runtime option with proof creation disabled. Normal
attempt limits, course identities, recorded inputs and reward contracts remain
unchanged. Retain focus/stall/disconnect pauses and explicit reset/replay.
The dedicated view presents a larger rear-follow quaternion schematic, wider
ground, compact corner gimbals, optional touch buttons and EN/UK controls.
Fullscreen fallback must remain usable, and leaving practice must preserve any
application fullscreen session that was already active.

Current local evidence comprises 14 browser coach checks (including more than
13 simulated minutes), 27 model checks including the original 24 demonstration
proofs, replay of all 14 Acro school demonstrations and 16 browser diagram checks.
The final production-host browser run passed 19 input/isolation checks. All
three optional packages passed frozen-input admission and reproducibility, and
the rebuilt player URL was launched; no public live, physical-radio or human acceptance is claimed.
See [FPV endless controls practice](fpv-endless-practice.md) for behavior and
limits. R4–R7 estimates and scope, including deferred unit coverage, are unchanged.

### Player feedback refinement — readable stick motion, 2 October 2026

Deliver as a focused child of Pro/Master school #940: quieter motor arcs,
short truthful stick trails and direction cues in both SIM hosts, constant
whole-lesson playback pace, and an explicitly separate hollow movement guide
for recorded examples. Keep live controls unsmoothed, preserve replay identities,
and clear presentation history on pauses, seeking, loops and ownership changes.
Estimate: **one working day**, including browser verification and publication.
See [Readable FPV stick motion](fpv-readable-stick-motion.md) for the implementation,
research and qualification boundaries. R4–R7 art, device/player acceptance and
deferred unit coverage remain unchanged.

## Reviewed continuation — World Adventures, 2 October 2026

This checkpoint supersedes the earlier catalogue counts and historical hold
summaries above. The active branch contains **58 learning lessons (46 Acro and
12 optional self-level)**, the original 60 challenges and a newly verified
**30-adventure expansion**, totaling **148 challenges in 14 worlds**. See
[World Adventures](fpv-world-adventures.md) for the full route/actor contract,
research, content allocation and qualification boundaries.

| Area                                      | Reviewed state                                                                                                                            | Remaining concrete work                                                                                                            |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Shared UI, radio, teaching and fullscreen | Native presentation, continuous school, handheld flight, controller actions, radio Arm/Reset and stored profiles implemented through #945 | Physical iPhone/Steam Deck/radio acceptance and novice observations; coordinate protected integration                              |
| School                                    | 58 authored lessons and installed recommended-mode examples                                                                               | Five first-time player sessions, revise confusing steps, final curriculum/art acceptance                                           |
| World art                                 | #946 improves original eight worlds, actor models, materials, repeated scenery and projectile disposal                                    | Themes integration, artist-authored detail and measured device budgets                                                             |
| New worlds and activities                 | Six distinct arenas, 30 challenges, real follow/observe scoring, six revision-pinned playlists                                            | Protected publication and player feedback; optional example-library delivery                                                       |
| Creator reliability                       | Reimport correction #922 is merged upstream                                                                                               | Integrate its reviewed behavior into the current dependent player branch through coordinated stack update; preserve parallel edits |
| Ghosts and original demonstrations        | #913 is merged; native content stack #889 is fully merged/closed, including #896                                                          | Integrate upstream content into the dependent player branch, finish preserved Garage16 handoff, verify original120 total           |
| Deferred qualification                    | Functional verification continues with every item                                                                                         | R7 unit coverage, broader regressions and actual hardware/player acceptance                                                        |

Do not repeat the old claim that stack889 or #922 is still held. On this review,
stack902 has open members #939 → #940 → #941 → #942 → #943 → #944 → #945 → #946;
inspect live membership before any subsequent publication or rebase. Current
source keeps only its already integrated original demonstrations; a merged PR is
not proof that this worktree's built player includes its changes.

### Next delivery sequence and working estimates

1. **World Adventures publication:** finish frozen-package and packaged-player
   qualification, focused child PR after #946, then refresh the normal local URLs.
   Implementation/functional checks are complete in this increment; CI/merge timing
   is external and has no guaranteed ETA.
2. **Coordinated upstream integration:** 1–3 working days, depending on conflicts.
   Recovery refs and exact remote-head leases, linear stack, preserve every active
   branch. Verify reimport, ghost compatibility and all retained examples again.
3. **Themes and environment refinement:** 3–5 working days per reviewed art batch,
   parallel with gameplay feedback. The Themes chat owns shared appearance contracts;
   avoid a competing theme/preferences layer. Add details based on flight readability,
   not decorative density alone.
4. **Further world variety:** after this six-world pack receives player feedback,
   a closed stunt circuit and observatory ridge are the next researched candidates.
   Estimate 3–5 working days for a verified pair with distinct routes/subjects;
   detailed custom art is additional. They are planned candidates, not shipped maps.
5. **R6 completion:** 4–6 working days for remaining original demos, bounded optional
   adventure examples and targeted retry/section flow after dependencies integrate.
6. **R7:** retain 5–10 working days for deferred unit coverage and release qualification.
   Human sessions and named-device measurements must actually occur; automated
   replay/WebGL receipts do not satisfy them.

The earlier 8–10 week remaining-release estimate is not a measurement of work
already elapsed. Re-estimate after coordinated integration and the first physical
handheld/novice session; no reduced release ETA is claimed from authored counts.
