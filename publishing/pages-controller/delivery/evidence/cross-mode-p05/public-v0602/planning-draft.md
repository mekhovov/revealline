# RevealLine — Practice/Playground correction and remaining plan

**Draft for review. Public acceptance of v0.60.2 is still pending.** The last accepted public baseline is [v0.60.1](https://mekhovov.github.io/revealline/releases/v0.60.1/site/game/), within its Team Options and live-control scope. **P03 and P05 remain incomplete.** This update does not expand the accepted campaign or asset counts.

## What v0.60.2 changes

- **Consistent reading preferences:** Controller Practice and Playground share the game's text style, text size and reduced-effects choices. Browser Back now reconciles the selector with the current preference owner. A failed save keeps the local choice and its warning; changing reading settings does not edit a map or reset the preview.
- **Predictable Undo:** when the last available Undo disables itself, focus moves to the selected brush only if Undo still owns focus. A newer selection or background page keeps its ownership. Undo deliberately restores the previous editor configuration, including replacing unapplied Level JSON; the running preview changes only after **Play configuration**.
- **Clearer editor descriptions:** signal zones and hangars have distinct markings and readable descriptions. Their rules, collision and activation requirements are unchanged.
- **Trustworthy diagnostics:** measurements describe the current preview. A replacement or failed preview clears stale live readings; an earlier saved geometry capture remains labelled as historical.

Related guides, maintainer and level-design skills, and the cross-mode prompt were updated with the source. The earlier observed History Back mismatch has a source correction and retained before/after browser evidence; it is no longer listed as an unresolved software defect. Those returns created new child sessions and do not certify browser back-forward caching.

## Delivery status at this draft's cutoff

| Gate | Status |
| --- | --- |
| Exact source qualification | **Passed.** Both hosted qualification families passed **5,449 tests across 433 files each**, with zero failures, cancellations, skips or TODOs. These are the same tests qualified twice, not 10,898 unique tests. The six source gates, production reproduction/readiness and ordinary build passed. |
| Source review | **Merged:** [PR #84](https://github.com/mekhovov/revealline/pull/84). The retained qualification binds the exact game source and its matching source tree. |
| Immutable release | **Published:** [v0.60.2 release](https://github.com/mekhovov/revealline/releases/tag/v0.60.2), **17 September 2026 at 11:18:01 UTC**. Original attachment and evidence reviews passed; publication alone is not public acceptance. |
| Publication selector and Pages | **Pending at this cutoff:** [PR #85](https://github.com/mekhovov/revealline/pull/85). Record its actual final merge and deployment below before promoting the new playable link. |
| Actual public file audit | **Pending.** No new public inventory totals or success claim are supplied by this draft. |
| Affected public player journeys | **Pending.** Recheck the deployed Practice/Playground reading, History Back, Undo, preview and recovery paths within an explicit scope. |
| Complete P03 / P05 / browser release | **Open.** Neither passing source gates nor this correction closes those phases. |

**Final publication details — root to fill from original evidence:**

- `[ROOT TO FILL: actual publisher merge, successful Pages run/deployment and verified playable URL]`
- `[ROOT TO FILL: complete deployed inventory count and bytes; failures, retries and any uninspected files]`
- `[ROOT TO FILL: affected public browser observations, exact viewport/input scope and remaining limitations]`
- `[ROOT TO FILL: offline/recovery evidence or explicit not-tested boundary]`
- `[ROOT TO FILL: scoped acceptance decision and links to its original records]`

Until those records exist, keep v0.60.1 as the accepted-current statement. Its previous complete audit passed **2,674 files / 638,988,304 bytes**, without failures or retries; that result must not be reused as a v0.60.2 audit. Earlier immutable releases and their rollback routes remain preserved.

## What the current evidence does—and does not—show

The retained local integrated observations cover Theme/Large layouts at 390×844 and 844×390, actual draft → Undo with an unchanged child preview, an exported pack imported and decoded, and explicit Play followed by Start/Pause. These are useful scoped observations, separate from final public acceptance.

| Remaining boundary | Next evidence needed |
| --- | --- |
| Complete reading/layout coverage | Finish the style/size matrix, meaningful desktop 200% zoom, EN/UA readability and actual touch/controller use. A resized browser is not a physical-device result. |
| Undo ownership | Newer-focus and background refusal have modeled evidence; no naturally occurring native non-owner/background invocation was reproduced. Do not replace that limit with a fabricated browser pass. |
| Diagnostics | A nonempty offscreen action set has not been observed in the native record. Empty measurements do not establish that all controls are visible. |
| Import/export and recovery | Complete exact original-byte agreement, failure/recovery and the final public journey. The earlier upload/export download alone was insufficient; later successful import/decoding is additional scoped evidence, not the entire acceptance gate. |
| History lifecycle | Keep the repaired body/selector result distinct from browser-admitted BFCache, physical controls and the wider responsive matrix. |

Two focused **P03 test-only candidates** are also ready for later integration:

- **Team victory terminal:** the finite host reaches a genuine simulated First Connection win using keyboard commands, then checks focused Retry, no Resume action, retry with the same authored recipe/art, setup return and Solo departure ownership. The three cases pass on each Node 20/22 runtime. The failed Relay Yard rehearsal remains recorded separately. This is not an actual browser victory or physical-controller acceptance.
- **Cancel saved Continue before changing mode:** the complete affected test file passes **37/37 on Node 20** for the added cancellation/late-rejection boundary alongside existing cases. The old restore cannot replace the saved run or reclaim newer mode focus. Node 22 and a controlled actual browser journey remain pending for this candidate.

**Neither candidate demonstrated a runtime defect.** They strengthen coverage; their counts are not added to v0.60.2's qualification and they do not retroactively close native P03 gates.

## Next work, in priority order

1. **Finish v0.60.2's public gate.** Verify the final deployed version and complete inventory, then the affected Practice/Playground journeys. Publish the scoped acceptance result and preserve all remaining limits.
2. **Continue P03 native navigation.** Prioritize decision/cancel paths, genuine Collection/score pagination, Team terminal results and failed/cancelled transitions. Then cover foreground interruption, story return, offline/recovery and saved-run migration. Integrate the two test-only candidates with final-source checks; independently exercise real browser journeys. Preserve previously accepted ordinary and practice-exit routes without counting them again.
3. **Continue P05 supporting screens.** Review and integrate the Production/Viewport candidate, then qualify actual browser flow, layout and zoom. Its two affected files passed 24 cases on Node 20; only its 12-case startup file separately passed on Node 22. This is not a two-file Node 22 qualification or an accepted public tool route. Motion/Recovery and disabled-transport presentation remain later items.
4. **Finish the three-level gameplay/presentation benchmark before bulk campaigns.** Complete art/actor parity, action feedback and fair enemy pressure in the approved phase order below; use human playtests for challenge and enjoyment.

## Remaining phase plan — approved order retained

| Phase | State and completion requirement |
| --- | --- |
| **P00; P01; P02-A** | **Accepted within retained scope:** integration, loading feedback and shared sound authority. |
| **P03 — native navigation** | **In progress.** Complete screens, decisions, pagination, terminal/lifecycle/recovery journeys and real-input gates. |
| **P05 — readable presentation** | **In progress / partial.** Studio/Replay and the scoped Team correction are accepted. Practice/Playground source is qualified; its public gate is pending. Complete other routes, EN/UA text, palettes, contrast, focus, zoom and reduced effects. |
| **P08-A — artwork and actors** | **Partial.** Exact artwork across modes, recognizable silhouettes, heading, scale, both detail treatments and compatible installed content. |
| **P08-B — action feedback** | **Partial foundations; queued.** Clear trail danger, capture, loss/recovery, bonuses, Support/rescue and victory effects without obscuring play. |
| **P09 — challenge and enemy intelligence** | **Partial foundations; queued.** Fair pressure, readable warnings/counters and compatible deterministic encounters, checkpoints and replays. |
| **P07 — rewards and continuation** | **Partial foundations; queued.** Retry/Next, objectives/mastery, full-picture and optional story rewards, failed-transition recovery and no duplicate awards. |
| **P02-B — music** | **Partial foundations; queued.** Custom/mixed playlists in every advertised mode, exact media transfer, offline/failure recovery and an auditioned soundtrack. |
| **P04 — creation framework** | **Partial foundations; queued.** Registries, Studio, history, prompts and real original-byte upload/edit/export/import/play demonstrations. |
| **P06 — discovery and installation** | **Partial foundations; queued.** Compatible catalog, explicit bounded downloads, safe replacement/removal and interrupted-install recovery. |
| **P10 — Team encounters** | **Queued.** Support/rescue, shared objectives, encounter variants and complete two-player readability. Layout corrections do not deliver these encounters. |
| **P11-A–D — FPV campaigns** | **Queued.** Four independently released campaigns of twelve missions each. |
| **P12-A–D — DroneAid campaigns** | **Queued.** Four independently released campaigns of twelve missions each, with distinct authored Support/Combat interactions. |
| **P13 — Ukrainian culture** | **Queued.** Twelve complete Living Atlas missions with cultural, historical and visual review. |
| **P14 — retro arcade** | **Queued.** Twelve complete After School Arcade missions with distinct nostalgic art, encounters and music. |
| **P15 — spend management** | **Queued.** Twelve complete Spend in Motion missions with understandable noncombat goals. |
| **P16 — supporting workflows** | **Partial foundations; queued.** Collection, scores, replay, learning, recovery and legacy-content acceptance. |
| **P17 — reproducible authoring** | **Partial foundations; queued.** Complete guides, AI skills, prompts and CLI examples; independently create, install, play, export and recover a pack. |
| **P18 — browser qualification** | **Open.** Cross-phase regression, performance/memory, media/offline recovery, accessibility, physical input and human playtests. |
| **Native stores; network multiplayer** | **Deferred separate gates.** Browser completion implies neither store certification nor online readiness. |

**The 132 new Solo missions remain future work.** Content counts have not advanced: **15/29 map families, 60/116 pictures and 1/12 victory stories** are recorded as delivered; **40 reserve originals** are accepted as source artwork. The target of **56 complete animated character sets** remains unmet. The **24-track album** remains a candidate requiring listening and qualification, separate from existing music infrastructure.

Each completed phase or named subphase receives related-hunk review and commit, a new synchronized version, final-source checks, reviewed source and publication PRs, immutable release originals, and actual public verification before being marked Complete. Published releases are not overwritten.

## Recommendation for the next acceptance pass

Continue applying [Xbox XAG 112](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/112): verify predictable keyboard/controller focus across the **whole journey**, including Cancel, Back, retry and text-size changes. Keep the selected action and its complete focus ring visible, and test that delayed operations cannot steal focus from a newer choice. This uses retained research guidance; no new web review or accessibility certification was performed for this draft. Human playtests remain necessary to assess fairness, enjoyment and replay value.
