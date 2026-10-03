# Snake core observations

These are bounded observations through production APIs on the working tree, not
an automated suite or a claim that all authored missions have been playtested.
The JSON receipt records the baseline commit, relevant source SHA-256 values,
accepted recipes, input segments and observed state. Product hashes stayed
unchanged during the final receipt observation. Automated suites remain waived
by `publishing/test-policy.json`.

## Observed

- **An unchanged authored mission with real captures:** `snake-open-loop`, Solo,
  standard gameplay tuning, seed 7. At tick 1466, a single legal enclosure
  eliminated `target-2` and `target-3`. Hunt recorded two capture kills and 100
  Hunt points; Snake recorded each target once and grew capacity from 2 to 3 to 4. Two targets remained, so the mission continued. Three ordinary keeper
  trail hits eventually ended the 3352-tick attempt in a loss. Recovery cleared
  the body path while preserving its earned capacity and catches. The retained
  version-13 replay verified against the version-12 authoritative checkpoint.
- **The body is hazardous on safe territory:** a separate unchanged Open Loop
  attempt moved right for 90 ticks on the top rail, filling its two-cell body
  without starting a capture trail. Reversing left caused `snake-body` at tick
  98, lost one life, and reset the body path. This replay also verified exactly.
- **Team Continue preserves the body:** the authored Team Open Loop successor
  (`revealline-coop-level.v10`, core v12), standard tuning and seed 7, advanced
  90 ticks with the seats moving in opposite directions. Its existing Hunt save
  envelope replayed to the identical complete canonical run, including both
  two-cell bodies. The receipt retains the input recipe and checkpoint.
- Scoped ESLint, formatting and `git diff --check` passed for the core changes.
  Focused regression cases were authored but **not run** under the suite waiver.

## Reviewed but not demonstrated here

Source review found fatal body contacts resolved before capture/catch rewards;
Team applies this per seat. Once-only accepted Hunt elimination owns growth.
Capture growth precedes return shedding. Replay/checkpoint identity includes
both the Snake recipe and body state. The Snake boundary requires a positive
quota equal to the entire target population; optional order bonuses cannot
make completion impossible or point at already eliminated targets.

The initial session did **not** demonstrate a winning final capture. A subsequent
bounded attempt did, as recorded below. Exact-time body-fatal/catch ties, every
class/input device, all 48 mission solutions, and paired Versus results remain
outside these observations. The catalogue's compile/initial-state inventory is
structural validation, not human qualification.

## Subsequent authored win

The unchanged authored Open Loop **Gentle** edition, with its default Gentle
tuning, Scout and seed 17, completed at tick 5559 / 46.32368 seconds. Directions
were selected between bounded input segments by inspecting live production
positions; boost was held. No level or run state was changed. One keeper hit was
recovered normally; the player finished with four lives.

At the final instant, the core closed a 112-cell capture, counted `target-2`
once, grew body capacity from 5 to 6, recorded the target's capture elimination,
and then emitted the winning completion. All four targets were captured; Hunt
score was 200. The complete version-13 replay verified exactly. This is one real
authored solution and terminal transaction demonstration, not broad difficulty
or human qualification. The earlier JSON receipt remains a truthful snapshot of
its earlier, narrower session.

## Retained artifacts

- `core-observations.json`: compact checkpoints, events and source identities.
- `solo-open-loop-observed.replay.json`: the complete legal 3352-tick attempt.
- `solo-safe-body-observed.replay.json`: safe-territory body failure and replay.
- `winning-capture-observation.json`: accepted Gentle recipe, observed checkpoints
  and exact final capture/growth/win event sequence.
- `solo-open-loop-gentle-win.replay.json`: complete legal authored winning attempt.
