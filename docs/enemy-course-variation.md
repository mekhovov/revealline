# Varied field-enemy courses

## Scope and decision

User priority (23 September 2026): break the repeating horizontal, vertical and diagonal enemy loops; deliver a small release ahead of further content work. Keep the released Xposed-paced speed targets and main-menu difficulty/admin controls.

Current cause: Solo `classic-motion` and legacy `movement`, and Team `geometry`, reflect velocity components at boundaries. Ordinary keepers otherwise retain their authored direction indefinitely. Merely increasing speed leaves those loops intact.

Options considered: random heading every frame (unreadable, rejected); random angle only at bounces (still locks open-field lanes for too long, rejected); bounded seeded curves between straight travel windows (selected).

## Research and limits

- [Qix's original Game Boy manual](https://www.thegameisafootarcade.com/wp-content/uploads/2017/04/Qix-Game-Manual.pdf) describes irregular field movement while Sparx occupy boundaries. Borrow the separation of spatial roles, not the Qix artwork or exact algorithm.
- [AirXonix developer rules](https://www.axysoft.com/airxonix/) distinguish field balls threatening cuts from mines moving on filled ground. Keep those domain distinctions.
- [Cubixx HD developer article](https://blog.playstation.com/2011/09/15/cubixx-hd-coming-to-psn-with-7-player-multiplayer/) separates line chasers, pursuing Homers and attraction hazards. Keep pursuing enemies a distinct signalled role; do not turn every ordinary keeper into a homing attacker.
- [Xposed Reloaded's publisher listing](https://store.playstation.com/en-us/concept/10002881/) emphasizes simple controls and demanding territory capture, but does not disclose a steering algorithm. Prior frame observations in `research/xposed-motion-calibration.md` establish approximate speeds and linear segments, not random-turn constants. This is an original adaptation, not an asserted reproduction of Xposed internals.

## Contract

New fresh attempts use gameplay-pressure.v3 / gp3 identities. Preserve the complete v2 adapter byte-for-byte and dispatch historical gp1/gp2 saves through their original adapters. Old recordings, authored editions and existing attempts do not acquire new motion silently.

Only moving ordinary Solo bouncers (including both Versus boards) and Team drifters receive an explicit `course: 'field-course.v1'` descriptor. Reject this descriptor on stationary or other actor types. Patrol routes, reclaimed-ground roamers, bosses, eroders, scripted Hunters and telegraphed pursuit/intercept keep their established roles. Pressure warning/committed phases suspend course variation so a promised attack stays legible.

One pure shared steering function runs once per 120 Hz simulation tick, never once per rendered frame or collision subdivision. Each actor/run seed independently selects a signed 30–75 degree curve, lasting 0.5–0.75 seconds, once in each three-second block with a start offset of 1–2 seconds. Neighboring changes therefore start 2–4 seconds apart. Smooth easing bounds angular acceleration; speed magnitude is preserved. No player/trail sensing, teleport, instantaneous reversal, random speed spike or collision-rule change. First second stays straight; frozen/stunned actors do not steer. Existing fixed ticks/actor clocks determine the phase; no wall-clock randomness or new hidden mutable RNG state. Different seeds/actor IDs vary the curves; equal seeds preserve Versus parity and replay determinism. Bounces remain swept reflections throughout a curve.

The descriptor is validated at both runtime boundaries, serialized in level/replay data and included in authoritative Solo enemy checkpoints when present. Main-menu copy identifies varied field courses and preserves the existing difficulty control. Existing speed/density preferences remain usable.

## Implementation and fast gates

1. Freeze v2 adapter, introduce gp3 dispatch/description and validated course descriptors.
2. Share the pure steering helper across legacy Solo, classic Solo and Team, before swept movement. Preserve warning/freeze behavior and every unchanged role.
3. Focused tests: axis/diagonal escape, bounded speed/turn, reproducibility and differing seeds/IDs, collision domain under curves/walls, freeze and pressure protection, historical gp1/gp2 identities, actual replay and paired-board equality, Team operation, bad descriptor rejection.
4. Review scoped diff; run mandatory validation/lint/format and remote production build/provenance. Long suites explicitly waived, not passed. Publish through the sole publisher with immutable assets, archived previous release and public/native checks on the new build. No local heavy build on a low-disk machine.

## Acceptance limits

Independent design review approved the bounded contract. Implementation applies incremental angles to the current reflected velocity; pressure phases are checked after their tick-start update and skipped turns never accumulate. Historical v2 adapter Git blob: `f961327ac7bf463ddc6d8e9e0b167102bcac14a1`.

## v0.89.0 delivery evidence

- Reserved by the sole publisher; based on game source `950f19045facacf5151c90661de1ca28d30658df`. Independent integration review approved; exact-head review and hosted mandatory gates remain publication requirements.
- Final focused local cohort: **38 passed, 0 failed, 0 skipped** in approximately 21 seconds: `field-course`, `xposed-motion`, Solo/Couch pressure hosts and pressure-completion host. This is not the full suite.
- The catalogue validation within that cohort checked **819 Solo variants, 108 Team variants and 192 retained Classic variants** with gp3. This proves bounded descriptor/geometry validity, not 1,119 completed playthroughs or balance.
- Historical 720-tick checkpoints independently read from released v0.87 source: gp1 `cabdf00a3134230f`, gp2 `b38537215b5e089e`; both match the new runtime. Replay reconstruction, equal Versus boards, actual Team curves, a one-cell corridor, freeze/stun and pursuit warning/commit were exercised.
- Earlier local attempts exposed missing sparse-checkout fixtures and two new test-fixture mistakes (checkpoint shape and manually assigned stun being overwritten by the real ability system), followed by a missing empty Team bonus schedule; corrected before the final coherent cohort. No previous failed run is represented as passed.
- Scoped lint/format and `git diff --check` passed. Full source validation, production build, immutable release and public/native acceptance are **pending**, not claimed locally; the machine is low on disk. Long suites remain explicitly waived.

Focused simulation/public checks establish varied lawful movement, not whole-Journey balance or human enjoyment. All-level pacing, physical-controller and extended human testing remain open. No new maps, assets, enemy families, speed inflation, menu redesign or unrelated fixes in this release.
