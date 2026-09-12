# Round 11 roster viability and balance evidence

All **252 supplied combinations** have a verified legal clear: twelve campaign maps plus six expansion maps, seven classes, both turning policies, seed 1. Every action-free clear retains all three lives and earns the current gold medal. No combination remains unresolved within this survey's budget. This establishes a usable fallback for every stock loadout; it does not establish human difficulty, long-term enjoyment, or device performance.

The complete result is [balance-matrix.json](verification/round-11/balance-matrix.json). It contains content and source SHA-256 hashes, exact input sequences, summaries, event counts, challenge margins, and portable replay checkpoints for every attempted run. The [survey script](verification/round-11/run-balance-survey.mjs) is the reproducible command source.

## Reproduce

From the repository root on Node 20.19 or newer:

```sh
node docs/verification/round-11/run-balance-survey.mjs --check
node --test game/test/core-roster-viability.test.mjs
npm test
```

`--check` regenerates the survey in memory and compares every result and source hash with the recorded JSON; it does not rewrite evidence. After deliberately reviewing a changed core or changed content, regenerate with:

```sh
node docs/verification/round-11/run-balance-survey.mjs
```

The recorded run used Node 20.19.5. The focused suite passed **7/7** tests; the full suite passed **378/378** at the time of this review. Counts can grow as other release work lands. The report's source hashes, rather than these historical counts, determine whether its gameplay evidence still matches the current implementation.

## Method and result

The survey uses the reviewed [campaign routes](../game/replays/campaign-routes.json) and [expansion routes](../game/replays/expansion-routes.json), originally discovered by the existing greedy safe-path/straight-cut solver. Each case has two independently initialized attempts:

1. Replay the authored directions, boost and action presses with the actual selected class.
2. Replay the same directions, durations and boost with action omitted. Pickup and class switching are never used.

Only `createRun` and legal fixed-tick `stepRun` commands affect a run. Cells, actors, lives, class recipes and rules are never edited. The recorder stores each actual command; `verifyReplay` then reconstructs the whole attempt and compares all authoritative checkpoint sections. Source objects and the authored proofs are checked for mutation. Each attempt is bounded by 20,000 input ticks and the supplied route's end; there is no unbounded search.

| Measure | Recorded result |
|---|---:|
| Map / class / turn / seed combinations | 252 |
| Authored-action clears | 216 |
| Action-free clears | 252 |
| Unresolved combinations | 0 |
| Attempts independently replay-verified | 504 |
| Input ticks across attempted runs | 520,128 |
| Additional ticks during independent replay | 520,128 |
| Lives lost in action-free clears | 0 |
| Action-free clear time range | 5.10–16.37 seconds |
| Action-free captured coverage range | 65.22–94.12% |

All 36 authored-action failures are **impact** attempts that remain running when the old input sequence ends. An interceptor's shield press is not an equivalent command for the impact craft: a pulse intentionally abandons the cut and redeploys the craft, changing subsequent timing. Omitting that optional action produces a verified clear on every map. These incomplete sequences are reported as `route-exhausted`, not as lost games or evidence of an unwinnable class.

Seed 1 is deliberate. These authored maps provide explicit geometry, actor positions and velocities; this core stores the seed as run identity and does not randomize them. Repeating seeds 2 and 3 would change identity without adding distinct encounters. Procedurally generated and daily challenge content needs its own seed survey; it is outside this fixed eighteen-map result.

## Map results

Each row represents fourteen successful action-free runs: all seven classes in both turning policies. Within each row their clear time, coverage and number of cuts are identical. Times are simulated gameplay time, not wall-clock search duration or a player performance estimate.

| Map | Clear seconds | Coverage | Cuts |
|---|---:|---:|---:|
| First Signal | 6.83 | 94.12% | 1 |
| Relay Orchard | 6.30 | 73.53% | 1 |
| Crosswind | 14.23 | 80.43% | 3 |
| Stone Lanes | 12.90 | 87.99% | 2 |
| Night Patrol | 6.70 | 91.18% | 1 |
| Hidden Frequency | 6.10 | 73.91% | 2 |
| The Crossing | 5.10 | 79.28% | 2 |
| Last Light | 16.37 | 92.84% | 4 |
| Signal Garden | 10.90 | 65.22% | 2 |
| Supply Circuit | 6.43 | 79.41% | 1 |
| Short Fuse | 6.50 | 82.35% | 1 |
| Relay Storm | 5.10 | 79.28% | 2 |
| Midnight Channel — Night Shift | 6.30 | 73.53% | 1 |
| Voltage Garden — Night Shift | 14.23 | 80.43% | 3 |
| Afterglow Sentinel — Night Shift | 12.90 | 87.99% | 2 |
| Petals at Dawn — Living Threads | 6.70 | 91.18% | 1 |
| The Woven Path — Living Threads | 6.10 | 73.91% | 2 |
| Garden of Memory — Living Threads | 5.10 | 79.28% | 2 |

