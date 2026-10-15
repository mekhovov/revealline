# Native review parity and local crowd spacing

15 October 2026. This follow-up isolates a real crowd-steering discontinuity and
adds an explicitly authored experimental correction. It does **not** qualify
Echo balance, cross-engine deterministic replay, target-laptop performance or
the complete release plan.

## What changed

- Optional, bounded review input traces capture the real pilot boundary, earned
  progression, player/squad state and a quantized enemy digest. A targeted pair
  of detailed actor snapshots can be requested. Ordinary play does not record trace
  history. Trace-enabled runs explicitly fail performance-trial validity.
- A diagnostics-only **Download measurements** button on Results exports fresh
  terminal measurements, even when an older Inspector snapshot was previously
  opened. Both Survival/Riy and Raid use the shared implementation.
- Survival V4 and Riy projects can explicitly author
  `combat.crowdSeparation: "local-v1"`. The shared Studio exposes **Crowd movement →
  Local spacing · experimental**. Native review accepts `reviewCrowd=local` only
  with a recognized review build, and excludes Raid. The manual-sortie link strips
  the review override. Existing definitions keep the original movement.
- Local spacing reads a frozen spatial snapshot across neighboring cells, weights
  repulsion by actual body distance and clamps its total steering contribution
  to 0.65. It reuses scratch storage. Coincident bodies separate deterministically.
  Damage queries retain every candidate. Seed/difficulty retries preserve the
  authored rule. Gameplay identity changes; visual identity does not.

No damage, health, speed, upgrades, rewards or spawn budgets were changed. The
late-threshold proposal in the parent PR remains data only.

## Investigation and evidence boundaries

The exact project is Riy / Receiver Gardens / seed 202604 / Standard / three
balanced Scout airframes, Echo / Trail Sweeper / Burst Breaker / Shield, with
ordinary `lure-and-return` pilot input and earned cards visible for 1.5 seconds.
Original project identity: `bdafec1ca5d66423`.

The parent evidence contains a native loss at 5:19 and a headless win at 8:20.67.
The new bounded traces locate where the paths begin to differ:

| Observation | Result |
| --- | --- |
| First exact scalar difference | Tick 294, 4.9 s: heading differs by about 1e-16 |
| Through 140.5 s | Input, choices, counters, RNG and squad/player state match within documented tolerance |
| First quantized actor-digest difference | Tick 14430, 240.5 s |
| First different pilot decision | Tick 16332, 272.2 s |
| Actor detail at 272.1/272.2 s | 743/747 actors; 342/344 have differences, many with fractional position differences but 46–60 units/s steering-velocity differences |
| Node 20, 22 and 24 | All reproduce the headless win at 500.6667 s; receipts retain actual versions |
| Own-coordinate counterfactual | Perturbing the headless player's Y by ±4.547e-13 at the decision does not change its chosen input |

The actor snapshots show enemies straddling 64-unit spatial-cell boundaries,
particularly Y=960. Existing separation uses only the source cell centroid:
crossing a cell boundary can reverse repulsion despite virtually unchanged local
geometry. This can collect crowds along artificial grid lines. The new unit
regression checks continuous force across that boundary and after translation.

This is evidence of an actual movement defect and an amplification mechanism,
not proof that one specific floating-point operation explains every later native
outcome. The counterfactual archive retains the rejected simpler hypothesis; it
is deliberately perturbed diagnostic state, **not** a legal gameplay trial.

## Candidate checks

Runtime `2b8ab74d0` adds the authored movement candidate. Headless project identity:
`cb0d163cafd3ce11`.

