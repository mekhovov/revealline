# Active-loss audit and effective-speed correction

14 October 2026. This audit reads the retained corrected-pilot reports and production source. It does not run another long matrix or infer ordinary-player difficulty from automation.

## Confirmed correctness issue — corrected separately

Coordinated movement admitted a new leg using `enemy.speed`, while Survivor executed it with burst, support and slow multipliers, and Raid used its own sprinter/slow modifiers. The two velocities could disagree. A minimal warning-and-body fixture has a legal exit when an actor at `(1250,478)` approaches `(1250,540)` at 60 units/second, but no legal exit at its actual 120-unit/second burst speed. Admission at the base speed therefore did not establish safety for the executed leg.

Both native cores now pass their already-computed effective speed into the shared movement admission. Changes in that speed during a committed leg are checked immediately, including between the 10 Hz steering decisions. An unsafe change holds the actor and retries at a bounded frequency; the original movement resumes once safe. This changes warning fairness, not health, damage, reward budgets or configured speeds.

The regression uses actual Survivor simulation steps for both a new burst leg and a previously admitted leg that accelerates before its next steering decision. It verifies that the warned exit stays open and that the burst resumes after the warning ends. Thirteen movement tests pass. The complete focused suite result is retained in [effective-speed-tests.txt](effective-speed-tests.txt).

The earlier matrices, including Raid's 66 successful trials, predate this correction. Their original source hashes remain attached; they are not presented as final-source qualification. This bug is real, but the coarse retained traces do not establish that it caused any particular active loss.

## What the corrected active losses actually establish

The exact 23 previously failing configurations were rerun with terrain-aware steering and actual enemy-velocity prediction. Three now completed; twenty still lost. The twelve odd-index runs retain complete outcome summaries but lost their detailed report on a disk-full write. Consequently, detailed conclusions below use only the eleven even-index runs with preserved traces. Those eleven all lost; they are a selected failure sample, not a representative player win rate.

| Observation in the eleven detailed reruns | Interpretation and next review |
| --- | --- |
| 1,480 of 1,500 hull damage was contact; 20 was a fan attack. | Review escape routing, crowd overlap and replacement pressure first. This does not justify weakening ranged attacks or increasing friendly damage. The pilot deliberately avoids warned attacks, so its damage distribution is not a prediction for humans. |
| Eight runs earned all ten choices before losing. | Missing upgrades cannot explain most of these failures. Review build coverage and chosen routes before changing salvage quantities. |
| First choices arrived at 14.08–21.08 seconds. | Early progression is working in this sample. Do not delay it to extend runs. |
| The longest inter-choice gap per run ranged from 35.85 to 60.42 seconds. | Review later progression pacing independently. A long interval is a pacing candidate, not a correctness defect. Keep earned, collected and reachable salvage distinct. |
| Field/Riy/Echo retained 556 uncollected salvage; Ruins/Riy/Fan retained 1,357, of which 1,259 had a clear direct path at defeat. | These examples suggest collection/route decisions, not missing salvage. A clear direct path does not imply a safe path through enemies. Do not automatically enlarge pickup reach or add XP. |
| Two runs had not defeated the elite; five reached the final tank before defeat. | Compare priority-target approaches and late crowd pressure separately. A single global damage adjustment would mix different failure causes. |
| The two three-airframe detailed runs lost 140 and 200 hull in their final minute. | Review successive replacement pressure and retreat options. The five-second trace cadence cannot establish unsafe spawning or unavoidable damage; no replacement defect is proven here. |

The original Shunting Yard loss trace also matters: its longest wall hold lasted only 0.63 seconds and caused no damage; the run died while moving through open ground. The fixed review-pilot defects do not explain away all losses.

## Important limits of the active pilot

The pilot uses a local half-second movement comparison, a general central route and nearby salvage goals. It changes final-tank approach geometry for the current primary weapon, but it does not deliberately choose a broad sweeping route, a lure-and-return route or a support-removal route for the whole sortie. It does not deliberately seek useful repair/Overdrive caches. Riy's review wrapper sends Focus whenever a valid priority/armored/guarded target is available and the command is ready, rather than deciding whether losing rear coverage is safe.

These are instrument limitations, not production-control bugs. In particular, the three build labels currently control earned card preferences much more than whole-run tactics. The remaining active losses cannot rank the builds reliably. Human/native review should demonstrate the intended technique before additional automation is treated as evidence for balance changes.

## Recommended order

1. **P0: finish final-source correctness/performance/offline qualification.** The effective-speed correction is implemented and covered; repeat the relevant source-bound comparison after the final commit. Do not treat the older matrix as new-source proof.
2. **P1: review crowd-contact routes and Riy Focus decisions in native play.** Start with Standard and three airframes, then the one-airframe/Veteran challenge. Look for recoverable openings and distinct build techniques, not a target bot win percentage.
3. **P1: review late progression and priority-target pacing.** Investigate the 40–60-second draft gaps and the cases where the elite survived. Separate insufficient damage, poor positioning and uncollected salvage before changing one of them.
4. **P2: improve review automation only where it represents a documented tactic.** Optional cache goals and explicit build routes would improve diagnostics. They are not a prerequisite for normal play, and should not conceal genuine open-ground defeats.

No broad balance change was made in response to these losses. Enjoyment, visual readability and acceptable human difficulty remain gameplay-review judgments.
