# Container Yard demonstrations

World Studio adds 16 examples for the eight Container Yard challenges in
Self-level and Acro. The previous 88 examples are unchanged; the catalogue now
offers 104 demonstrations across 52 challenges. Parking Garage remains playable
while its examples are prepared separately.

These recordings demonstrate orientation, exploration, moving hazards and the
fictional sentry, ground patrol, drone, vehicle and extraction encounters. Combat
examples physically approach their targets before firing, so players can see the
enemy body and attack cues. Actual incoming projectiles remain active. Every
recording completes with zero contacts and 85–100 health; every fired player
pulse hits. Durations range from 25.64 to 82.24 seconds.

The recordings are successful examples rather than perfect-score targets. Drone
intercept and extraction can lose shields during their approach. At horizontal
speeds of at least 1 m/s the drone faces forward throughout, with 98.22–100% of
travel distance within 45° of its heading. Course geometry, actors, rules,
scoring, input quantization and physics are unchanged.

Viewing uses the existing pause, restart, mode, half-speed, FPV/chase and **Fly
this challenge** controls. Demonstrations are unscored and earn no completion,
personal best or playlist progress. Exact source and replay validation runs
before playback.

## Reproduction

The repository-relative `generate-container-yard.mjs` generator runs the actual
v2 runtime and records consumed commands, including action bits. A fresh run
reproduced all 16 complete course/proof artifacts exactly. Independent replay
confirmed each recorded health, hit/shot count, completion and zero contacts.
All 24 legacy v1 and 64 earlier v2 proof hashes are preserved.

`container-yard-provenance.json` records generator/runtime identities, artifact
and proof hashes, per-shot target ranges, incoming fire, damage ticks, landing
support and heading measurements. The new proof data totals 626,406 bytes. The
generator is an offline authoring tool, excluded from the player package.

## Player verification

- All 16 examples completed in the final Chromium build with their recorded
  health and hit counts. The catalogue exposes 52 links / 104 mode-specific
  examples, with no example action for uncovered Garage challenges.
- Sentry, patrol, drone, vehicle and extraction approaches were inspected in
  FPV and chase before firing. Enemy bodies and attack markers are recognizable;
  a separate mobile pre-fire inspection also confirmed target readability.
- Restart, mode switching, half speed, Fly this challenge and record isolation
  passed. Viewing leaves sector timing unscored and creates no personal best.
- Offline reload retained 52 links and completed orientation. An additional
  offline combat walkthrough completed Target Lane with two shots/two hits and
  no records. Its paused simulation state remained identical while waiting.
- The hazard return was inspected in both views with no contact. Ukrainian
  coverage and playback controls fit 390×844 without horizontal overflow.
- Focused lint, syntax, whitespace and package checks passed. Both browser
  walkthroughs reported zero JavaScript errors.

The final package contains 75 files / 12,306,578 bytes, SHA-256
`f33c04cf3a4a63953bebf0914046c841e3fa4f1602912f7e943c9c2931dbf2cb`.
This remains a development playtest; physical-device performance, unfamiliar-player
qualification and final-phase unit coverage remain outstanding.
