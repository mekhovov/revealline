# Experimental Depot Breach: existing-pilot check

Source commit: `a539ccde4d2390ee74a717a076f43926f46952b2`. Exact simulation and pilot hashes are in [the raw evidence](experimental-raid-probe.json.gz); they remained unchanged during all runs. The [evidence harness](experimental-raid-probe.mjs) uses the existing objective-route, Pursuer-upgrade Raid review pilot without altering that pilot or the game source.

Standard difficulty, three airframes, normal earned choices, 60 Hz simulation; eight-minute diagnostic cutoff. No injected upgrades, healing or player-position changes. This is accelerated simulation evidence, not native rendering or human balance evidence.

| Seed | Outcome at cutoff | Objectives completed | Damage | Steering toward solid cover |
|---|---|---:|---:|---:|
| 17031991 | Incomplete, still playing at 480 s | 3 | 0 | 471.45 s |
| 17 | Incomplete, still playing at 480 s | 3 | 0 | 471.33 s |
| 42 | Incomplete, still playing at 480 s | 3 | 0 | 471.42 s |

All runs clear the three infantry leaders and enter the vehicle sector. Around 9–10 seconds the pilot's guarded-vehicle approach steers into `middle-cover`; it settles at approximately `(1131, 238.53)`, just outside that obstacle's west face, and keeps steering east. The nearby light vehicle remains outside the cover. Neither collision tunneling nor damage from touching scenery was observed in this route.

The existing pilot computes approaches around protected enemy bodies and projectiles, but does not inspect terrain or route around permanent obstacles. Consequently these three failures establish a concrete limitation of this automation, **not unreachable mandatory targets**. No replacement pilot was constructed and no tuning was changed. Full terrain-sortie completion and post-destruction route readability remain unqualified; they need a terrain-aware route or native manual review. Existing geometry/navigation unit tests remain separate evidence and do not substitute for that full-sortie review.

The raw record preserves earned cards, summary statistics and two-second player/input/objective samples for each seed. Earned upgrades stayed enabled, so this report makes no baseline-kit completion claim.

## Subsequent evidence

A later evidence-only pilot extension completed all three seeds without any production source changes. See [terrain-aware completion](experimental-raid-navigation-probe.md). The stalled runs above remain preserved as evidence of the original pilot limitation; they are not the final automated reachability result.
