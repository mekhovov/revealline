# Pressure corridor triptych: bounded complete-route source evidence

Date: 29 September 2026. Source: unchanged v37 Pressure ladder and Switchback
exchange, plus the separately versioned Cooling loop v38 correction.

This extends the earlier **first-return-only** evidence; it does not rewrite
that historical observation or claim production testing. The user has deferred
production qualification while source implementation continues.

## What is newly established

| Mission / edition                    | Complete legal route                                                                                                           | Active mechanic evidence                                                                                         | Important limit                                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Pressure ladder / v37                | Standard, immediate, seed 1; 4,531 ticks, about 37.75 seconds; 1,790/2,206 claimed; eight closures; zero losses and no pickups | Interceptor warnings and a committed route; two travelling impacts cancelled by captures                         | Lower foundation remains unlinked; optional mastery is not complete                                      |
| Switchback exchange / v37            | Standard, immediate, seed 1; 6,107 ticks, about 50.9 seconds; 90.9091% coverage; nine closures; zero losses and no pickups     | Both relay connectors open and their reclaimed return ground is used; roamer activates; travelling impacts occur | Gate-cell use is not full end-to-end shortcut traversal; impact-on-relay-closure mastery is not complete |
| Cooling loop / v38, northern route   | Standard, immediate, seed 1; 5,503 ticks, about 45.85 seconds; 1,708/2,098 claimed; 13 closures; zero losses and no pickups    | Six warned erosion events; both lethal banks neutralized; all foundations linked                                 | Neither useful repair necessity nor human fairness is proved                                             |
| Cooling loop / v38, bank-first route | Standard, immediate, seed 1; 8,189 ticks, about 68.24 seconds; 1,713/2,098 claimed; 15 closures; zero losses and no pickups    | Eight warned erosion events; western bank neutralized; all foundations linked                                    | Forty eastern-bank lethal cells remain; optional mastery incomplete                                      |

Every route starts from a fresh compiled/resolved mission, normal gameplay
tuning applied exactly once, and a fresh `scout` run. Commands are legal public
engine input. No enemy position, cell, health, objective or terminal status is
edited during a run. Neutral waits are recorded input, not pauses in the world.

The complete paths are executable regression fixtures:

- `game/test/pressure-corridor-complete-routes.test.mjs`: Pressure ladder and
  Switchback exchange; deterministic replay and actual equal Versus boards.
- `game/test/cooling-loop-erosion-routes.test.mjs`: Cooling loop's separate
  successor, historical comparison and protected-foundation checks.

Pressure ladder's replay checkpoint is `b4963c61fd2d4316`; Switchback exchange's
is `09638acfdde8cf90`; Cooling loop's northern and bank-first checkpoints are
`21a461387f53c722` and `b8aab03a29e67318`. Runtime wins are
distinct from optional mastery recognition, which is asserted separately where
relevant. No bonus is necessary in these demonstrated routes.

## Design interpretation, not automatic acceptance

Pressure ladder's 37.75-second route is below the ordinary 45–150-second target.
It exercises the signature threats, but is not automatically a defect or proof
that the mission is too easy. Do not inflate its quota solely to lengthen this
scripted skilled clear. Investigate whether ordinary players can recognize its
warning windows and whether a dominant low-risk approach bypasses the challenge.

Switchback exchange captures both relay objectives early. Its tested continuation
uses the opened return ground, but does not prove that each full connector is
necessary or that both objective orders make meaningfully different routes.
Opening a gate alone was not counted as using it. The alternative court-first
strategy and shortcut benefit remain review work.

Cooling loop's original horizontal eroder was inactive during two bounded v37
openings. The copy-on-write v38 placement correction and its failure history are
documented in `docs/cooling-loop-erosion-v38.md`; neither of the other two missions
is modified by these complete-route fixtures. All three original maps, media,
global tuning and the normal v25 default remain unchanged.

## Execution receipt

Final focused execution: **36/36 passed**, zero skipped, in 5.27 seconds across
the candidate, Cooling loop route and two-mission complete-route files. Targeted
JavaScript lint and formatting pass. Long suites remain waived, not passed;
no production session or full local build was performed for these fixtures.

```sh
node --test game/test/cooling-loop-erosion-candidates.test.mjs game/test/cooling-loop-erosion-routes.test.mjs game/test/pressure-corridor-complete-routes.test.mjs
```

## Remaining work

- Second complete strategic approach for Pressure ladder and Switchback exchange, with actual useful route
  differences rather than mirrored input.
- Full clears across additional deterministic seeds, Gentle/Expert and Grid +
  Buffer controls. The previous wider matrix still establishes first returns
  only.
- Optional mastery, repair decisions, useful relay order, quota-tail quality and
  human-readable warning overlap.
- Host-level input/continuation, production, physical-device, accessibility,
  frame-time and human-enjoyment qualification: **deferred, not passed**.

This closes a narrow missing source-feasibility item for the trio. It does not
close whole-Journey P13–P15, authorize default promotion, allocate a new release
or make any public-build claim. These checks belong in the same consolidated
source batch as the Cooling loop fix, not a separate publication.
