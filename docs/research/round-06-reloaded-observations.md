# Round 06 — closer XPOSED RELOADED observations

Inspected 12 September 2026. This is a targeted follow-up to the [Round 05 motion/manual audit](round-05-reloaded-motion-audit.md) and [source inventory](round-05-xposed-source-inventory.md). It adds a previously uninspected Pack 6 level and examines later portions of the Lord Parker recording. The new evidence resolves several specific transitions; it is not a claim to have watched every recording or to have reconstructed the complete game.

## Sources and inspection method

| Source | New inspection coverage |
|---|---|
| [Lentarian — Pack 6, Level 7, three stars](https://www.youtube.com/watch?v=-qG4k6dkd-c) | Published 12 March 2022; about 2:47. Gallery, initial board, early captures, later erosion, quota completion and settled result screen. |
| [Lord Parker — Settings & Gameplay LPOS](https://www.youtube.com/watch?v=SKKvpZ2DvUY) | Published 22 December 2021; about 5:32. Pack navigation around 1:10–1:34; selected early boards; closer pickup sequence around 4:56–5:03. Round 05 already examined this recording's manual. |
| [Sony-hosted Reloaded trailer](https://vulcan.dl.playstation.net/img/rnd/202111/0915/4oOD4otPZbCJhoRuPgCBMugh.mp4) | About 39 seconds. Additional samples at 0:03, 0:07, 0:12, 0:16, 0:25 and 0:29 cross-check presentation and terrain variety. No new algorithm is inferred from its edits. |

The root task could stream the Pack 6 source, including the 7/70 HUD around 0:43.49. This subagent's fresh browser discovery had no attached browser. Public video-only files were therefore decoded locally for closer analysis, following the user's authorization for public video analysis. No authentication, cookies, DRM bypass or private media were used. This is an analysis method, not a workaround for a prohibition on displaying media; it does not mean streaming was unavailable everywhere.

Raw videos and surplus working frames remain in temporary storage outside the project. Forty-nine selected, unaltered frame exports are retained under [evidence/round-06](evidence/round-06). They are reference evidence, not assets licensed for incorporation into our game. Times below are positions in the source recording. A decimal timestamp locates a sampled frame; it is not a measured game tick or input latency. Neither full video was watched continuously, and no audio or playable executable was tested.

## New findings at a glance

| Question | Strongest new evidence | Status |
|---|---|---|
| Are quotas fixed at 80 or 90 percent? | Pack 6 Level 7 starts at 0/70 and completes at 70/70. | **Resolved for this level:** 70 is another authored quota. |
| Does a closed cut always fill a large side? | An early zigzag closure leaves a thin revealed corridor at 1/70, while a later closure fills a broad pocket. | **Observed contrast; full selection algorithm remains open.** |
| Does captured territory actually get removed? | The large diamond creates new covered notches at the frontier with cyan impact particles. | **Directly observed**, beyond the manual's description. |
| Are pickups collected by enclosing their location? | A speed icon survives after the surrounding picture is revealed; it triggers when the player passes its position. | **Contact collection observed for this pickup.** |
| Can walls remain visible after being enclosed? | The top-center hollow wall and adjacent slow/lethal patterns disappear when their pocket fills. | **Visual transformation observed; post-capture collision behavior not fully tested.** |
| What are the pack star gates? | Pack navigation explicitly displays 36, 72, 108, 144 and 180 stars. | **Displayed thresholds directly confirmed**, with purchase/entitlement qualifications below. |
| Is every level's speed medal 60 or 150 seconds? | Pack 6 Level 7 result screen displays a 180-second condition. | **Another per-level target directly confirmed.** |

## One board, two different capture outcomes

Pack 6 Level 7 uses alternating tall bars and stacked hollow rectangles, with red lethal outlines and broad blue slow fields around them. This is authored routing geometry: a player must choose which corridors to open and which enclosed terrain group to remove. The background is a purple night sky over a pier, while bright actors and functional terrain form a separate visual layer. [Initial board, 0:12](evidence/round-06/reloaded-pack6-l7-012.png)

At [0:20](https://www.youtube.com/watch?v=-qG4k6dkd-c&t=20s), a long active zigzag extends from the bottom through the center toward the top. By **0:24**, it has reconnected and become a thin revealed corridor, with only **1/70** on the HUD. Large covered regions remain on both sides, with field enemies still visible in them. At 0:28 that corridor persists. This is a direct counterexample to the idea that every successful reconnection must reveal a large region. [Active cut](evidence/round-06/reloaded-pack6-l7-020.png), [closed corridor](evidence/round-06/reloaded-pack6-l7-024.png), [later corridor](evidence/round-06/reloaded-pack6-l7-028.png)

At **0:36–0:37**, another cut descends beside the top-center hollow wall toward an existing horizontal corridor. By **0:39**, the area between these routes has filled, moving the HUD from **2/70 to 7/70**. No field enemy is visibly inside that particular pocket immediately before closure. This is consistent with filling a region that contains no relevant enemy, but the sequence does not establish which enemy classes count, how wall topology is treated internally, or every tie case. [Before closure](evidence/round-06/reloaded-pack6-l7-037.png), [after closure](evidence/round-06/reloaded-pack6-l7-039.png)

The filled pocket also loses its **visible cyan hollow wall, blue slow pattern and red lethal outline**. This is stronger than merely seeing the background appear beneath a permanent obstacle. A rule that always leaves walls visible after capture would differ from this observed reference case. However, the selected frames do not isolate a later player crossing through the old wall cells, so they do not by themselves prove the full collision-state transition. Treat permanent walls, removable walls and terrain neutralization as explicit choices for our game until those behaviors are tested directly.

There is another reason not to overstate the fill rule: Parker's **4:00 and 4:30** samples show many cyan patrols on isolated revealed shapes and newly drawn contours, with thin corridors still surrounding covered regions. No ordinary pink field enemy is visible in these particular samples. These frames deserve a future controlled comparison before asserting that only the ordinary field-enemy class can preserve a covered component. They do not alone establish a different anchor rule. [4:00 board](evidence/round-06/reloaded-parker-240.png), [4:30 board](evidence/round-06/reloaded-parker-270.png)

## Erosion is a visible state change

The manual already identifies the large diamond as an enemy that destroys exposed territory. Pack 6 Level 7 now supplies a close before-and-after example.

By **1:40**, the long remaining region at the left has a mostly straight right frontier with one small notch near its top. At **1:52–1:56**, the left diamond passes down the narrow space between the cyan wall and that frontier. Small covered rectangles progressively protrude into the previously revealed picture. The player is far to the right, and no player cut causes these left-side changes. [Earlier frontier](evidence/round-06/reloaded-pack6-l7-100.png), [before the descending pass](evidence/round-06/reloaded-pack6-l7-112.png), [after the pass](evidence/round-06/reloaded-pack6-l7-116.png)

The closest samples isolate two impacts:

| Video time | Direct frame observation |
|---|---|
| **1:54.0** | Diamond near the left frontier around screen y=335; the next section below is still straight. |
| **1:54.2** | A new cyan-outlined covered notch appears around y=350 with cyan particles beside the diamond. |
| **1:54.4** | That notch remains as the diamond moves farther down. |
| **1:54.6** | Another notch and impact particles appear around y=415. |

[1:54.0](evidence/round-06/reloaded-pack6-l7-114.png), [1:54.2](evidence/round-06/reloaded-pack6-l7-0114-2.png), [1:54.4](evidence/round-06/reloaded-pack6-l7-0114-4.png), [1:54.6](evidence/round-06/reloaded-pack6-l7-0114-6.png)

Lives remain at five. The displayed score remains 2,447 and the whole-number coverage remains 57/70 across these close samples. Therefore the geometry change is confirmed, but a percentage or score penalty formula is not. The removed area may be too small to alter the rounded HUD. Do not infer that erosion has no coverage cost from an unchanged integer. The frames also do not establish whether reclaiming an erased cell grants score again, or what happens if erosion removes the player's support cell.

## A pickup survives enclosure and then triggers on approach

In Parker's third shown board, a green chevron pickup sits near the upper-right covered region at **4:56**. At **4:58–5:00**, captures reveal the surrounding image while the pickup icon remains visible at its original location. Enclosure alone has therefore not consumed this pickup. [4:56](evidence/round-06/reloaded-parker-296.png), [4:58](evidence/round-06/reloaded-parker-298.png), [4:59](evidence/round-06/reloaded-parker-299.png), [5:00](evidence/round-06/reloaded-parker-300.png)

Between **5:00.0 and 5:00.1**, the player reaches its vicinity and the framed chevron gives way to a bright pickup effect. At **5:00.3–5:00.5**, the effect expands as the player moves downward. By **5:01**, the icon has gone and the active cut has a green effect; the previously inspected manual associates the chevron with faster player movement. [Contact vicinity](evidence/round-06/reloaded-parker-0300-1.png), [expanded effect](evidence/round-06/reloaded-parker-0300-3.png), [movement after pickup](evidence/round-06/reloaded-parker-0300-5.png), [new active cut](evidence/round-06/reloaded-parker-301.png)

The supported rule is **separate reveal and pickup-contact events**, for this example. Exact collision radius, speed multiplier, duration, expiry cue and stacking behavior remain unmeasured. Particle shapes should not be used to invent a different pickup type when the visible pre-contact icon and manual already identify it.

## Progression: displayed gates, optional mastery and animated rewards

Parker's pack navigation directly exposes the following UI thresholds. Each lock page also shows a **BUY** action. These are the displayed requirements in that recording, not proof that every edition or entitlement must earn the stars.

| Pack | Displayed stars | Video time | Frame |
|---|---:|---|---|
| 2 | 36 | 1:20 | [Frame](evidence/round-06/reloaded-parker-080.png) |
| 3 | 72 | 1:22 | [Frame](evidence/round-06/reloaded-parker-082.png) |
| 4 | 108 | 1:26 | [Frame](evidence/round-06/reloaded-parker-086.png) |
| 5 | 144 | 1:30 | [Frame](evidence/round-06/reloaded-parker-090.png) |
| 6 | 180 | 1:34 | [Frame](evidence/round-06/reloaded-parker-094.png) |

Lentarian's Pack 6 gallery at **0:05** shows **163 total stars**, despite that pack being playable. The same gallery shows Level 7 and Level 8 with only one filled star while later Levels 9, 10 and 12 have three. Thus the footage directly rejects a blanket rule that every earlier level must first receive three stars to play later levels in the same pack. The apparent difference between a displayed 180-star Pack 6 gate and a playable pack at 163 stars could involve a purchase, edition or other entitlement; this recording does not reveal which. [Gallery evidence](evidence/round-06/reloaded-pack6-l7-005.png)

The level ends with a separate image reward and result sequence:

| Video time | Direct observation |
|---|---|
| **2:32** | 67/70, five lives, 0:37 remaining; another cut is active. |
| **2:34** | HUD reaches 70/70; the remaining covered regions begin a blue fade while enemies and terrain are still visible. |
| **2:36** | Full unobstructed pier artwork replaces the playfield. The reward image is complete although the gameplay quota was 70. |
| **2:40** | Result animation has awarded two stars so far; the third is still outlined. |
| **2:46** | Settled result awards all three, shows a **180-second** speed condition, score **9,833**, a new-high-score banner and menu/restart/next actions. |

[Final cut](evidence/round-06/reloaded-pack6-l7-152.png), [quota transition](evidence/round-06/reloaded-pack6-l7-154.png), [picture reward](evidence/round-06/reloaded-pack6-l7-156.png), [intermediate results](evidence/round-06/reloaded-pack6-l7-160.png), [settled results](evidence/round-06/reloaded-pack6-l7-166.png)

A single frame taken during the award animation would falsely label this as a two-star result. The reference separates actual coverage, the completed-picture presentation, medal awards and final scoring. Their precise bonus formula remains open.

## Consequences for the proposed framework

These are design implications, not claims that the current framework implements them:

- Treat terrain composition and topology as authored content. Alternating bars, hollow cages and mixed strips change routing more substantially than only increasing enemy count or speed.
- Keep capture resolution, terrain transformation and image presentation separate. A successful cut can create a corridor, fill a region or trigger the final complete-picture celebration.
- Give erosion an explicit territory-reversal event. Decide how it affects current coverage, score, navigation and terrain restoration, then verify those choices with executable cases.
- Give contact pickups their own lifecycle and status effects. Revealing their location must not silently imply collection when using this reference behavior.
- Store per-level reveal quotas and speed-medal targets. This audit directly observes 70 percent and 180 seconds; earlier footage establishes other values.
- Separate level availability, pack entitlement and optional medals. The reference's gate UI is evidence to discuss, not a mandate to impose an all-star progression barrier in our game.
- Let the complete background image serve as the victory reward while preserving the honest achieved percentage in results. Art themes can change independently of those rules.

No game code or authoring schema was changed in this audit. The [Round 05 challenge extension proposal](../../authoring/challenges/round-05-reference-adjustments.md) remains a proposal, and any previously unknown reference behavior should be read with the narrower findings above.

## Remaining questions and edition limits

This pass does not resolve the complete fill-side algorithm, exactly which actor classes preserve covered components, every enemy variant, death/respawn timing, active-trail strike propagation, input buffering, invulnerability, all terrain collision states after capture, pickup probabilities/durations, or the final scoring formula. The successful Pack 6 recording is useful for erosion and capture, but gives no isolated death sequence. No new enemy class is named from a changing color, ring or particle effect alone.

All direct observations here concern **XPOSED RELOADED**. The original XPOSED review's trail-strike pulse and XPOSED SWITCHED's advertised eight-enemy roster remain edition-specific evidence. These samples are also not retention research: interpreting the reveal, route choice, near miss and medal cycle as engaging is a design hypothesis for our own playtests.
