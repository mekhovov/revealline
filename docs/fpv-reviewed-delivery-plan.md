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

The diagram remains an observer. A fixed camera behind the initial heading does
not lock the drone's physics or hide Acro inversion; actual yaw can turn the nose
toward the viewer. The amber front marker and start-heading reference explain
that change. The lab advances only a separate unscored simulation; it never
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
