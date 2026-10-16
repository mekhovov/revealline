# Fixed route and squad-command comparisons

14 October 2026. Six approved reruns completed in 89.89 wall seconds. All use the unchanged simulation dependency closure of `ed46c2b72e1735940acd70337f4ca5826506b1cc`; the working HEAD was `4dab801d9ce03b42227e99388b066c378c81ca02` throughout. All 33 runtime hashes stayed stable. No gameplay parameters, seeds, starting equipment or draft preferences were changed, and no search for successful configurations was performed.

The retained [raw evidence](pilot-bias-final.json.gz), [summary](pilot-bias-summary.json), [exact plan/provenance](pilot-bias-plan.json), [fixed configuration](pilot-bias-config.json) and [runner](pilot-bias-probe.mjs) preserve every result. Decompressed raw SHA-256: `e5cd561429f8810ecf29d8af3991a0cf71a9fda95c88c75fca4b248f095148c2`.

Subsequent, separately authorized [default-airframe comparisons](SYSTEMS-AIRFRAMES.md) demonstrate both Systems configurations completing with three airframes. Their first-life timing and earned-choice prefix exactly reproduce the one-airframe losses below. This does not change the six results in this report.

## Outcomes

All six are Standard difficulty. Case numbers refer to the retained expanded matrix, not a new seed selection. In particular, case 4 uses **one** airframe and case 7 uses **three**.

| Original case | Mode, build and layout | Seed / airframes | Existing route / Focus policy | Original result | This result |
| --- | --- | --- | --- | --- | --- |
| 8 | Survivor Echo · Haul Switchbacks | 202604 / 3 | Figure-eight | Lost 317.28 s | Lost 346.43 s; 9 choices |
| 4 | Survivor Systems · Split Compound | 303907 / 1 | Tight | Lost 304.63 s | Lost 246.38 s; 9 choices |
| 7 | Riy Echo · Twin Docks | 303907 / 3 | Figure-eight / normal | Lost 311.10 s | **Won 407.52 s; 10 choices** |
| 3 | Riy Systems · Loading Loop | 101303 / 1 | Tight / normal | Lost 248.07 s | Lost 232.15 s; 9 choices |
| 7 | Riy Echo · Twin Docks | 303907 / 3 | Figure-eight / elite/final only | Lost 311.10 s | Lost 403.60 s; 10 choices |
| 3 | Riy Systems · Loading Loop | 101303 / 1 | Tight / elite/final only | Lost 248.07 s | Lost 223.20 s; 9 choices |

This demonstrates **one current-source Riy Echo completion using earned equipment**. It does not establish Survivor Echo or Systems completion, nor a representative human success rate. The original matrix's ten active losses remain retained; a later success does not erase them. The other current-source active completions remain Survivor Fan and Riy Fan from the expanded matrix.

## What changed in the diagnostic controls

The original expanded matrix passed `fan`, `echo` or `systems` to `pilot(run, route)`. Those names controlled the separately called card selector, but all selected the same fallback route in the movement pilot. These reruns pass its actual existing `figure-eight` and `tight` route names while still passing the original build name to card selection.

These remain local reactive pilots, not prescribed full-run techniques. Nearby salvage overrides the fallback goal; after the final tank arrives its approach goal also overrides that fallback. The names do not guarantee a geometric figure-eight or an intentional return along every released Echo trail. See [`review-pilot.mjs`](../../../../game/overflight/review-pilot.mjs), especially `directionalPilot` and `QUALIFICATION_BUILDS`.

The two Focus comparisons only suppress an otherwise requested command when the current eligible target is neither elite nor final. They do not select an alternative target, extend command range, reset cooldowns or change escort damage. Normal Focus remains the public wrapper's current behavior in [`riy-mode.mjs`](../../../../game/overflight/riy-mode.mjs).

## Armor, target access and damage

The added one-second snapshots retain all active elite/final targets, plus at most twelve other relevant armored/support/marked targets. They include health, armor, distance, line of sight, direct-path clearance, exposure, pending payload geometry and squad state. All near-target samples of the observed elite/final targets had clear player-to-target line of sight. None of their sampled overlapping payload footprints was blocked by cover. These are sampled observations, not proof about every intervening tick or about safe routes through enemies.

