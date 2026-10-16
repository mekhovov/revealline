# Experimental terrain: two-pass breach and current baseline-kit Raid

Tested commit: `dece9da68922743c73dc6cc2697a0aa9783b5326`. [Raw evidence](experimental-raid-barrier-probe.json.gz) records exact hashes for every Overflight module and the evidence pilot; gameplay source remained stable during the run. The [repeatable harness](experimental-raid-barrier-probe.mjs) changes no tracked game or production-pilot code.

## Barrier destruction followed by complete objectives

Standard Experimental Depot Breach, seed 17, three starting airframes, normal earned upgrades. An evidence-only prelude approaches `breach-north` from its clear east side, boosts into it, finishes the boost, retreats out of contact, waits for passive cooldown, and makes a fresh boosted approach. It then flies through the opened passage and hands steering back to the terrain-aware objective pilot.

| Event | Time | Barrier hits remaining | Boost identity |
|---|---:|---:|---|
| First distinct pass | 5.05 s | 2 → 1 | `boost:288` |
| Second distinct pass | 7.58 s | 1 → 0 | `boost:439` |
| Through opened passage; objective route resumes | 8.33 s | 0 | — |
| Raid won, all seven objectives and armor breaks resolved | 47.40 s | 0 | — |

Both hit transactions preserve kills, salvage earned, score, Rush charge, pending upgrade choices, armor hits and completed-objective counts exactly. Boost cooldown decreases by only the ordinary 1/60 second on each impact, with no refund. The completed run has exactly two terrain strikes and one destruction revision; the barrier remains inactive. The second barrier remains intact. Final damage is 200, with one airframe remaining: replacement and damage rules stayed active.

This supplies automated full-objective reachability **after actual two-pass barrier destruction**, complementing the [three intact-layout completions](experimental-raid-navigation-probe.md). The initial prelude attempt is retained in `experimental-raid-barrier-initial-probe.json.gz` with its policy source: it stalled because its extra navigation margin included the deliberately contacted barrier. Only the evidence prelude was corrected to retreat directly into the known clear approach space; no game collision or navigation code changed.

## Current-source baseline-kit Raid

The same evidence run reran the existing objective pilot across all three open worlds on seed 17031991, Standard, three airframes. Upgrade offers were disabled before starting; no stats, positions, targets or cooldowns were granted or changed. The kit remained baseline and all runs selected zero cards.

| World | Outcome | Time | Objectives | Damage | Cards chosen |
|---|---|---:|---:|---:|---:|
| Field Crossing | Won | 24.20 s | 7 | 0 | 0 |
| Freight Depot | Won | 22.82 s | 7 | 0 | 0 |
| Relay Ruins | Won | 23.38 s | 7 | 0 | 0 |

These are automated correctness and reachability results. They do not establish ordinary-player completion times, enjoyment, native terrain readability or physical-device performance. Barrier combat and changed-route visuals still need native review.
