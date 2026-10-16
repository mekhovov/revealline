# Final Survivor / Riy balance matrix

Runtime: ca03d7d7d84dcf50bbab6d2734a6d09097e27ed6. All twelve runtime hashes match this commit and remained unchanged during both executions.

Completed 48 configurations and 236 outcome records. 19/48 active routes won; 0/188 unattended/repetitive branches won. 1 active prefixes lost before their assigned checkpoint and have no mature passive counterpart.

The halves cover disjoint original indices 0–23 and 24–47. Merge validation checks every configuration, checkpoint and route exactly once. The prior eight-configuration receipt was rerun independently; all forty outcome records match exactly. Both halves, the earlier subset and the pre-boundary matrix remain preserved.

| Mode / policy | Active wins / 6 | Standard / Veteran (3 each) | First choice (s) | Evolution (s) | Tenth choice (s) | Largest gap (s) | Peak visible |
|---|---:|---:|---:|---:|---:|---:|---:|
| survivor / fan-shield | 6/6 | 3/3 · 3/3 | 15.45–19.25 | 39.85–70.57 | 244.03–274.65 | 72.48 | 373–869 |
| survivor / echo | 0/6 | 0/3 · 0/3 | 15.45–19.25 | 41.45–77.33 | 254.25–264.4 | 69.08 | 248–603 |
| survivor / echo-shield | 2/6 | 1/3 · 1/3 | 15.45–19.25 | 41.45–82 | 259.73–351.38 | 126.68 | 478–1005 |
| survivor / systems | 1/6 | 1/3 · 0/3 | 15.45–19.25 | — | 234.53–265.55 | 64.6 | 252–566 |
| riy / fan-shield | 4/6 | 2/3 · 2/3 | 18.68–19.88 | 64.5–93.72 | 237.62–293.62 | 70.72 | 360–630 |
| riy / echo | 1/6 | 1/3 · 0/3 | 18.68–19.88 | 71.45–101.25 | 284.22–291.43 | 62.02 | 292–846 |
| riy / echo-shield | 1/6 | 0/3 · 1/3 | 18.68–19.88 | 71.45–101.25 | 284.22–352.7 | 102.38 | 601–906 |
| riy / systems | 4/6 | 2/3 · 2/3 | 18.68–19.88 | 65.58–91.18 | 233.48–266.58 | 62.57 | 234–487 |

Tenth-choice ranges include only runs earning all ten choices. The JSON companion retains the completion count, exact largest-gap cards, damage causes, shield usage, resource peaks and final earned build for each configuration.

## Evidence limits

- Seeds are tied to encounter sets; airframes and 120/180/240-second checkpoints rotate with configuration index. This remains sampled coverage, not an independently crossed matrix.
- Riy echo and echo-shield are the same trail/burst/Shield selection policy with different airframe coverage. They are not two distinct squad directions.
- Every branch continues resolving earned upgrade menus. No-input stays empty after replacements; inherited short boosts/Focus and automatic replacement can still move the drone.
- The active pilot uses only ordinary inputs and earned upgrades, but predicts exact game-state geometry. These outcomes establish reproducible routes and sampled anti-idle behavior, not human enjoyment or difficulty.
- Render performance, input-device feel, upgrade reorientation and visual readability need their separate native evidence.
- Late collection gaps must be reviewed separately. XP is conserved on the map, and a route that leaves a large salvage trail can earn later choices slowly despite sufficient kills.

Commands: run verify-balance.mjs with BALANCE_MATRIX=1, BALANCE_RULES=3, BALANCE_FOCUS=1, explicit BALANCE_CONFIG_INDICES=0,...,23 or24,...,47, each distinct BALANCE_OUTPUT, and Node --max-old-space-size=256. Then run this merge-balance-final.mjs verifier. No gameplay values change during qualification.