- **Survivor Echo damages armor correctly.** Its final tank retained 641.97 of 1,500 armor at defeat, down from full armor, with two plates left and all 3,500 hull intact. The pilot was within 300 units in 21 of 48 final-target samples; only four samples had a pending payload overlapping the current body with clear line of sight. This is evidence of limited effective approaches before death, not armor immunity. The elite was defeated normally.
- **Riy Echo normal Focus breaks all armor and completes.** The priority-only variant also breaks all armor and reduces final hull to 1,170.88, but loses. Restricting commands to heavy objectives is not a universal improvement: normal made 59 commands, priority-only 13. The results do not support weakening Focus or forcing priority-only behavior.
- **Riy Systems normal Focus largely abandons its elite.** The elite is within 300 units for only two of 114 samples, loses some armor (216 → 112.2), and is about 1,903 units from the player at defeat. The priority-only comparison defeats its elite by approximately 152 seconds but still loses to crowd contact at 223.2 seconds. Removing the elite therefore does not alone establish this build's survival viability.
- **Survivor Systems defeats its elite.** It dies before the final tank arrives. Its unchanged draft preference deliberately prioritizes Pulse, Side Burst and Scanner over primary evolution; it finishes with primary rank 2, Pulse 3, Side Burst 3 and Scanner 2. Missing evolution is not an illegal-offer bug.

All hull damage in these six runs is contact damage. The warning-avoiding automated pilot biases this distribution; it cannot predict how often human players will take ranged damage. No deterministic damage, armor, terrain-access or reward-conservation defect was demonstrated by this diagnostic.

## Progression: a real pacing concern, not missing rewards

All six conserve earned salvage exactly: collected plus on-ground equals earned. First choices arrive at 16.28–21.55 seconds. Echo evolves at 71.53 seconds in Survivor and approximately 93–94 seconds in Riy; the enjoyable opening remains intact.

The longer late gaps deserve gameplay review even in the successful run:

- Survivor Echo waits **101.02 seconds** between choices eight and nine (188.15 → 289.17). The 1,750-salvage threshold has been earned by 246 seconds, approximately 43 seconds before collection reaches it. At 289 seconds it is only three salvage short, with 653 on the ground and 652 having a clear direct path. It ends with 1,710 uncollected salvage, while 183 short of the tenth choice.
- The successful Riy Echo waits **114.97 seconds** for the same choice (196.95 → 311.92). The threshold is earned by 241 seconds, approximately 71 seconds before it is collected. At 311 seconds it is nine short, with 998 on the ground; only 386 have a clear direct path from the current position. Thus both generation pace and return/collection routes contribute.
- The Systems comparisons have smaller maximum gaps, **45.67–50.92 seconds**, and only 31–246 salvage remaining at defeat. They are not the same collection-backlog problem as Echo. Their contact deaths cannot be solved simply by increasing pickup radius.

“Clear direct path” accounts for terrain only, not crowd danger. The evidence supports reviewing later choice cadence and deliberate collection routes. It does not justify a blanket XP multiplier, reducing the opening pace, or declaring every uncollected reward safely accessible.

## Next decisions

1. **Gameplay review: Survivor Echo attack/return routes and late choice cadence.** Use the same fixed Haul Switchbacks seed and earned preference. Review whether a player can intentionally clear, turn and collect without abandoning the final tank. Preserve the 15–25-second first choice and early evolution.
2. **Gameplay review: Systems crowd survival and target priorities.** Use the same Split Compound/Loading Loop cases, showing hull damage causes and actual Side Burst/Breaker directions. Review the one-airframe challenge as such. Do not compare it to a three-airframe run without saying so.
3. **If further automation is useful, port only a documented tactic.** A latched Echo lure/return goal or explicit priority-target goal can reuse the current terrain-aware waypoint and actual-velocity safety scoring. Keep the same draft preferences and seeds. The older tactical policies are terrain-blind V3 diagnostics and must not be run unchanged or counted as current-source viability evidence. A different priority loadout is a separate comparison, not a passing replacement for Systems.

No additional reruns or tuning are authorized by this report. The six requested comparisons are complete, and the CPU worker has exited. Enjoyment, readability and acceptable human difficulty still require native gameplay judgment.
