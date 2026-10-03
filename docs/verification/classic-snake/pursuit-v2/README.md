# FPV Snake v2 production observations

These retained journals demonstrate legal input routes through the production engine. They are **not automated test-suite results or human play qualification**. The publishing test waiver remains active; the regression sources in `game/test/classic-snake-v2.test.mjs` were authored but not run.

The observations were refreshed after the sprinter proximity correction. A sprinter that finishes its eight-tick recovery now waits until a head is within six traversable cells before showing its four-tick warning. Once armed, its two single-cell burst steps remain committed. [The proximity observation](sprinter-proximity.json) records a distant target remaining still for 24 ticks and a nearby target warning at tick 8, with exact replay restoration.

## Authored Solo routes

[The first-pass receipt](receipt.json) covers all 36 new authored missions at seed 17. Steering uses visible board geometry, current body cells, current target positions and current supplies; it does not inspect future RNG or predict target movement. The controller submits ordinary turn inputs and advances the production core without modifying run state.

- 35 missions cleared on the first disclosed route.
- Broken Ring's first attempt lost to a wall after 11 of 12 required catches. That failed journal remains in `classic-pursuit-broken-ring.json`.
- [A second Broken Ring route](broken-ring-followup.json) added a visible free-space preference and cleared all 12 targets in 207 ticks. Its separate winning journal is `classic-pursuit-broken-ring-space-aware.json`.
- Consequently, every new authored Solo mission has at least one retained winning journal. All retained journals restored exactly against their accepted recipe.
- The first pass included 14 pickup collections and six optional courier catches. Courier points remained separate from required catches. The receipt also records gate closures and occupied-gate yielding.

The receipt binds engine and catalogue SHA-256 values before and after the observations. Replay files remain compact to preserve the recorded byte hashes. An implementation correction invalidates these source bindings and requires fresh observation; this document does not claim a committed Git revision.

## Team and match clocks

[The Team follow-up](team-followup.json) retains three cooperative attempts:

- Oval Intercept cleared eight required catches, credited 4/4 across the seats.
- Shared Supply cleared 16, credited 9/7, and collected two supplies.
- First Shutter lost after six catches when the greedy controller trapped one seat against the partner's body. The failed journal is retained. This is not a completed cooperative route qualification.

[The match-boundary receipt](match-boundaries.json) and its full match journals record:

- Score Duel: one board crashed at 3,781 ms and remained frozen while the other reached the exact 180,000 ms cap. At 199 ms per step, their final step counts were 19 and 904. With no catches on either board, the score result was a draw.
- Survival: both boards expired at exactly 30,000 ms between their 199 ms movement steps. Their core clocks remained at 29,850 ms; the match-owned deadline result restored exactly.
- Exact-deadline catches: both boards caught at 30,000 ms on 240 ms steps. The catches refreshed both deadlines and the match continued.
- Legacy Continue: a v1 paired session with accepted pending turns and a fractional 517.25 ms clock migrated into the match controller without changing either core journal.

[The winning UI session](winning-ui-session.json) wraps the verified authored Oval Intercept clear: eight catches, 97 steps and 19,400 ms. It can be imported through the standalone FPV Snake session UI.

## Remaining gates

Human playtesting is still required for fun, difficulty, readable timing, touch controls and cooperative route choice. These observations do not prove every seed, pace, setup, controller strategy or cooperative mission can be completed. Browser, packaging, accessibility and release checks are separate evidence. Automated suites remain waived and unrun.
