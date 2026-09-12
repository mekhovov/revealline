# Round 05 — XPOSED RELOADED motion and manual audit

Inspected 12 September 2026. This records rendered video frames, short temporal comparisons and the visible in-game manual. Four Reloaded recordings were sampled; none was watched in full. The [six-still audit](round-05-reloaded-stills.md) and [source inventory](round-05-xposed-source-inventory.md) complement this record. The [new direction](../round-05-gameplay-direction.md) separates observed behavior from our proposed rules.

## Sources and method

| Recording | Coverage |
|---|---|
| [Lentarian, Pack 1, levels 1–12 / three stars](https://www.youtube.com/watch?v=8L3PwVcvg40) | Player duration 22:47.53; opening capture/result sequence and ten later positions across the run. |
| [Lord Parker, settings and gameplay](https://www.youtube.com/watch?v=SKKvpZ2DvUY) | Roughly 5½ minutes; sampled loading logo, controller/manual pages and main menu around 0:10–1:00. |
| [Lentarian, Pack 5 / three stars](https://www.youtube.com/watch?v=OZGPPOg0eAI) | Player duration 43:45.98; five samples distributed across the run. |
| [Sony-hosted official Reloaded trailer](https://vulcan.dl.playstation.net/img/rnd/202111/0915/4oOD4otPZbCJhoRuPgCBMugh.mp4) | Duration 39.02 seconds; sampled around 0:10, 0:20, 0:24 and 0:30. |

Playback was inspected through browser screenshots. Seek positions were checked against the visible player; stale frames immediately after seeking were excluded. Selected screenshots are saved in [the evidence folder](evidence/round-05). They are browser captures, not original publisher image downloads. Timestamp precision identifies samples, not measured game timing. There was no executable playtest or audio audition.

## The manual resolves previously uncertain mechanics

At [0:40–0:45](https://www.youtube.com/watch?v=SKKvpZ2DvUY&t=40s), the controller illustration supports a left stick or D-pad. The instructions describe exposing enough ground and collecting stars for further levels. Four pickup effects are listed: additional life, slower enemies, faster player and frozen enemies. [Saved upper manual](evidence/round-05/reloaded-manual-0045.png)

At [0:50–0:55](https://www.youtube.com/watch?v=SKKvpZ2DvUY&t=50s), the lower manual distinguishes the following. This is stronger evidence than guessing a role from its color in a gameplay still. [Saved lower manual](evidence/round-05/reloaded-manual-0055.png)

| Visible role | Manual meaning | Design consequence |
|---|---|---|
| Sparse blue terrain | Slows the player; enemies ignore the effect | A local, actor-specific terrain effect, not our current global enemy-speed modifier. |
| Red crossed terrain | Kills the player on contact; does not affect enemies | Different from a collision wall. Capture and direct contact need separate semantics. |
| Dense cyan wall | Blocks both player and enemies | A structural obstacle, not a revealed safe island. |
| Ordinary round enemy | A field threat to avoid | Gives the basic cut its moving risk. Exact fill-anchor behavior is still unresolved. |
| Large pink diamond | Destroys exposed territory | Adds pressure after a successful capture; requires ownership reversal. |
| Cyan line enemy | Travels along lines | Later gameplay places these on internal capture contours. |
| Ringed exposed-ground enemy | Moves in exposed territory | Revealed ground is not universally safe. |

Four enemy entries are visible here. This does not establish the complete roster, or justify importing Switched's advertised eight-enemy count into Reloaded. Yellow/ringed visual states in other frames cannot be named confidently from appearance alone. The tutorial does not establish pickup durations, spawn probabilities, stacking, contact versus enclosure collection timing, or every terrain interaction after capture.

The loading screen at [0:10](https://www.youtube.com/watch?v=SKKvpZ2DvUY&t=10s) visibly displays Unity branding. This resolves the previously unknown reference engine; it does not change our browser/frontend-oriented engine recommendation by itself.

## Pack 1: progression through space, not only speed

| Time | Direct observation |
|---|---|
| 0:05–0:06 | A near-black field, five life icons, 0/80 and a one-minute timer; the avatar begins near the bottom center. |
| [0:10](https://www.youtube.com/watch?v=8L3PwVcvg40&t=10s) | HUD reads 96/80. Most of a neon city is revealed; a small lower-right pocket still contains a field enemy. [Frame](evidence/round-05/reloaded-pack1-0010.png) |
| About 0:11 | The remaining pocket disappears during the completed-picture celebration. The actual achieved capture and the artwork shown after victory are distinct. |
| 0:15 | Result stars represent completion, keeping lives and finishing within a 60-second condition. |
| [2:16.75](https://www.youtube.com/watch?v=8L3PwVcvg40&t=136s) | 59/80; complex stepped claimed contours, cyan enemies on internal edges, an unfinished L-shaped cut at lower right. [Frame](evidence/round-05/reloaded-pack1-0216.png) |
| [4:33.50](https://www.youtube.com/watch?v=8L3PwVcvg40&t=273s) | 10/90; several solid wall bars divide a broad blue slow field. Both quota and movement conditions vary by level. [Frame](evidence/round-05/reloaded-pack1-0433.png) |
| 6:50.26 | 44/90; three wall-defined chambers, enemies in remaining pockets and a speed pickup. Walls and captured edges jointly shape the next opportunity. |
| [9:07.01](https://www.youtube.com/watch?v=8L3PwVcvg40&t=547s) | Red lethal tiles form warning lettering; a long vertical route passes through a gap. Decorative-looking motifs are actual level geometry. [Frame](evidence/round-05/reloaded-pack1-0907.png) |
| [11:23.76](https://www.youtube.com/watch?v=8L3PwVcvg40&t=683s) | 13/80; vertical wall channels, slow/lethal strips, a freeze pickup and a large diamond beside fragmented revealed ground. The still alone does not prove the erosion transition. [Frame](evidence/round-05/reloaded-pack1-1123.png) |
| [13:40.51](https://www.youtube.com/watch?v=8L3PwVcvg40&t=820s) | Level 8 results show a 150-second speed condition and three stars. Speed thresholds are not globally 60 seconds. [Frame](evidence/round-05/reloaded-pack1-1340.png) |
| 15:57.26 | 10/80; slow/lethal patterns form an outer ring and central crossings. [Frame](evidence/round-05/reloaded-pack1-1557.png) |
| 18:14.02 | 14/80; long parallel lanes, irregular inner pockets, a diamond and a speed pickup. [Frame](evidence/round-05/reloaded-pack1-1814.png) |
| 20:30.77 | 7/80; central wall cage, red L shapes, blue rings, a diamond and a pickup. [Frame](evidence/round-05/reloaded-pack1-2030.png) |

The reference's repeated pleasure is a changing routing problem: close a cut, inspect the newly shaped frontier, choose another exposed route. Authored chambers, terrain patches and moving threats make that cycle different across levels. This is a design interpretation, not measured retention evidence.

## Pack 5: motifs become more demanding routing structures

| Time | Direct observation |
|---|---|
| 4:35.39 | Dense angular blue/red terrain and ringed moving objects. Their precise variant names remain unverified. |
| [13:07.79](https://www.youtube.com/watch?v=OZGPPOg0eAI&t=787s) | 28/80; modular small chambers with lethal tiles and slow pockets, internal line traffic and a speed pickup. [Frame](evidence/round-05/reloaded-pack5-1307.png) |
| [21:52.99](https://www.youtube.com/watch?v=OZGPPOg0eAI&t=1312s) | 50/80; branching red terrain surrounded by slow patches. [Frame](evidence/round-05/reloaded-pack5-2153.png) |
| [30:38.19](https://www.youtube.com/watch?v=OZGPPOg0eAI&t=1838s) | 29/80; mixed central terrain, small enemy-containing pockets above and a broad claimed foothold on the left. [Frame](evidence/round-05/reloaded-pack5-3038.png) |
| [39:23.38](https://www.youtube.com/watch?v=OZGPPOg0eAI&t=2363s) | 70/80; diagonally arranged terrain built from orthogonal steps, large diamonds, a rising stepped cut and a campfire landscape beneath the reveal. [Frame](evidence/round-05/reloaded-pack5-3923.png) |

These boards suggest a reusable layout vocabulary. They do not prove that copying dense late-game patterns produces fair touch controls; corridor widths and escape opportunities need our own playtests.

## Official trailer cross-check

- **9.91 seconds:** a central cyan wall heart and red lethal heart, with separate red islands and enemies outside. Level silhouettes can be expressive while preserving orthogonal geometry. [Frame](evidence/round-05/reloaded-official-0010.png)
- **20.01 seconds:** level 7 defeat screen with direct menu/restart actions. [Frame](evidence/round-05/reloaded-official-0020.png)
- **Around 24 seconds:** 49/80 on a warning-letter board; internal cyan patrols and irregular covered pockets.
- **30.12 seconds:** 89/80 and nearly complete city artwork; a small covered pocket remains. [Frame](evidence/round-05/reloaded-official-0030.png)

## What remains open

Exact fill-side selection is not resolved by these samples. Neither are every enemy variant, pickup timing/duration, the instant of trail failure, input buffering, collision tolerances, or all pack-unlock conditions. The original 2016 XPOSED review's traveling trail-strike pulse remains edition-specific evidence, not a confirmed Reloaded mechanic. There is no listening-based soundtrack evaluation or empirical engagement study here.

The useful next step is to prototype an explicitly chosen capture rule, one mixed-terrain board and a changing internal contour. Copying an unexplained reference algorithm would preserve its ambiguities instead of making the new game understandable.