The game ends on its configured coverage and required objectives. The reward presentation may reveal the full image afterward; that presentation does not change the captured coverage recorded above.

## Fairness and timing review

The stock maps allow an ordinary capture route with zero ammunition, no class change and no active ability. A player who selects a different craft can still make progress; the campaign does not require a particular ability to avoid a soft lock. This is a useful baseline to preserve while designing optional specialty challenges.

The new [roster regressions](../game/test/core-roster-viability.test.mjs) also verify that an impact craft can abandon a live cut, recover, and complete the **same attempt** before its pulse cooldown ends. That test uses only legal movement/action input and respects a mission timer, a cut timer and a cable limit. Another test confirms that stopping on an exposed cut does not stop its timer; neither a shield nor fiber resistance bypasses a cut deadline.

Both turn modes remain distinct. The broad winning routes turn at centers and therefore cannot demonstrate the difference alone. A separate regression sends an off-center turn request to every class: immediate steering turns at the current position; grid steering continues toward the next center. Both states survive portable replay verification. Existing [movement](../game/test/core-movement.test.mjs) and [systems](../game/test/core-systems.test.mjs) tests cover release/stop, frame-rate independence, walls, signal effects, cable contact, emitter suppression, hangar switching and exact mission-deadline ordering.

The reviewed core resolves a challenge violation on the collision timeline before a tied closure can claim victory. Mission clocks also run during recovery; only the shell's decision not to step is a pause. Cut time and cable length are independent constraints. A visible signal region can slow a craft enough that a previously suitable route exceeds a cut deadline; fiber removes the signal effect, not those deadlines or live-trail contact.

On the recorded **Short Fuse** clear, the longest completed cut is 3.07 seconds against a 6-second limit, the sampled live trail reaches 46 cells against a 50-cell cap, and 63.5 mission seconds remain. **Relay Storm** has a 2.27-second longest cut against 8 seconds, 34 sampled trail cells against 60, and 89.9 mission seconds remain. Completed-cut durations use the core's exact start/closure event times. Trail peaks are sampled after fixed ticks and are labeled as observations rather than a continuous-time maximum.

No core bug or gameplay-rule change was needed for this survey. The original campaign and expansion proof files remain valid.

## Variety assessment and bounded design criteria

The strongest limitation is visible in the evidence: **none of the 252 winning routes enters a signal region**. None collects a supply, activates an ability or changes craft. The stock class choices consequently produce identical outcomes on these paths. The roles are implemented and directly tested, but this set of fast clears does not demonstrate a reason to master them.

The six expansion maps reuse the corresponding baseline movement routes; Relay Storm also shares The Crossing's route. There are eleven distinct action-free input sequences across the eighteen maps. The new themes and constraints provide presentation and setup variety, but this result should not be described as eighteen mechanically distinct encounter families.

Every optimized fallback earns gold, and several later maps finish faster than earlier ones. The generous base campaign is accessible, while its current time medals and hazards do not establish a sustained difficulty curve for a practiced player. Automatic route search has full board knowledge, so these numbers must not be treated as beginner clear times. Conversely, calling the campaign challenging or highly replayable solely because the solver clears it would be unsupported.

The next bounded content review should preserve these accessible clears and establish three additional measurable encounters in separate, revisioned challenge data:

| Encounter | Required evidence before calling the role useful |
|---|---|
| Signal crossing | A playable required route actually intersects interference; ordinary and fiber craft both clear, with a measured speed or input difference. Safe detours remain an intentional choice. |
| Supply / emitter challenge | A carrier pickup and field visibly suppress an emitter; compare a legal supply-assisted clear with the ordinary fallback. Avoid mandatory ammunition without an accessible refill. |
| Recovery / pressure challenge | A pulse or shield demonstrably rescues a threatened cut, while a skilled no-ability route still clears; verify the later recut, remaining mission time and preserved cooldowns. |

Each such encounter should have a reviewed replay in both turning modes, a demonstrated failure-and-recovery path, and a short hands-on keyboard/touch/controller playtest. Calibrate medal times from those human runs and retain clear warning windows. This is an acceptance checklist for a finite balance pass, not a claim that new encounter content has already been authored or that automated verification can certify enjoyment.
