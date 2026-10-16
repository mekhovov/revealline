# Depot: current-rate, both-active-rover qualification

## Outcome and exact scope

The existing inner-lane **Depot dash** (`depot-dash`) can meet the documented
optional both-active-rover mastery route under current gameplay tuning. It can
also clear without collecting either timed bonus. No map, engine, actor, quota,
objective, artwork, order, default, version, or historical-edition change is
needed or included in this correction.

This is a bounded source-runtime qualification, not a public deployment, human
playtest, all-preset balance certificate, new mastery badge, or adoption of the
inner-lane edition into another campaign. It addresses Depot dash from
`createTeamDepotSpatialCandidates`, not the different core Team `twin-depots`
mission. The existing Team v5 edition is preserved; it is not silently upgraded
to Team v6 or its later trail-impact contract.

Base source: `b13089b702391c275f2505d1a76c87eebb9dcce0`. The committed fixture pins
source project identity `555fcc10d6000c10`, each compiled preset identity, and
each effective level plus tuning identity. Preparation uses the existing shared
`compileContentProject` → `resolveMission(..., { mode: 'team', difficulty })` →
`applyGameplayTuning(..., resolveGameplayTuning(difficulty))` path exactly once.
There are no admin overrides, hidden actors, altered pickup schedules, reduced
quotas, injected wins, or private simulation-state edits.

## What the new public-input logs establish

Both routes use Standard, seed 1, continuous Team steering, no boost/support,
and actual `createCoop` / `startCoop` / `stepCoop` execution. Neutral input is
permitted only after the simulation has already stopped that pilot; it never
serves as an artificial brake. Each route is replayed by fresh public-command
execution with an exact checkpoint comparison. This is **not** a claim that
Team implements the standalone Solo replay-export format.

| Route                 |            Clear time | Coverage | Returns by seat | Timed contacts   |
| --------------------- | --------------------: | -------: | --------------- | ---------------- |
| Optional mastery      | 2,034 ticks / 16.95 s |   86.29% | 3 / 4           | One speed pickup |
| Ordinary, pickup-free | 5,882 ticks / 49.02 s |   85.01% | 7 / 6           | None             |

The actual goal remains 78% coverage without stronghold/objective gates. Both
routes clear without knockdowns or reserve consumption. They are repeated with
both seat assignments and joint-cuts enabled/disabled: eight full-clear cases.
Seat-swapped proof swaps both initial seat ownership and corresponding commands;
it is not an assertion that unchanged input works from a different spawn.

For the mastery route:

- Speed contact occurs at tick 547 while the partner is cutting. Contact, not
  enclosure, collects the item; the existing effect begins at tick 548.
- West and east rovers become active at ticks 864 and 940 respectively.
- Subsequent cuts start at ticks 983, 1,283, and 1,747 and earn three later
  returns. Both rover bodies actually move while cuts remain live for at least
  120 observed ticks; this is not just a check of activation flags.
- The clear happens 1,094 ticks (9.12 s) after both are active, not on the
  activation frame. A truncated prefix that activates both but does not finish
  the subsequent challenge is explicitly rejected by the test-only rubric.
- There is a declared 123-tick joint-neutral interval after the two initial
  enclosures, plus short release intervals following real closures. The proof
  does not claim constant simultaneous movement or that waiting is enjoyable.

The test-only mastery rubric records the existing design intent: a no-loss
shared clear, a timed contact while the partner cuts, contributions from both
seats, and a new cut followed by a return after both rovers activate. It does not
add any requirement to ordinary completion. The pickup-free route retains all
items and their live schedules, rejecting collection rather than removing them.

## Preset opening coverage and limits

A short legal left/right opening earns one return per pilot with no knockdown,
pickup, or rover activation in 143 ticks. It passes all three presets, seeds 1
and 17, both seat assignments, and both joint-cut settings: **24 combinations**.
These are opening checks, not 24 full clears. Team has continuous steering; no
Solo Immediate / Grid + Buffer qualification is invented here.

Longer outward-bay routes were also sampled during investigation. The Standard
mastery prefix works, but the same timings hit a keeper on Gentle and Expert.
The ordinary outer-bay prefix needed an initial 120-tick wait on the sampled
Gentle run; sampled Expert waits from 0 through 360 ticks did not find a clean
outer-bay prefix. These failed timings are not proof of impossibility and are
not relabelled as passed. Full Gentle/Expert mastery and ordinary route evidence,
additional seeds, reaction margins, native controller/touch checks, and human
cooperation/pacing review remain open.

The successful Standard logs came from hand-authored outward-bay openings and
bounded, one-off public-input continuation searches. The mastery search used
90,591 of 180,000 simulation ticks. The pickup-free search exhausted its first
180,000-tick budget at 72.01% coverage; a separate continuation used 32,000 of
100,000 ticks to clear. The fixture preserves these budgets separately. The
committed deterministic commands, independently re-executed in the focused
tests, are the evidence; the search does not establish human route discovery,
optimality, difficulty, or absence of tedious alternative routes.

## Previous evidence is preserved, not silently upgraded

The historical authored-rate logs and their tests are unchanged. Reusing those
exact logs at current gp4 rates does not work: the old pickup-free Gentle log
hits the artificial-neutral-brake diagnostic at tick 199; Standard gets a
self-trail knockdown at tick 667; Expert gets an enemy-trail knockdown at tick 581. The old mastery log hits the neutral-brake diagnostic at tick 486 across
the three presets. The new fixture explicitly retains these observations.

The first new focused run passed 11 of 12 tests: the only failure expected an
optional absent `strongholds` field to be an empty array. Normalizing that
assertion to `strongholds ?? []` fixes the test's representation assumption; no
runtime or route changed. The route cases all passed on that first run.

## Verification and remaining release work

Focused command: `node --test game/test/team-depot-current-mastery.test.mjs`.
Final focused result: **12/12 pass, 0 failures or skips**, 12.57 seconds on Node
20.19.5. The preceding 11/12 result remains documented above.
Only this bounded cohort plus scoped ESLint 10.10.0, Prettier 3.6.2, syntax, and
diff checks are required for this evidence-only PR. No full suite, application
build, version bump, release, or Pages publication is performed by this lane.
The publisher must report any later source acceptance and public delivery
separately. This closes the sampled Standard achievability gap, not the entire
Team qualification phase.