| Check | Result / limit |
| --- | --- |
| Core, host, coordinated movement and Riy project cohort | **91/91** passed; includes long reference/stress fixture regressions using unchanged legacy rules |
| Final local-spacing unit/runtime/editor/retry checks | **7/7** passed (including Raid exclusion) |
| Riy, squad/cover, variety, worlds and offline navigation/control cohort | **69/69** passed |
| Lint / whitespace | Passed for changed modules and portable probes |
| Full active headless candidate | **Loss 323.0833 s**, nine choices, 1,857 kills; source graph stable. No balance pass claimed |
| Earned no-input branch | **Losses at 140.9667 / 197.3167 / 252.4500 s** after legal active prefixes through 120 / 180 / 240 s. No inputs after the checkpoint, including replacements; earned drafts continue resolving. Three sampled branches, not the full exploit matrix |
| Native candidate | Run/capture recorded below after completion |

`crowd-before.tap` retains the initial missing-export failure. Test receipts are
separate runs with overlapping coverage; their counts must not be added as if
all cases were unique. The original trace-only cohort is retained separately.

### CPU-only capacity observation

`spacing-cost.mjs` measures grid rebuild + all local steering, 30 warm-up
iterations then 120 measured iterations, Node 20 / arm64 / the available M4 Pro.
It includes concurrent workstation load. Distributed and deliberately packed
4-unit lattices are synthetic scenarios, not actual full-content frame trials.

| Actors | Distribution | Mean | p95 | p99 |
| --- | --- | ---: | ---: | ---: |
| 1,500 | Distributed | 0.10 ms | 0.18 ms | 0.24 ms |
| 1,500 | Packed | 3.01 ms | 3.80 ms | 4.02 ms |
| 2,500 | Distributed | 0.23 ms | 0.48 ms | 0.55 ms |
| 2,500 | Packed | 6.57 ms | 10.24 ms | 11.58 ms |

The packed result is a material cost. It is one reason this remains opt-in. These
numbers exclude the rest of simulation, rendering and sound. They cannot establish
60 FPS or an Iris Xe pass. Added frozen coordinate arrays cost 40,000 bytes at
2,500 actors; no new asset/atlas/offline resource is introduced.

## Review / reproduce

Native candidate:

`/game/overflight/play.html?operation=riy&layout=relay-ruins-receiver-gardens&reviewBuild=echo&reviewRoute=lure-and-return&reviewCrowd=local&seed=202604&autoplay=1&diagnostics=1&lang=en`

For input tracing add `reviewTrace=1`; for two actor-detail samples add
`reviewTraceAt=16326`. These traces intentionally invalidate timing trials.
Open Diagnostics → Download measurements during play, or the equivalent button
on Results. Start/Resume remain manual. The ordinary manual-sortie link removes
review automation and the crowd override.

Portable probes require a **fresh** output filename:

```
node docs/qualification/overflight/review-parity-20261015/headless.mjs --local-crowd --output=<new-file>.json.gz
node docs/qualification/overflight/review-parity-20261015/headless.mjs --local-crowd --park-at=180 --output=<new-file>.json.gz
node docs/qualification/overflight/review-parity-20261015/spacing-cost.mjs --output=<new-file>.json
```

`compare-traces.mjs` and `compare-details.mjs` operate on retained receipts.
Historical probes contain their original source hashes, not the current tool
text. Existing successful/failing runs and prior evidence have not been replaced.

## Remaining, in priority order

1. **P1: qualify movement and build viability.** Compare the local-spacing option
   on several actual dense scenes and earned active/unattended branches. Optimize
   only demonstrated cost; do not promote before complete frame trials. Recheck
   Echo routes and boss approaches separately. This candidate alone did not make
   the automated Echo route viable.
2. **P1: later progression.** Compare the parent's threshold hypothesis after
   movement rules are accepted. Preserve early evolution; do not combine tuning
   variables to hide the cause of a result.
3. **P1: native readability and audible mix.** Complete build/map comparisons,
   normal/reduced effects and a boss sound sample with actual listening review.
4. **P1/P2: medals, refits and broader presentation.** Keep Time Attack medals
   provisional; review Marathon compositions/replacements, monitor the isolated
   imported-library observation and extend only accepted presentation elsewhere.

The target Windows/Iris Xe, M1 Safari, physical input-device and five-player
trials remain **skipped, not passed**, as previously waived. Enjoyment remains a
player-review judgment. This continuation does not close the full delivery plan.
