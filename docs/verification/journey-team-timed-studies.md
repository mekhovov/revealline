# Shared windows: purpose-built Team timed-route greyboxes

2026-09-21. **Partial slice4, not accepted content, a release, or a P02/P14
completion claim.** Builds on the explicit Team v5/v7 bonus integration. No old
map, mission, replay, player progress, Journey enrollment or asset is changed.

## Authored decisions

`createTeamTimedCandidates()` creates three original shared-board maps, not
automatic Solo conversions. Studio offers Inspect, then explicit Apply to a local
draft. Exact Team export uses the common compiler and strict pack transport.

| Study                    | Choice and interaction                                                                                                                                                                                 | Qualification still needed                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Window exchange · band4  | Opposite shelves and two independently retained chambers; take shared slow while the partner encloses the other chamber, or bank both islands without it. Neither chamber alone supplies the74% quota. | Alternate-anchor/delayed taking routes; short optimized paths; genuine two-person cooperation.                                                  |
| Coolant crossing · band5 | Staggered walls and three platforms; take peripheral freeze while the partner returns onto the centre, or neutralize slow ground first. Freeze does not protect against the lethal sump.               | All-three-bed mastery: every recorded clear currently leaves some terrain unneutralized. Alternate-anchor taking and human readability.         |
| Depot dash · band6       | Hooked bays, upper/lower return platforms, two diagonal keepers and waking roamers; optional collector-only speed for a long return, with a later shared reserve window.                               | Both-rover mastery on Gentle/Expert taking; alternate-anchor/delayed taking; reserve collection and later-window routes; short optimized paths. |

Player movement remains10cells/s. Standard keepers resolve to3.2/4.48/5.6cells/s
on Gentle/Standard/Expert through the shared pressure-v2 catalogue, not level
physics overrides. The four bonus kinds use the already shared bounded effects.
Each schedule offers a1s announcement,10s availability,8s cooldown, at most three
appearances and one collection. Every item is optional and contact-only.
These are authored candidate timings, not measured Xposed Reloaded rules.

All maps use the same foundation, wall, field-retention, terrain and coverage
contracts. The Depot geometry was revised after an early full-height shortcut;
six preset/seat tests preserve its rejection. Coolant's freeze anchors were
moved off the obvious first cuts and then outside unavoidable first-window
keeper pressure. No mandatory timer, extra objective, or blanket speed hike was
added to mask a spatial issue.

## Public-input evidence

`game/test/fixtures/team-timed-routes.json` records18 exact mission/preset/route
families: three missions × three presets × pickup-free/taking. Each starts from
`createCoop`/`startCoop` and uses only public `stepCoop` directional inputs.
No position injection, pickup grants, effect edits or post-damage repairs.
Neutral commands while an actual craft is still moving are refused **before**
execution. State/event hashes repeat exactly; this is local deterministic
evidence, **not an official Team save/replay format**.

- **72 base cases pass:** both seat assignments × joint-cuts on/off for every
  family. Every case clears without a knockdown and has at least two real return
  closures per pilot. Pickup-free routes collect nothing; taking routes collect
  the intended slow/freeze/speed while the other pilot is cutting.
- Taking openings contain no joint idle ticks. Pinned genuine return events show
  Window's partner benefiting from slow in the opposite chamber, Coolant's
  partner banking onto the centre during freeze, and Depot's collector reaching
  the upper platform during speed while the partner banks the lower platform.
- **36 extra timing/seed probes:**20 clears,13 first knockdowns, one exhausted
  route and two refused artificial-neutral-brake commands. These16 failures are
  intentionally retained. A passing assertion that reproduces a failure is not
  a successful gameplay qualification. Reusing the seed1 taking plan with
  seed2/delay30 does not qualify any of the three alternate-anchor strategies.
- Search used legal branch simulations, then replayed the chosen complete logs
  from a fresh engine. After the cooperative opening many continuations alternate
  one active pilot. This does not establish human cooperation or enjoyment.

| Optimized seconds | Gentle free / taking | Standard free / taking | Expert free / taking |
| ----------------- | -------------------- | ---------------------- | -------------------- |
| Window exchange   | 25.2 /22.4           | 18.7 /21.25            | 11.4 /19.65          |
| Coolant crossing  | 44.05 /26.4          | 47.75 /33.85           | 40.675 /30.95        |
| Depot dash        | 24.15 /13.725        | 30.2 /29.225           | 24.15 /21.675        |

These are solver durations, not target human durations or proof of a rising
difficulty curve. The60–150s design intention is unvalidated. Fast Expert clears
demonstrate that faster actors alone do not guarantee harder geometry.

## Verification and review

The143-study-test suite pins the exact18-family/six-option matrix, all three
compiled presets, topology/transport, real theme IDs, both first-window anchor
alternatives, milestones, historical source ownership and the rejected shortcut.
Together with Team engine, timed Solo, actual host/transport and presentation
regressions, **904 tests pass on Node20.19.5 and22.22.2**. The sparse worktree uses
the read-only exact-revision adapter documented in the prior integration report;
no test source is replaced.

Independent read-only review repeated all18 engine state/event hashes and the
143 tests on both Node versions. It requested stricter matrix/milestone gates;
those now require actual item coordinates and genuine return reasons, rather
than infer location from a collection event that does not contain coordinates.

Native Studio inspection at localhost:8844 checked Inspect → Apply, all three
map previews, the actual pressure-v2 rules, terrain/surface/actor distinctions,
numbered timed anchors and capture overlays. Preview source carries real theme
IDs. This observation does **not** claim a native full clear of these missions.
Actual host import/keyboard collection/pause checks from the preceding runtime
integration are separate evidence, not silently counted as these new routes.

## Remaining gates

Research recheck: [Xposed Reloaded's publisher listing](https://store.playstation.com/en-us/concept/10002881/)
supports compact controls and demanding picture-reveal levels, not a specific
pickup timer or enemy-speed formula. [AirXonix's developer rules](https://www.axysoft.com/airxonix/)
separate field balls from mines on filled ground. [Valve's AI presentation, p92](https://cdn.akamai.steamstatic.com/apps/valve/2009/ai_systems_of_l4d_mike_booth.pdf)
distinguishes the intensity of threats from their pacing. Our design inference
is to assess route exposure, return choices and encounter timing separately from
speed. This study retains authored deterministic presets; it does not introduce
an adaptive director, invisible rubber-banding, or a claim of guaranteed enjoyment.

1. Qualify adaptive routes for delayed starts, alternate anchors, missed and
   later windows, and the optional reserve. Keep the failed probes as regressions.
2. Prove Coolant neutralization and Depot both-rover mastery, or redesign those
   optional goals/geometry with an explicit reason; do not lower assertions.
3. Review short optimized paths and pacing against human attempts. Do not fill
   time with mandatory idle waits or tedious quota cleanup.
4. Qualify the actual new maps in the host, keyboard/touch/gamepads and genuine
   two-player sessions, including reduced effects, muted audio and recovery.
5. Only after interactions are accepted, produce three original compositions,
   fit campaign distribution, and enroll explicit editions. These greyboxes use
   no authored background; exported Team test scenery is not mission artwork.
6. Integrated owner PR/version/immutable release/Pages audit remains required.
   No additional public playable mission is claimed by this unit.
