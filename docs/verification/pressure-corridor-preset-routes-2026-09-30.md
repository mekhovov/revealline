# Pressure corridor: bounded preset-route authoring

## Scope, source and delivery

This successor PR prepares regression coverage for four complete routes observed
through bounded, in-memory authoring probes. Its source base is main
`5e23fa8a62accf7a719cca5dd45c0702b52d37a5` on
`codex/levels-preset-routes-20260930`, in the existing v0.150.0 release intake.
PR820 is already merged as `00f4fc7750` and PR829 as `b77fe6a9d2`; source
integration is distinct from frozen-build or public acceptance.

Each probe compiled `createCoolingLoopErosionCandidates({ artwork: true })`,
resolved the mission with its actual difficulty and Solo mode, applied current
`gameplay-pressure.v4` tuning exactly once, and created a fresh seed-1 scout run.
Inputs were ordinary direction/null commands at the fixed timestep. No actor,
cell, runtime state, quota, speed or map was edited to obtain a clear. None used
boost, an ability or a collected bonus.

Only a new fixture, regression assertions and these documentation updates are
prepared. Existing recipes/goldens, geometry, runtime rules, asset pins and
defaults stay unchanged. The default Solo/Versus edition remains v25; these are
v38 candidate observations, not permission to promote that candidate by default.

The exact commands and recorded values are in
`game/test/fixtures/pressure-corridor-preset-routes.json`; the authored, unrun
regressions are in `game/test/pressure-corridor-preset-routes.test.mjs`.

## Observed full clears

| Mission             | Preset / steering / seed | Fresh Solo result                                      | Checkpoint         | Relevant observed behavior                                                                                                 |
| ------------------- | ------------------------ | ------------------------------------------------------ | ------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Cooling loop        | Gentle / immediate / 1   | Tick 6223; 1710/2098 cells; about 51.85 s; 13 closures | `6760a20607e82748` | Four warned erosions; both lethal banks neutralized; protected landings connected; one eroder impact cancelled by capture. |
| Switchback exchange | Gentle / immediate / 1   | Tick 8810; 1680/2002 cells; 73.412 s; 11 closures      | `e6d0976c2d000bb0` | Both relays and useful connector ground; lane warnings, roamer activation and an impact cancelled during a long cut.       |
| Pressure ladder     | Gentle / Grid / 1        | Tick 5999; 1766/2206 cells; about 49.98 s; 9 closures  | `9dfa627d451b6115` | Warned interception commitment and frontier impact; three slow-field cells remain at the ordinary clear.                   |
| Pressure ladder     | Expert / Grid / 1        | Tick 7482; 1773/2206 cells; about 62.34 s; 9 closures  | `2e0d729652f8c2e2` | Three interception commitments; an authored 1740-tick opening wait; 32 slow-field cells remain at the ordinary clear.      |

All four observations finish with zero lost lives and no collected pickups.
Gentle retains five lives; Expert retains two. These outcomes establish legal
ordinary completion for these exact cases, not universal recipe portability,
optional mastery, efficient routes or player enjoyment.

### Cooling loop: earned return pressure

The Gentle receipt records four eroded indices, `1889`, `1961`, `1377` and `1962`.
Each has the existing 60-tick warning before removal; 388 original foundation
cells remain protected. The eroder seeds a travelling impact at tick 4406, and
the closure at tick 4422 cancels it. Both lethal banks are neutralized and the
foundation-connectivity predicate is true at completion. The denominator stays
2098: erosion is not disguised as score or quota inflation.

This is evidence that earned cells are contested while permanent foundations
survive. It does not establish that repairing every eroded cell is necessary or
fun, or that the player consciously chose the intended repair/escape strategy.
The bounded Expert Cooling pass established no full clear. Its latest partial
alternate remained running at tick 2850 with 230 claimed cells and no loss;
neither a safe partial route nor a first return closes this gap.

### Switchback: use the gates and respect the lane windows

The Gentle source identity is `341765e064d7275b`; its once-tuned level identity is
`33b638a305dc7f85`. The observed roster contains three actors:

- A lane emitter at `(60.5, 29.5)`, with a 1.5-second warning, 0.7-second active
  phase, lane width 1.2 and effective period `6.158333333333333` seconds.
- The carrier at `(12.5, 9.5)`, initially moving left at
  `8.287500000000001` cells/second under `field-course.v2`.
- A reclaimed-ground roamer at `(47.5, 25.5)`, initially moving left at
  `1.92` cells/second.

The recipe extends the existing west-first full-route recipe. Before its
zero-based original segment 13 (`down`, 217), insert a 300-tick null-input wait.
Before original segment 32 (`up`, 211), insert a 90-tick wait. Then append:

```json
[
  ["up", 285],
  ["left", 640],
  ["down", 475],
  ["right", 730],
  ["up", 183]
]
```

The upper relay opens the west connector at tick 143; the east relay opens the
east connector at tick 266. Actual non-cutting occupation occurs on the east
connector at ticks 894–934 and on the west connector at 1070–1410 and 4713–4979.
Those west episodes include the inserted waits. A fresh cut launches from the
opened west connector at tick 4980. This is useful return/launch ground, **not
an end-to-end connector crossing claim**. Both opened connectors preserve their
42 permanent cells; initial foundations and the 2002-cell denominator remain
intact throughout the observed run.

