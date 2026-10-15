# Team and Duel finale qualification — 15 October 2026

The recommended deeper strategy audit now covers the final authored mission of all **24 expansion chapter packs: 12 Team and 12 Duel**. It adds two spatially different successful Standard routes per finale, actual mixed-route Duel races with seats reversed, exact public recorder replay, and pause/fresh-attempt regression coverage. No level geometry, goals, enemies, mechanics or runtime authority changed.

The source base is `da0b0108206a0270b4b870e747f2d1bc0e6695cb`. Qualification ran on this Mac using Node v20.19.5, Darwin ARM64. These are ordinary-command core and recorder observations, not native browser, physical-controller, audio or human-enjoyment acceptance. Human playtesting remains waived.

## What the audit establishes

- The finale selection follows the last campaign part of each chapter pack, so a chapter crossing native simulation editions is counted once.
- All 48 retained routes reach the actual Standard completion goal at seed 17. Duel uses Scout with Immediate steering and the untimed first-clear protocol. Every Team route banks at least one capture from each pilot. All original primary command sequences remain byte-for-byte structurally unchanged.
- Alternatives must change at least **24 actual newly claimed cells** in one corresponding capture and at least **two drawn trail cells**. The trail criterion rejects an idle delay that merely changes where enemies are at capture. These are explicit spatial-difference thresholds, not a claim that two routes have equal difficulty or value.
- All 12 Duel finales race the two different routes with each route assigned to each seat: **24 mixed-route matches**. Both competitors bank territory, and the winner/draw follows the routes' independent completion times when seats reverse.
- The 48 route runs and 24 mixed-route matches export through the existing V2 public recorder and verify the complete state exactly on the same runtime. No approximate equality, omitted state fields, random search in tests, platform skips or new checkpoint allowlist is introduced.
- Each route pauses a cloned continuation during an actual open cut, then checks 120 held-input ticks cannot change the paused state. Fresh core attempts after completion retain no prior progress or held input. These checks are separate from native host Retry and resumed-win qualification.

## Retained routes

Times are fixed-input simulation observations, not human completion targets. Team capture pairs show the number of banked closures by P1/P2; they do not measure equal effort or necessity.

| Mode / chapter finale | Primary seconds | Alternative seconds | Team captures: primary → alternative |
|---|---:|---:|---|
| Team · Expedition Homecoming | 86.8 | 29.7 | 10/12 → 6/5 |
| Team · Watchtower Accord | 39.7 | 39.2 | 8/6 → 8/5 |
| Team · Highland Reunion | 4.9 | 57.6 | 1/1 → 6/7 |
| Team · All Hands Home | 37.7 | 36.7 | 4/8 → 4/7 |
| Team · Coastal Repair Pact | 40.7 | 39.7 | 10/3 → 9/3 |
| Team · Garden Reunion | 39.9 | 38.9 | 7/7 → 7/6 |
| Team · Harbor Homecoming | 46.2 | 45.2 | 9/5 → 9/5 |
| Team · Foundry Handshake | 38.3 | 31.6 | 6/5 → 5/4 |
| Team · Observatory Accord | 48.4 | 46.3 | 8/5 → 7/5 |
| Team · Archive Home Route | 30.9 | 28.5 | 8/2 → 6/2 |
| Team · Citadel Shared Crown | 40.9 | 34.6 | 8/5 → 7/4 |
| Team · Night Junction | 30.3 | 20.7 | 9/2 → 6/1 |
| Duel · Expedition Decider | 18.6 | 19.6 | — |
| Duel · Watch Line Finish | 20.5 | 20.5 | — |
| Duel · Highland Finish | 7.1 | 5.2 | — |
| Duel · Dockyard Decider | 44.8 | 42.8 | — |
| Duel · Unbroken Finish | 45.7 | 46.4 | — |
| Duel · Signal Sprint Finale | 41.6 | 26.8 | — |
| Duel · Horizon Photo Finish | 46.2 | 46.2 | — |
| Duel · Afterglow Finish | 40.2 | 40.5 | — |
| Duel · Prism Photo Finish | 62.8 | 56.3 | — |
| Duel · Archive Decider | 7.5 | 5.2 | — |
| Duel · Crown Photo Finish | 18.6 | 19.6 | — |
| Duel · Neon Switch Final | 27.5 | 24.3 | — |

## Fast-route outliers and bounded mistake probes

The audit preserves these findings instead of stretching routes with forced waiting or changing goals simply to match a target duration:

- **Team Highland Reunion:** the existing two-capture route clears in 4.9 seconds, while a spatially different route clears in 57.6 seconds. The latter reuses an Expert command sequence independently replayed against the unchanged Standard level; Expert tuning is not imported.
- **Team Expedition Homecoming:** a new 29.7-second route clears the same staged goal as the earlier 86.8-second route.
- **Duel Archive Decider and Highland Finish:** alternate two-capture routes clear in 5.2 seconds.

