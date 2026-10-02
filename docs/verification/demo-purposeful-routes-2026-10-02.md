# Purposeful improvised Demo routes — 2 October 2026

Base: `b278b0b67` (`main`, fetched before implementation).

## Problem and behavior

The improvised source previously injected opposite-direction inputs during a
live cut to manufacture failures. It also retried a failed closure by reversing
into the same cable. These repeated self-contact deaths were authored behavior,
not a simulation defect.

The replacement shares capture geometry and independent candidate simulation
with the existing planner. Safe-ground approaches lead into straight, L-shaped
or U-shaped routes with an actual reconnection endpoint. Seeded selection among
up to three good routes changes strategy without mid-cut steering jitter.

Candidate evaluation rejects exposed reversals, self-contact, stalls, terrain
deaths and immediate departure losses. Successful captures are required before
the scene may select a riskier route. A risk candidate must have at least two
seconds of exposed travel and fail to an actual enemy, boss lane or projectile.
It has a 25% selection opportunity when such a candidate exists; this is not a
25% scene-loss guarantee. At most one such loss is selected per scene. Subsequent
routes must succeed, rather than repeating the same losing gesture.

Preparation is limited to six decisions, 45 seconds of recorded simulation,
and the existing per-decision limits of 16 candidates, 1,200 ticks per candidate
and 12,000 total candidate ticks. It yields between candidates for cancellation.
Playback ends at a maneuver boundary. A source with no useful capture declines
selection through the existing director fallback instead of showing a suicide.
Every published performance passes ordinary strict replay verification. Live-bot
qualification, core physics, reviewed recordings and player recordings are unchanged.

## Verification

`node --test --test-concurrency=1 game/test/demo-improv-player.test.mjs game/test/demo-bot.test.mjs game/test/demo-sources.test.mjs`

All 30 tests passed. The suite includes existing live-bot seed/policy checks,
real Worker lifecycle and checkpoint tests, source isolation, cancellation,
dynamic packaging and new per-tick reverse/self-contact regressions.

Night Crossfire generated performances:

| Steering    | Seed      | Captures | Losses         | Bends | Ticks |
| ----------- | --------- | -------- | -------------- | ----- | ----- |
| Immediate   | 123       | 5        | 1, enemy-trail | 7     | 2,914 |
| Immediate   | 987654321 | 2        | 0              | 4     | 1,029 |
| Grid-center | 123       | 5        | 0              | 8     | 2,428 |
| Grid-center | 987654321 | 6        | 0              | 10    | 3,356 |

Additional direct simulation probes used actual Standard Journey levels,
grid-center steering, seed 123 and each entry's first class recipe:

| Level               | Captures | Losses         | Ticks |
| ------------------- | -------- | -------------- | ----- |
| return-in-reserve   | 5        | 1, enemy-trail | 3,456 |
| first-link          | 5        | 1, enemy-trail | 4,605 |
| read-the-arrows     | 5        | 1, enemy-trail | 4,504 |
| first-relay         | 4        | 1, enemy-trail | 2,845 |
| signal-remix        | 6        | 0              | 4,686 |
| four-motor-landings | 6        | 0              | 4,496 |

All six ended off the live trail and matched their final replay checkpoints.
Preparation took approximately 1.7–5.1 seconds on the local development host;
these measurements do not qualify iPhone loading performance. Focused ESLint,
Prettier and `git diff --check` passed.

These are automated behavior and simulation checks, not a new two-hour browser
observation, physical-device check or human viewing study. Existing release
qualification items remain open. The stricter fallback can skip a difficult
level if the bounded search finds no useful capture; it does not widen the
qualified live-bot whitelist or guarantee coverage for arbitrary custom maps.