Twelve lane warnings occur. The roamer warns at tick 2252 and activates at 2372.
The emitter seeds one impact at tick 7811; its departure-bound front expires and
the closure at tick 7891 cancels the remaining craft-bound front. No erosion
occurs in this mission.

The observed closure tuples `[tick, captured cells]` are:

```json
[
  [143, 7],
  [266, 9],
  [879, 114],
  [1750, 108],
  [2252, 188],
  [4030, 14],
  [4566, 70],
  [5184, 167],
  [6497, 579],
  [7891, 320],
  [8810, 104]
]
```

The original west-first timings lose a life at tick 1181. Keeping the new
300-tick wait but omitting the 90-tick wait loses at tick 4890. Those bounded
counterexamples show relevant lane timing; they do not prove that the chosen
waits are uniquely necessary. Two tested alternatives with an additional
480-tick tail wait also complete, so the shorter successful recipe was retained.

Both objectives are finished early, after only 16 captured cells. Meaningful
later gate use is observed, but the remaining coverage work needs pacing review.
This 73-second skilled recipe is neither a minimum-time result nor evidence that
all its safe travel is enjoyable.

Expert has four actual actors, including an additional keeper at `(69.5, 2.5)`.
Its keepers move at 13.26 cells/second, its roamer at 5.6, and its lane period is
`3.4333333333333336` seconds. Copied east/west recipes lose at ticks 807/1275;
bounded modifications reached tick 4148 with 426 cells before another emitter
impact. No Expert Switchback full-clear receipt was established. These failures
do not demonstrate an impossible level or authorize weakening its map or rules.

### Pressure ladder: distinct ordinary-clear conditions

Gentle Grid records an interception commitment at tick 283, followed by a
frontier impact at 358 that capture cancels at 360. Expert Grid records
commitments at ticks 2011, 5650 and 7239. Both use their actual preset-prepared
actors and finish without losing lives or collecting bonuses.

The remaining slow-field counts—three on Gentle and 32 on Expert—are preserved
as observed. Neither ordinary clear is relabelled as full terrain neutralization
or an optional mastery award. Expert's opening wait is 1740 ticks, or 14.5
seconds; it is a feasible timing choice, not a pacing recommendation or proof
that a shorter opening cannot work.

## Evidence status and explicit waiver

The [temporary focused-suite waiver](../focused-test-waiver-20260930.md) applies.
Automated suites are **WAIVED_SKIPPED_NOT_PASSED**, including the new authored
regression file and its replay and actual equal-board Versus assertions. Those
assertions describe coverage to execute after the waiver; their presence in
source is not a pass. A bounded Pressure authoring probe observed replay
agreement, which must not be extrapolated to the entire cohort or actual Versus.

The fresh Solo authoring observations above are separate, limited evidence. No
test runner, production build, public launch, physical controller, touch device
or human play session was performed for these receipts. The earlier Standard
cohort's passed checks remain historical receipts, not a rerun on this branch.
Mandatory source identity, validation, build/provenance, immutable integrity and
basic public startup checks remain release-owner responsibilities.

Local source gates for this batch pass: Node syntax, changed-file ESLint,
Prettier and whitespace checks. The content CLI validates 2503 files, literal
references and the pinned content snapshot, with five existing cross-site
navigation warnings. It validates 12 base levels, four themes, seven classes,
12 packs/35 pack levels/six goals and one Team pack/two levels. Presentation
metadata remains revision 104 and passes its validator. No dependency install,
heavy local build or archive copy was needed.

Independent static review found no blocking issue in the new fixture/harness:
input budgets match terminal ticks, closure totals account for erosion, actual
rosters are pinned, and the assertions use the existing preparation, recorder
and duel APIs. This is source review, not independent execution of the receipts.
Hosted build/provenance and eventual artifact qualification remain pending.

The coordinator's fresh GitHub metadata check still lists v0.142.3, published
29 September at 01:34:19 UTC. Metadata is not public-play verification; this
document neither renews acceptance of that release nor claims v0.150.0 is live.

## Remaining work

1. Review and submit this successor PR with its explicit waiver status, preserving
   the exact observations and old goldens through the existing publisher's train.
2. Complete bounded Expert Cooling/Switchback authoring or report unresolved
   cases. Do not treat a first return or safe unfinished route as a full clear.
3. Fill missing full-route steering/seed combinations, especially Standard Grid
   for Cooling/Switchback and opposite controls on Gentle/Expert. Current wider
   first-return matrices cannot close those gaps.
4. Review early objective completion, low-risk travel, coverage cleanup, current
   mastery implementation and useful erosion repair/escape choices before any
   default promotion. No quota or blanket speed increase is proposed here.
5. Continue distinct Ukrainian spatial and complementary Team batches, then
   original P13–P15 pacing, accessibility/performance and human/device acceptance.

These four observations do not complete the original whole-Journey plan or its
human acceptance gates. Published candidates remain **balance review pending**.
