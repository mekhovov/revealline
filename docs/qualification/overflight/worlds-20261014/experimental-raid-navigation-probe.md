# Experimental Depot Breach: terrain-aware completion

Source commit: `a539ccde4d2390ee74a717a076f43926f46952b2`. All tracked game code remained unchanged. [Raw evidence](experimental-raid-navigation-probe.json.gz) records exact stable game-source hashes, evidence-pilot hashes, earned cards, summaries and two-second route/input samples.

The [initial unchanged-pilot failures](experimental-raid-probe.md) are retained. The follow-up adds only an untracked evidence-policy extension: a visibility graph around obstacle corners inflated by the drone radius plus four units, plus selection of a free orbital approach if the intended guarded-target approach falls inside cover. It reads known terrain geometry and submits normal steering, boost and upgrade choices. It does not move the player, change armor, grant resources, alter enemies or bypass contacts. The underlying collision, replacement and reward code is unchanged.

Repeat with `node docs/qualification/overflight/worlds-20261014/experimental-raid-probe.mjs --terrain-aware`. Policy: [terrain-aware objective pilot](experimental-raid-route-policy.mjs) and [navigation helper](experimental-raid-navigation.mjs).

Standard difficulty, three starting airframes, normal earned upgrades, deterministic 60 Hz simulation:

| Seed | Outcome | Time | Objectives | Armor breaks | Damage taken | Airframes left |
|---|---|---:|---:|---:|---:|---:|
| 17031991 | Won | 34.25 s | 7 | 7 | 200 | 1 |
| 17 | Won | 24.15 s | 7 | 7 | 60 | 3 |
| 42 | Won | 24.32 s | 7 | 7 | 58 | 3 |

All three routes complete the vehicle sector and final tank. No sampled steering segment hit solid cover within the 30-unit diagnostic lookahead. The higher-damage seed includes ordinary airframe replacement and still completes; the pilot receives no protection beyond the game's rules.

Both breakable barriers remain intact at two hits in all three runs. This establishes automated full-sortie reachability **before barrier destruction** and resolves the initial pilot's middle-cover stall. It does not demonstrate barrier-breaking tactics or the readability of changed routes; those remain separate review items. Existing barrier and committed-warning unit tests are correctness evidence only.

These fast automated completions are not normal-player timing or enjoyment estimates. No baseline-kit claim is made because upgrades are earned and selected normally. Native terrain combat footage, human navigation readability and physical-device performance are not established by this accelerated simulation probe.

A follow-up [two-pass breach check](experimental-raid-barrier-probe.md) destroys a barrier with ordinary boosted passes, verifies no resource reward, traverses the new opening and completes the full Raid. The intact-layout runs above remain preserved separately.