A separate bounded search tried **42 input-omission probes** on those four fast routes. It inserts two, four or eight seconds of neutral commands halfway through a retained segment, then supplies the remaining route and at most two ordinary route repetitions. These are input omissions during a running game, not the public Pause operation. No lives, enemies, reserves, cells, positions or outcome are assigned.

Four fixed two-second-omission traces are retained for regression:

| Finale | Observed exposure | Recovery evidence | Limit |
|---|---|---|---|
| Team Highland Reunion | Keeper line impact downs P1 | Reserve revival, followed by another banked capture | Attempt still running after bounded continuation |
| Team Expedition Homecoming | Lane impact and later self-trail / lane contact | Reserve revivals and a later partner capture revival; further banked progress | Attempt still running; longer omission probes also lost |
| Duel Archive Decider | Keeper enemy-trail hit, followed by self-contact | Both boards retain a life and bank further territory | Race still running; no recovery win established |
| Duel Highland Finish | Keeper enemy-trail hit, followed by self-contact | Both boards retain a life and bank further territory | Race still running; no recovery win established |

These four traces also pause at the actual failure state, preserve it across 120 input ticks, verify exact direct core replay, and check that a fresh attempt discards the failure state. Public match export correctly rejects these unfinished attempts; the regression preserves that boundary. The full probe history is retained, including **zero same-attempt final wins** in this bounded recovery search. A resumed capture is useful recovery evidence, but it is not a recovered victory or proof that the long route is attractive to a human.

## Discovery, verification and failed attempts

The immutable command inputs live in [finale strategies](../game/test/fixtures/multiplayer-expansion/finale-strategies.json) and [bounded mistake traces](../game/test/fixtures/multiplayer-expansion/finale-mistakes.json). Deterministic tests replay those inputs; they never search for or manufacture new expected answers.

The explicit offline tools are [strategy discovery](../scripts/discover-multiplayer-finale-strategies.mjs) and [mistake-probe discovery](../scripts/discover-multiplayer-finale-recovery.mjs). Strategy discovery preserves the existing primary fixtures, source/tuning identity, failed probes and repeated searches. A missing qualifying route makes the selected strategy discovery fail. Mistake discovery reports observed failures and absence of a recovered win without claiming success.

- [Strategy discovery history](research/multiplayer-finale-discovery-2026-10-15.json) retains **710 probes**, including earlier attempts with the weaker capture-yield-only criterion. Three successful timing-only candidates were rejected: Team Archive Home Route, Team Watchtower Accord and Duel Neon Switch Final. They were replaced by spatial alternatives. Team Highland required the separately replayed existing Expert input trace.
- [Mistake-probe history](research/multiplayer-finale-mistake-probes-2026-10-15.json) retains all 42 attempts and actual risk events, including partial and lost runs. Only the fixed fixture traces are regression inputs.
- The first mistake-suite attempt confirmed that the public recorder rejects unfinished matches. The corrected regression expects that rejection and compares a second full direct core replay; it does not fabricate a terminal result.
- The first new strategy-suite attempt exposed a test-comparator defect: `structuredClone` removes the null prototype of the internal loadout lookup. Fresh-state comparison now retains an untouched owned initial run and compares the exact state including its prototype, rather than weakening equality or changing gameplay.

**Local checks passed: 38 new strategy tests + 4 new mistake tests + 33 existing pilot/interaction tests = 75 tests, with zero failures or skips in the final runs.** Verification results are recorded in the companion [qualification receipt](research/multiplayer-finale-qualification-2026-10-15.json). The existing pilot-strategy and interaction suites are rerun alongside the new scope. Formatting and focused lint apply to the new helpers, tests and discovery tools.

Reproduce the retained evidence with:

```sh
node --test game/test/multiplayer-finale-strategies.test.mjs game/test/multiplayer-finale-mistakes.test.mjs game/test/multiplayer-expansion-strategies.test.mjs game/test/multiplayer-expansion-interactions.test.mjs
```

## Remaining boundaries

This closes the recommended **24-finale spatial strategy sample**, beyond the earlier eight pilots. It does not prove a meaningful alternative in every other mission, all difficulty/steering combinations for the new alternatives, balanced competing strategies, human pacing, sustained enjoyment, every interruption/recovery, other processor outputs, native hardware or public delivery. Existing all-mission/all-preset primary-route evidence remains separate and unchanged.

The fast-clear outliers remain identified targets if later product feedback calls for progression tuning. The observed failures show real exposure, but neither their existence nor the alternative route proves that a particular challenge is well balanced. No arbitrary pacing adjustment was made, and no human-playtest requirement was silently reopened.
