# Hidden prey and Uncharted Circuits

This follow-up implements the October 5 request to hide every enemy during active jamming, review the existing catalogue, and add varied encounters. It builds on refreshed main `e3e1e8b8d3b061a85c77f7bc82159db810dff688`; it keeps one transition controller and the existing shared results, automatic replay, and direct Next/Retry flow.

## What changes for players

All enemy art is omitted before analog receiver compositing while the player's board has active interference. Ordinary enemies are hidden even beside a head, and they continue moving and turning normally. No shadow, badge, remains, target particle, relay link, or clean-feed fraction discloses them. The drone, cable, terrain, source antenna beacon, and actual lethal hazard edges remain readable. Leaving local coverage, catching the source, Pulse, or the end of a burst restores them immediately. Reduced effects has the same concealment rules without moving noise.

The quiet opening six missions remain unchanged. Thirty-three later foundation recipes receive shorter goals; eighteen of those now use fleeing targets. Existing patrol, sprint, refuge, switchback, shield, brace, and cooperative mechanics remain distinct instead of receiving arbitrary new rules. Fourteen specialist recipes replace repeating fixed posts with distinct encounters and moving prey. Old recipes are retained for accepted saves, imported recordings, and earned grades.

The new **Uncharted Circuits** campaign adds 24 missions across four six-mission chapters:

| Chapter             | Decisions and examples                                                                                                              |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Crossing Routes     | Intercept across islands, switch refuges, use wrapping edges. Orchard Fork, Switchback Courts, Boundary Exchange.                   |
| Changing Shortcuts  | Time shutters, detour for Pulse or a shorter tail, use newly opened marked walls. Shutter Split, Courier Overpass, Breaking Bridge. |
| Hidden Signals      | Remember unseen prey, escape local coverage, catch a transmitter for relief. Edge of Reception, Moving Shadow, Radio Chase.         |
| Expedition Circuits | Combine known roles and distinct stations with multiple routes home. Outpost Circuit, Relay Islands, Four Routes Home.              |

## Catalogue audit

| Measure                         | Before | After |
| ------------------------------- | -----: | ----: |
| Missions                        |    120 |   144 |
| Chapters                        |     19 |    23 |
| Campaigns                       |      8 |     9 |
| Stationary foundation missions  |     39 |    21 |
| Field missions using shutters   |      0 |     5 |
| Field missions offering pickups |      0 |    10 |
| Field missions using wrapping   |      0 |     2 |

All 24 additions have distinct wall layouts and use varied spawn pairs. The review checks finite specialist quotas against their authored positions, so clearing a mission does not require repeatedly eating a stationary enemy at the same post. Permanent bypasses, body-safe shutters, and marked eroder barriers remain enforced by existing rules.

## Research and design choices

These are design applications, not evidence that a particular tuning value maximizes engagement:

- [Bandai Namco's official PAC-MAN character guide](https://www.pacman.com/en/character/) distinguishes persistent pursuit, ambush, and wandering. Snake uses its existing moving enemy roles to create different interception decisions instead of merely reskinning a stationary target.
- [Ubisoft's original Mute design spotlight](https://www.ubisoft.com/en-us/game/rainbow-six/siege/news-updates/4en01O0QVsEiwZyR66P8Zt/operator-spotlight-3-mute-british-unit) describes limited-area interference with a destroyable source. Snake keeps the antenna and coverage understandable while removing enemy tracking information during bursts.
- [Subset Games' Into the Breach design postmortem](https://media.gdcvault.com/gdc2019/presentations/Into%20the%20Breach%20Postmortem%20Final.pdf) emphasizes readable attacks, short experiences, and interesting choices. Snake preserves lethal warnings and combines a few existing roles; it does not add hidden lethal geometry or random steering changes.

## Verification scope

Qualification uses accepted inputs through the production simulation and verifies replay bytes. A legal winning route does not establish human difficulty or enjoyment: the automatic pilot can inspect simulation state while a player cannot see concealed enemies. Desktop and narrow-screen renderer checks therefore complement those proofs. Physical controller hardware and long-term player engagement are not measured by this work.

Final verification: **216/216 Snake tests** in one full run; **95/95 host/menu cases** covered by the batch and focused rerun; **57/57 controller cases**; **288 field mission recordings**, **66 revised foundation recordings**, and **585 exact grading setups**. All **249 prior grading keys and thresholds** remain unchanged. The additional hazard sample verifies **45 Solo/normal setups** at seeds 1, 42 and 2026. Repository lint, validation/localization, nine optional-package checks, and six canonical shared-source projections pass.

Browser evidence covers the same move with the original/hidden-prey treatments, live movement during interference, 320×640 reduced-effects Team rendering with a 290×217.5 board and no horizontal overflow, actual mobile Retry/pause/Choose and automatic results replay, and Ukrainian controls at 740×360. Screenshots are in this directory. The fixture deliberately uses slow accepted routes where moving prey remains present during a burst; a fast source-first interception is valid counterplay and can prevent interference.

Watchpoints for human review: Shared Detour’s verified Solo route takes 57.88 seconds. Nine foundation evidence routes include four or five consecutive turns; no geometry forces those exact machine choices. They are not evidence of comfortable touch play.

The full distribution build contains **3,088 payload files plus its manifest**. Every expanded file and all **3,089 ZIP members** passed size, SHA-256 and CRC verification. The exact receipt is [encounter-build-verification.json](encounter-build-verification.json). The task-created disposable distribution was removed after verification; source files, evidence and the live preview remain. No deployment or release admission is claimed.

Machine-readable evidence: [verification](encounter-verification.json), [catalogue before](encounter-audit-before.json), [catalogue after](encounter-audit-after.json), [hazard samples](encounter-hazard-samples.json).
