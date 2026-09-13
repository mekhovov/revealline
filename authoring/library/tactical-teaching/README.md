# Three Tactical teaching demos

These are isolated, original authoring scenarios based on the unchanged `e29f2ac9207b047c07e6b72f94fa24cea9b00e1c` runtime. They address a small part of P4.3: Scout information, carrier supply/field timing and Fiber signal resistance with cable risk. They are not a complete Tactical mode, military simulation, delivery objective, new ability, campaign release or human difficulty qualification.

All three use a simple shared 72 × 36 clearing and one required relay; actor motion and the interference/cable rules distinguish the lessons. The registered seven-class recipes and FPV procedural theme are copied from pinned source bytes. No new image, finished music, pack, schema or runtime change is included. The exact existing transport is `xonix-playground.v5`, `xonix-level.v4`, `xonix-core.v5`, `xonix-replay.v6`. Manual equipment remains available because these recipes do not opt into `classic.arcadeActions`. Their explicit `stopOnCapture` requires fresh directional input after an unfinished closure; it does not grant a hover ability.

The three JSON files live under [scenarios](scenarios/), outside the build allowlist and all public pack catalogs. They are manual Playground imports pending integrated browser review. Each has its own level ID/revision and saved-context identity; historical Fieldcraft, Arcade and replay fixtures are untouched.

| Scenario                                                                     | Player objective and counterplay                                                                                                                          | Actual evidence                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Read the clearing](scenarios/tactical-read-clearing.json) — Scout           | Scan at home to locate the hidden relay, then fly Down to the opposite safe border. Secure 45% and the relay. Reversing a live cut remains dangerous.     | Scan reveals the relay before any capture and does not change enemy position/speed. The same route without Scan also wins: discovery is information, never a hidden mandatory flag. A deliberate reversal loses to self-contact.                                                                                    |
| [Borrowed seconds](scenarios/tactical-borrowed-seconds.json) — Light carrier | Collect at the home supply pad, move Down about five cells, place the stun field beside the crossing patrol and finish the cut. Secure 45% and the relay. | Pickup fills one charge, the field consumes it and holds the actor for 300 ticks. Omitting either supply or field loses this same crossing to enemy-trail contact. A longer, ordinary left-border/lower-crossing detour wins without equipment. The field gives time; it does not deliver cargo or award territory. |
| [Quiet crossing](scenarios/tactical-quiet-crossing.json) — Fiber relay       | Cross the visible signal band, Scan inside it, and close Down within five seconds and 36 cable cells. Secure 45% and the relay.                           | Fiber spends 144 ticks in the band without slowing or action/Boost lock. The same timing with Scout produces a blocked Scan and later cut timeout. Fiber still loses to a 37th cable cell on an overlong sideways detour. This is an abstract field rule, not real communication performance.                       |

The compact ready card uses the existing `Recommended:` prefix and derives its coverage, required relay and limits from the actual rules. The existing full Mission brief carries the instructions and caveats. Class, ability and Supply labels use the game's current controls; no hard-coded keyboard binding is required by the data.

## Try through the existing authoring route

Run this isolated checkout's ordinary server and open `game/playground/`. Import one of the JSON scenarios, inspect its class and authored rules, then use the Playground's existing full game preview. Read its Mission brief and start explicitly. This handoff is practice: it must preserve the parent flight and must not grant campaign awards. Actual browser, touch, controller, native picker, text-layout and audio checks remain pending; Node imports and replay proofs do not establish those behaviors.

For the carrier's equipment-free fallback, travel Left along the top border to the west edge, Down along that safe edge to the middle row, then Right across the field. It takes longer and secures a different region. Do not infer that every class or arbitrary route is solvable from these bounded examples.

## Reproduce the authored evidence

```sh
node scripts/verify-tactical-teaching.mjs
node --test game/test/tactical-teaching.test.mjs
```

[The verifier](../../../scripts/verify-tactical-teaching.mjs) requires exact scenario derivation from [build.mjs](build.mjs), exact unique route coverage, source/theme/roster identities, declared commands, actual terminal result, event metrics and authoritative checkpoint. The [fixture](routes.json) contains **20 ordinary-input traces: 10 wins and 10 failures across both immediate and grid-center steering, totaling 9,300 simulation ticks**. It is newly recorded evidence, not borrowed historical verdicts.

Every trace saves an actual unfinished prefix through `suspendSession`, serializes it, restores through `restoreSession`, and plays the remaining ordinary inputs. The resumed replay and complete terminal checkpoint must equal the uninterrupted run. Scan windows, active carrier field/enemy stun and Fiber interference exposure are included in the appropriate prefixes. No actor, cell, life, time, private state or verdict is assigned by the route controller. There are no storage writes or extra input-release events.

| Route                                   | Result in either policy                  |
| --------------------------------------- | ---------------------------------------- |
| Scout scan and no-scan clear            | 51.428571% / 12,740 / 1 life / 415 ticks |
| Scout reversed cut                      | self-contact / 0% / 0 lives / 62 ticks   |
| Carrier supply + field clear            | 51.428571% / 12,740 / 1 life / 415 ticks |
| Carrier without pickup or without field | enemy-trail / 0% / 0 lives / 195 ticks   |
| Carrier ordinary detour                 | 50% / 12,400 / 1 life / 1,494 ticks      |
| Fiber direct clear                      | 51.428571% / 12,740 / 1 life / 414 ticks |
| Fiber overlong detour                   | cable-limit / 0% / 0 lives / 439 ticks   |
| Scout in the same signal crossing       | cut-timeout / 0% / 0 lives / 606 ticks   |

To materialize into an empty, reviewed output area, `node authoring/library/tactical-teaching/build.mjs --write` creates only the three new scenario files; it refuses existing files. `node scripts/verify-tactical-teaching.mjs --record` creates only this new proof fixture and likewise refuses an existing file. Routine verification never rewrites data. Intentional authoring revisions should preserve earlier evidence, update only these new recipes/fixtures, and receive independent source/proof review before any catalog or public integration.

Remaining P4.3 work includes meaningful cargo/delivery primitives if desired, broader hangar/interception/net/boss teaching, integrated browser access, human challenge/readability testing and a deliberately scoped Tactical progression. Existing slow fields are not literal net capture; Fiber resistance is not cable immunity. This slice closes none of those broader requirements.
