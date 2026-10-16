# Final-source bounded movement comparison

Tested commit: `3bb1b0dc66ae77baf59d0e89ab9edf257a244d10`. Ten cases completed on 14 October 2026, 14:42:48–14:44:26 UTC. Start/end commit and captured source hashes match; the report also records the exact diagnostic script hash. Runtime sources remained frozen.

Every case uses rules V4, seed `17031991`, Standard difficulty, three airframes and earned upgrade choices. The review pilot flies until 120 seconds, then continues active flight or switches to the listed fixed input. Drafts continue automatically after replacement airframes. No upgrades, hull, positions or rewards are injected. The observation ends at defeat or 240 seconds.

| Layout / operation / build | Input after 120 seconds | Outcome | Longest interval without hull damage or shield use |
| --- | --- | --- | ---: |
| Loading Loop / Riy / Fan–Shield | Active | Reached 240 s | 68.37 s |
| Loading Loop / Riy / Fan–Shield | Park | Defeat at 142.05 s | 4.83 s |
| Loading Loop / Riy / Fan–Shield | Hold west into boundary/cover | Defeat at 154.22 s | 8.00 s |
| Loading Loop / Riy / Fan–Shield | Hold south | Defeat at 150.57 s | 8.58 s |
| Broken Crossroads / Single Drone / Fan | Active | Reached 240 s | 66.00 s |
| Broken Crossroads / Single Drone / Fan | Park | Defeat at 151.80 s | 7.02 s |
| Antenna Court / Single Drone / Echo | Active | Reached 240 s | 54.22 s |
| Antenna Court / Single Drone / Echo | Tiny circle | Defeat at 133.70 s | 2.67 s |
| Pump Apron / Riy / Systems | Active | Reached 240 s | 70.50 s |
| Pump Apron / Riy / Systems | Straight shuttle | Defeat at 141.27 s | 4.85 s |

All four active runs reached the bounded endpoint; all six unattended runs lost. The named Loading Loop parked/wall/held-south policies no longer reproduce the long safe farming observed before the cover-clearance correction. The current review pilot also differs from that historical instrument, so these outcomes are not an isolated measurement of only the final speed fix.

This comparison establishes the selected policies' behavior on the final source. It does **not** replace the earlier broad matrix, prove full-sortie active completion, cover all layouts/seeds/difficulties, establish ordinary-player difficulty or measure rendered performance. Long safe intervals during active clearing remain valid earned relief. The twenty corrected-pilot active losses in the earlier broader sample remain relevant review evidence.

- [Complete report and one-second traces](final-speed-fix.json.gz)
- [Per-case output](final-speed-fix-output.txt)
- [Exact diagnostic source](final-speed-fix-probe.mjs)
- [Effective-speed correctness tests](effective-speed-tests.txt)

The probe saves an atomic gzip checkpoint after each case. All ten final cases and source metadata are preserved; no partial-output limitation applies to this report.
