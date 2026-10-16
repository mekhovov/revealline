# Systems: one-airframe challenge versus the default preset

14 October 2026. Two separately authorized follow-ups changed **only airframes from one to the default three**. Both completed. No gameplay source, encounter, seed, difficulty, route, Focus policy or card preference changed. The original losses and six earlier route comparisons remain retained.

| Exact configuration | Original one-airframe result | Default three-airframe result |
| --- | --- | --- |
| Survivor Systems · Split Compound · seed 303907 · Standard | Lost at 304.63 s | **Won at 361.78 s**, two airframes remaining, 60 hull |
| Riy Systems · Loading Loop · seed 101303 · Standard | Lost at 248.07 s | **Won at 326.88 s**, one airframe remaining, 100 hull |

Both use the original generic `systems` review route, which outlasted the existing `tight` route in the retained comparisons. Riy uses normal Focus. No additional seed or loadout search was run.

## Controlled comparison

The first replacement happens at exactly the original defeat tick in each case: **304.6333333333333** and **248.06666666666666** gameplay seconds. Every earned upgrade's ID, time and tick up to that moment matches the original one-airframe evidence exactly. The harness records both checks as true.

After replacement the ordinary game continues, retaining the earned build and world. Remaining upgrades are earned through the same public card selector. Survivor had already earned all ten before its first loss; Riy earns Scanner rank 3 at 260.78 seconds. No card or salvage was injected.

- Survivor completes with primary rank 2, Pulse 3, Side Burst 3 and Scanner 3. Primary evolution is therefore not required for this recorded Systems completion. Total hull damage is 140 contact damage; maximum inter-choice gap is 48.40 seconds.
- Riy completes with evolved Wide Fan, broad Sweeper 3, chain Breaker 3 and Scanner 3. Total hull damage is 180 contact and 20 fan damage; maximum inter-choice gap is 50.85 seconds.
- Both remove the elite and final tank, including all armor. All sampled elite/final approaches within 300 units have clear player-to-target line of sight. Earned salvage equals collected plus on-ground salvage in both runs.

These are **current-source completion examples for the two Systems configurations under the default preset**, not proof of ordinary-player difficulty, one-airframe viability across seeds, or universal build balance. Replacement is part of the default game; its benefit must not be silently mixed into challenge results. The previous Echo late-progression concern is unchanged.

## Evidence and source identity

The two runs completed in 21.35 wall seconds. All 33 runtime dependencies match `ed46c2b72e1735940acd70337f4ca5826506b1cc` and stayed unchanged. Start/end HEAD: `4dab801d9ce03b42227e99388b066c378c81ca02`.

- [Raw telemetry](systems-airframes-final.json.gz): decompressed SHA-256 `e6f0d772c7cc41976cd020be2b70f01c48fbdd4c68095d982927fd3a4e1ea8d5`.
- [Summary and first-life comparisons](systems-airframes-summary.json).
- [Exact configuration](systems-airframes-config.json), [source-bound plan](systems-airframes-plan.json), [runner](systems-airframes-probe.mjs) and [output](systems-airframes-output.txt).

The runner defaults to plan-only; execution requires `--run` and a fresh output path. It preserves target health/armor/LOS, progression gaps, damage/replacement events and squad telemetry. No CPU workers remain active.
