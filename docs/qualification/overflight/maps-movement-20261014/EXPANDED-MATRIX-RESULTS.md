# Expanded final-source movement results

**Complete: 12 earned active baselines, 44 available unattended branches defeated, four checkpoints unavailable. No unattended wins, capped continuations or draft failures.** All thirteen policy names were actually exercised in both Survivor and Riy.

The batch ran from `2026-10-14T15:48:34.925Z` to `2026-10-14T15:51:14.377Z` in **159.45 seconds**. The [raw report](expanded-earned-final.json.gz), [compact summary](expanded-earned-final-summary.json), [case output](expanded-earned-final-output.txt) and [manifest](expanded-earned-config.json) are retained. Decompressed raw SHA-256: `afbe644f769dc978357e7423c97f4ced97c26f30c4d8bce6a3d23af26bc61a03`.

## Evidence identity

All 33 simulation dependencies stayed identical to candidate `ed46c2b72e1735940acd70337f4ca5826506b1cc`. `sourceStable` is true. The Git head moved from `720e5f52818e3c621b684e405ee561ce12707b71` to `b12d4a1346786ba38bd707e008110a549a1bea7e` while separate documentation/render-instrumentation work was committed; those changes are outside this headless simulation dependency closure. Exact hashes are retained in the raw report and [source provenance](expanded-earned-provenance.json).

Against the earlier `3bb` combat source, the only dependency change is the additive, uncalled cosmetic ground helper in `worlds.mjs`; existing world/rules code is byte-identical after that addition is removed. This does not claim that older native performance recordings measured the new integration commit.

## Active baselines and checkpoint availability

| #   | Mode / build preference | Layout              | Difficulty / airframes |   Active result | Earned choices | Available branches |
| --- | ----------------------- | ------------------- | ---------------------- | --------------: | -------------: | ------------------ |
| 0   | survivor / fan          | Shelterbelt Gaps    | standard / 3           |  won at 319.38s |             10 | 4 / 4              |
| 1   | riy / echo              | Supply Orchard Edge | veteran / 1            | lost at 166.08s |              7 | 2 / 4              |
| 2   | survivor / echo         | Dispatch Junction   | veteran / 3            | lost at 330.42s |             10 | 4 / 4              |
| 3   | riy / systems           | Loading Loop        | standard / 1           | lost at 248.07s |              9 | 4 / 4              |
| 4   | survivor / systems      | Split Compound      | standard / 1           | lost at 304.63s |             10 | 4 / 4              |
| 5   | riy / fan               | Receiver Gardens    | veteran / 3            |  won at 379.53s |             10 | 4 / 4              |
| 6   | survivor / fan          | Floodgate Yard      | veteran / 1            | lost at 214.43s |              9 | 3 / 4              |
| 7   | riy / echo              | Twin Docks          | standard / 3           | lost at 311.10s |              9 | 4 / 4              |
| 8   | survivor / echo         | Haul Switchbacks    | standard / 3           | lost at 317.28s |             10 | 4 / 4              |
| 9   | riy / systems           | Reclaimer Court     | veteran / 1            | lost at 211.17s |              8 | 3 / 4              |
| 10  | survivor / systems      | Glasshouse Ruins    | veteran / 3            | lost at 356.08s |             10 | 4 / 4              |
| 11  | riy / fan               | Irrigation Courts   | standard / 1           | lost at 301.53s |              9 | 4 / 4              |

**Two active pilot wins and ten losses remain in the evidence.** They are not an ordinary-player completion rate and were not corrected by changing health, speed, damage, upgrades or encounter budgets. The full traces retain exact earned cards, salvage, positions, injuries, warnings and goals.

Unavailable branches are explicit:

- Case 1: 180s / `heading-5` — Active baseline lost at 166.08333333333334s.
- Case 1: 240s / `heading-6` — Active baseline lost at 166.08333333333334s.
- Case 6: 240s / `heading-0` — Active baseline lost at 214.43333333333334s.
- Case 9: 240s / `park` — Active baseline lost at 211.16666666666666s.

These four are not counted as passes. No replacement seeds or injected builds were used. Available checkpoint counts are **12 at 60s, 12 at 120s, 11 at 180s and nine at 240s**.

## What the unattended results establish

All available continuations ran through their actual final defeat, including replacement airframes and automatically selected legal drafts. They did not stop merely because the 240-second checkpoint had passed. Each started with at least 90 seconds of scheduled encounter time remaining.

Parked play, all eight fixed headings, repeated shuttles, tiny circles, a fixed approach toward cover/boundary and a simple orbit were represented. The longest continuation survived **77.57 seconds** after the branch began; it still lost. This is bounded evidence that these earned states and policies did not complete unattended, not proof that every possible exploit is absent.

| Case / policy  | Checkpoint | Longest interval without hull damage or a consumed shield | Kills / collected salvage in that interval | Eventual result |
| -------------- | ---------: | --------------------------------------------------------: | -----------------------------------------: | --------------- |
| 6 / wall       |        60s |                                                    39.75s |                                  260 / 199 | lost at 115.17s |
| 4 / heading-4  |       180s |                                                    30.87s |                                  185 / 275 | lost at 218.00s |
| 7 / heading-1  |        60s |                                                    28.23s |                                     59 / 1 | lost at 123.90s |
| 11 / heading-6 |       180s |                                                    22.08s |                                    100 / 5 | lost at 257.57s |
| 7 / heading-3  |       180s |                                                    21.20s |                                     52 / 2 | lost at 212.75s |

The **39.75-second wall-held dominance** in Floodgate Yard is preserved for pacing review: it cleared 260 enemies and collected 199 salvage before the continuation eventually lost at 115.17s. A second held-west interval lasted 30.87s in Split Compound before defeat at 218s. These are not unattended completions; whether the duration feels rewarding or too passive needs native gameplay review. The binary gate must not hide them.

## Practical limits

- This uses twelve cover layouts, three new seeds, both modes, Fan/Echo/Systems preferences, Standard/Veteran and one/three airframes through explicit rotation. It is not exhaustive Cartesian or complete pairwise combinatorial coverage.
- The named Loading Loop Fan/Shield regression remains separately recorded in [FINAL-SPEED-FIX.md](FINAL-SPEED-FIX.md); this batch extends the map/policy/checkpoint coverage.
- Build preferences do not guarantee a particular completed build. Exact earned checkpoint builds and subsequent legal choices are present in the raw data.
- Active-pilot losses may expose real pressure or limitations of that pilot. No source fix or balance change is inferred from loss rate alone.
- Headless correctness and exploit results do not establish native visual/audio quality, browser cadence or enjoyment.
