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
