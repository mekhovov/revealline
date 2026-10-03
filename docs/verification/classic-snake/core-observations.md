# Classic Snake core observations

The new `classic-snake-core.v1` is independent of the territory-capture cores.
These receipts bind the source SHA-256 recorded in their JSON files. They are
direct production model observations; automated suites were not run under the
publishing test waiver. The focused regression file is present but unrun.

## Author-level playthrough

The authored `classic-snake-open-loop`, seed 17, completed after 93 automatic
steps / 18,600 milliseconds of its accepted clock. Eight humanoids appeared
sequentially; each contact added one cell and 100 points. The visible body grew
from four cells to twelve, and the run won with 800 points.

Steering used a shortest-path search toward the visible stationary target,
avoiding the current body except its vacating tail. It sent ordinary turn-queue
inputs and never changed live map, body, target, random, score or objective state.
The complete replay reconstructed the identical canonical run.

See `authored-open-loop.json` and the core replay
`authored-open-loop.replay.json`. This is one directed model solution, not human
balance qualification of all 48 missions or a browser session export.

## Boundary observations

`core-boundaries.json` retains these focused observations:

- The four-cell initial body is visible immediately. Reverse inputs are ignored,
  including reversal against the latest queued turn. Two pending turns are
  accepted; a third is rejected. A save with one pending turn restores exactly.
- A legal four-cell loop enters the old tail cell on the same step it vacates.
- Two Team heads swapping cells produce one failure per player, one shared
  result, and no catch reward. The complete state replays exactly.
- The final accepted input owns the 16,384-turn journal-limit result. A wrapped
  30,000-step run ends explicitly at its step limit. Both terminal states remain
  replayable; neither truncates its journal silently.
- A catch at step 11 accumulated 1,980 ms at the original 180 ms pace. The next
  step used the earned 170 ms pace, totaling 2,150 ms even though that move hit a
  wall. Replay retained this authoritative timing.

Focused independent source review found no remaining issue in simultaneous
Team collision ordering, tail vacancy, queue reversal, recipe/checkpoint
validation, resource-limit ownership or pre-catch clock accumulation. Scoped
syntax, ESLint, Prettier and diff checks passed.

## Integration contract and remaining scope

`createClassicSnake(level, {mode, seed})` owns an immutable validated recipe.
`queueClassicSnakeTurn` records accepted input edges;
`stepClassicSnake` advances one automatic cell step. `classicSnakeSummary`
exposes the next `stepMs` and accumulated `elapsedMs`. Pausing stops core steps;
it does not discard recorded pending turns. Versus uses two independent Solo
runs and schedules their accepted clocks separately.

`exportClassicSnakeReplay` and `restoreClassicSnakeReplay` support exact
save/replay state; supplying `{level}` on restore additionally pins the current
catalogue recipe. Serialized body or score fields never become authority.
`run.recentCatches` retains at most 24 presentation marks and is checkpointed.

Physical keyboard/gamepad/touch behavior, the page's fractional-time scheduler,
UI import/export ownership, pauses, all mission solutions, and Team campaign
completion require their own host or playthrough evidence. The separate
catalogue receipt establishes static admission and initial states only.
