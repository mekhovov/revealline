# Weapon and ammunition economy — limited source review

Reviewed 2026-10-20 while the final catalogue was running. The initial review read existing evidence and source without running tests or browser sessions. A subsequently authorized host-only guidance correction and focused verification are recorded below; runtime, geometry and ammunition rules remain unchanged.

**Conclusion:** no ammunition deadlock was verified in the reviewed rules. The preset-specific guidance defect identified below is fixed. This does not qualify every map/loadout/preset under combat pressure.

## Existing evidence and its limits

The [runtime TAP](overhaul-runtime-tests.tap) records passes for all 18 weapon-pair/preset cases, tests 106–123. The fixture at `game/test/fpv-encounter-v2.test.mjs:343–382` uses a stationary 50-health ordinary target followed by a stationary 100-health armored carrier, an invulnerable player, clear synthetic geometry and a supplied pad. Each pair's first weapon defeats the ordinary target; its second defeats the carrier. It does not test each individual weapon against both types, a complete roster, flight to a real pad, or return-fire pressure.

| Two equipped weapons | Balanced fixture | Arcade fixture | Tactical fixture | Tactical initial rounds, both slots |
| --- | --- | --- | --- | --- |
| Autocannon + Scatter | Passed, 106 | Passed, 112 | Passed, 118 | 90 / 18 |
| Autocannon + Precision | Passed, 107 | Passed, 113 | Passed, 119 | 90 / 15 |
| Autocannon + Rocket | Passed, 108 | Passed, 114 | Passed, 120 | 90 / 2 |
| Scatter + Precision | Passed, 109 | Passed, 115 | Passed, 121 | 18 / 15 |
| Scatter + Rocket | Passed, 110 | Passed, 116 | Passed, 122 | 18 / 2 |
| Precision + Rocket | Passed, 111 | Passed, 117 | Passed, 123 | 15 / 2 |

Round counts include the loaded magazine and reserve, not payloads. The ongoing catalogue's ten selections vary activity/population and backend, using default Autocannon + Scatter / Balanced (`scripts/qualify-fpv-combat-catalogue.mjs:75–82,295–317`). Its short accepted starts cannot be counted as an 18-combination economy sweep.

## Replenishment and defeat paths traced

All runtime references below are in `optional-practice/civilian-fpv/encounter-runtime.mjs`.

| Mechanism | Source and conclusion |
| --- | --- |
| Balanced | Lines 2233–2246, 2984–2986, 3112–3131: every pair contains a conventional weapon with unlimited reserve. Rocket starts with four rounds total; every three non-prop defeats can provide heavy/payload supply. Pad service also refills heavy/payload stock. Conventional reload remains available after reserve use. |
| Arcade | Lines 3184–3196: after Fire is released for one second, conventional magazines recharge after two additional seconds, rockets after four, payloads after ten. This replenishes both slots even with zero rocket reserve; it does not require another defeat or pad. Payload deployment restarts the release timer, lines 3271–3291. |
| Tactical | Lines 2233–2246, 3112–3131, 3172–3209: finite initial stock, one payload. Five-second service restores conventional total capacity to three magazines, rockets to two and payload to capacity. Service adds reserve; a loaded magazine can still require a reload. No kill or ammunition expenditure is needed to qualify for service. |
| Ordinary/armored damage | Lines 24–67, 2898–2957: all four weapons inflict positive damage. Front shields and brace protection have finite components that are damaged before protection blocks hull damage. Vehicle low-body core destruction can finish the target. There is no weapon-class immunity that makes a pair incapable of damage. Accuracy, firing position and time to defeat remain practical constraints. |
| Service access | `encounter-geometry.mjs:7–65` checks supported ground, a landing patch, body clearance and a clear launch approach. Tactical definitions reject a missing pad (runtime:307–310); retained pads are revalidated exactly (2147–2150). Service needs proximity under 2.2 m, speed under 0.9 m/s, throttle at most 0.1 and released firing/deployment commands for 250 accepted ticks (3306–3317). Combat continues. |
| Supported supplies | Lines 2836–2861, 3878–3929: unsupported drops wait; dead aircraft cannot collect healing. Tactical pickups do not replenish ammunition. A missed or inaccessible pickup does not remove the Tactical pad mechanism. |
| Target access | Lines 572–589, 633–636: admission uses one equipped weapon's range and projectile clearance. This is firing-line evidence from launch, not a guarantee that both weapons can reach every target or that a depleted heavy slot has an equally reachable conventional fallback. |

Existing focused pad evidence covers a 40 m airborne regional restart, an elevated native floor, exact saved-pad validation, missing-pad rejection, and Tactical resupply/reload at the actual saved pad (`fpv-encounter-v2.test.mjs:951–1026`; [runtime qualification](overhaul-runtime-qualification.md)).

## Finding and authorized correction

**Fixed: empty-payload advice ignored the ammunition preset.** `optional-practice/civilian-fpv/world-app.mjs` previously always directed an empty player to supplies or a service pad. Tactical explicitly disallows pickup ammunition (runtime:3895–3904), so this suggested an ineffective recovery action. Arcade's automatic recharge (3186–3196) was also absent.

`combatPayloadControls` now receives the current attempt's ammunition preset from `paintCombatHUD`, ahead of later workbench settings. English and Ukrainian messages direct Tactical to its pad, Arcade to release Fire for the full eleven-second recharge interval, and Balanced to supplies plus its pad when one exists. Ready, deployed and armed payload states are preserved.

Focused verification after this host-only correction:

- `fpv-encounter-host-lifecycle.test.mjs`: **28 passed, zero failed**, 842.88 ms reported duration. The added case covers both languages, all three presets, all three payloads, pad presence, current-attempt precedence and selection fallback.
- Changed-source ESLint: passed with zero warnings. Prettier reported both changed files unchanged.
- Checks ran sequentially. No runtime suites or browser sessions were started.
- World-app SHA-256: `636b470e388f5c2004ebb0426502df5d6f984964aa2f9a2c94d779ada6c5dea0`
- Host lifecycle test SHA-256: `90354c18c819dff713cbb7062c9a0f2bf3a3540ab2dd1778ee1c40b4b2bf6492`

## Still unqualified

- Complete objectives with all 18 combinations on representative constrained, aerial and large maps, including low remaining heavy ammunition.
- Returning to and surviving five-second service under ordinary/elite/final pressure; stationary fixture refills do not establish this.
- Practical Scatter range/spread, Precision miss cost, reload interruption, supply discoverability and player frustration. These require gameplay observations, not a source-only balance judgment.
- Conservative pad rejection can make Tactical unavailable at a particular start; this is explicit launch rejection rather than silently starting an unwinnable empty-ammunition run.

See the [human playtest template](overhaul-human-playtest.md), [player guide](player-guide.md) and [delivery gates](overhaul-delivery.md).

Source fingerprints reviewed:

- Runtime SHA-256: `8becebc7f3bcd14621726f816fdde7cec8c658ec01b67fdf11c751a96c1651ba`
- Geometry SHA-256: `9d1254b8f7db0b2dc6499f0dbef59568674a56f5cc014ed982fc9eb1f0d09fde`
- v2 test source SHA-256: `75ae6992bade1911e0326ecc1331e951531ec517919568796ed21b474e37aea6`
