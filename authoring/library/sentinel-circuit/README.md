# Sentinel Circuit · Tactical candidate

Three new 72 × 36 missions form one chapter: Listening Court, Switchyard Gates, and Open the Circuit. Each has distinct walls, spawn and route choices. The final mission uses the existing relay sentinel’s **two schedules**, shielded and exposed. Three missions do not mean three internal boss phases.

This is an isolated source candidate. It uses the existing seven craft recipes, procedural FPV picture and theme music. It adds no illustrated originals or soundtrack, changes no historical map or runtime rule, and is absent from all public catalogs and the ordinary build. Human balance, readable native presentation, controller/device checks and later content publication remain separate.

## Make an importable candidate

From this checkout:

```sh
node authoring/library/sentinel-circuit/build.mjs --out .cache/sentinel-circuit/candidate-1
node authoring/library/sentinel-circuit/verify.mjs
node --test game/test/sentinel-circuit.test.mjs
```

The producer validates every document before creating one new cache directory. It writes `sentinel-circuit.json` (a complete `xonix-pack.v5`) and one `xonix-playground.v5` scenario per mission. Existing directories, foreign paths and symlink ancestors are refused. Ordinary symlink refusal does not promise protection against a concurrent hostile rename. The verifier reads the retained [route proof](routes.json); `--record` can create that exact source proof only when it is absent, and never accepts an explicit candidate for recording.

The scenarios can be reviewed through the current Playground’s validated import and separate Play action. The pack is a source authoring artifact; producing it neither installs it nor changes the player’s selected campaign, progress, or saved flight.

## Mission briefings

| Mission          | Current mechanic and goal                                                                                                                                                                                                                                                  | Deliberate alternative and risk                                                                                                                                                                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Listening Court  | Scout’s **Scan provides information**: reveal the hidden relay and see direction hints. Capture that relay and 45%. Scan does not freeze the interceptor or award territory.                                                                                               | Choose the upper survey loop or the lower outer route. A learned route works without Scan. The central throat ends at a wall, which cannot reconnect a cut. The interceptor warns before committing.                                                      |
| Switchyard Gates | The **Light carrier provides temporary control**. Pick up the home charge, move Up about five cells, then place the field near the crossing patrol. It stuns within its radius for 2.5 seconds. Capture the eastern relay and 45%.                                         | The eastern outer route works without a charge. An empty action does nothing; placing a still-active field at home leaves the crossing outside its radius. This is no delivery or damage mechanic.                                                        |
| Open the Circuit | **Fiber resists signal interference, but its cable remains vulnerable.** Use the band route to capture the shield relay, then wait for the exposed opening and close at least twelve new field cells. The shielded warning is horizontal; the exposed warning is vertical. | A Scout can take the western and southern detour. It is not necessarily slower. An early or short closure keeps ordinary gains but does not release the core. Openings repeat. After a cable loss, reposition safely and wait for a complete new opening. |

The final boss retains the registered small-remainder isolation finish: at most twelve field cells, standing safely outside an active cut, during an opening. The new proof exercises cut release; existing Sentinel compatibility tests cover the retained isolation rule. No new weapon, radio parameter, enemy schedule primitive or real-world tactic is introduced.

## Actual route evidence

The [verifier](verify.mjs) constructs the real Standard and Gentle execution contexts from the compiled campaign, then drives `createRun` / `stepRun` with cardinal, stop, pickup and action commands. It never changes a player position, board cell, enemy, clock, objective or encounter state. Controllers wait on actual positions and visible encounter phases under a finite 18,000-tick ceiling. Capture stops receive an ordinary stop and fresh direction command.

Each of fourteen routes runs under both difficulties and both immediate and grid-center turning: **56 contexts, 101,713 simulated ticks**. The retained outcomes are **32 wins, 16 controls stopped at the first real life loss, and 8 unfinished closure controls**. The latter two groups are not full-run losses or wins.

| Route family                                                                | Four-context result                                                                                                                       |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Scout upper survey with Scan; lower approach without Scan                   | Both routes win without losing a life. Upper survey records 480 hint ticks and an actual committed interceptor interval.                  |
| Carrier crossing with correctly placed field; outer route without equipment | Both routes win without losing a life. The placed field records 300 stunned-enemy ticks in Standard and 285 in Gentle.                    |
| Blocked central cut                                                         | One life lost. Standard records cut timeout; Gentle disables that limit and eventually records enemy-trail contact.                       |
| Empty carrier action; field placed too early at home                        | One life lost to enemy-trail contact. The misplaced field is still active, with zero stunned-enemy ticks; it is not described as expired. |
| Fiber through the band; Scout outside the band                              | Both win without losing a life. Fiber records resistance with no slowdown; the Scout detour avoids the band.                              |
| Scout takes the band route                                                  | Actual slowed movement and one boss-lane life loss; no false immunity or automatic timeout assumption.                                    |
| Undersized cut during opening; large enough cut before opening              | Ordinary points and one captured shield remain. Core stays exposed and undefeated.                                                        |
| Skip an opening; resume after one warned-lane cable loss                    | Both eventually win. Recovery retains the actual lost life and waits for a fresh complete opening.                                        |

Every context serializes a real unfinished cut as `xonix-session.v4`, with its exact execution/map revision, current continuation direction and `revealline-flight-pictures.v2` choice. The procedural picture is an exact authored legacy identity and the story choice is literal `null`. Saving leaves the original checkpoint unchanged. The proof checks the restored prefix, feeds the complete remaining commands, and requires identical final checkpoint and full replay. Saved files are roughly 6 KiB, within the existing 2 MiB session limit.

The proof is reproducibility evidence, not human balance approval. The slower blocked-route Gentle contact can differ between turning policies; each actual result is retained. New source tests reject altered source rules, omitted context coverage, fabricated outcomes/metrics/continuations, malformed explicit candidates, and unsafe output destinations.

## Preserved authoring observations

The isolated worktree’s `.cache/sentinel-three-stage/` retains initial probes, all four-context control results and the first recovery attempt. That initial Standard controller re-entered near the end of an existing opening and ended in warning without a win. Waiting for a complete new opening fixes the controller; the map and core were not relaxed. The first recorded pressure-duration counter mistakenly compared the phase to `commit`; the existing phase is `committed`. Its old proof and verifier are retained before correcting that metric. An initial test import named a nonexistent build module and was corrected to the existing CLI exporter, with the failed log preserved. A subsequent new test assumed all carrier contexts had 300 stunned ticks; the actual slower Gentle patrol enters the field later and records 285. Its original failure is retained and the expectation now distinguishes the two difficulties.

The fixed route proof, source tests and exporter do not establish native browser play, artwork delivery, public installation, offline availability, storage migration, or completion of a larger content phase.
