# RevealLine — Practice/Playground accepted, next priorities

**[v0.60.2 is now the accepted public baseline](https://mekhovov.github.io/revealline/releases/v0.60.2/site/game/) for the Practice/Playground readability correction.** The complete deployed-file audit and affected actual browser journeys passed their stated scope. **P03, P05 and full browser qualification remain incomplete.** [Acceptance](../acceptance.json), [browser observations](../native/observations.json) and the [public file report](../tools/runs/complete-1/report.json) define the boundaries.

## What is complete in this release

- **Shared reading preferences:** Controller Practice and Playground follow the game's text style, size and reduced-effects choices. Actual browser Back now leaves the selector and page styling in agreement. A failed preference save retains the local choice and warning.
- **Predictable Undo:** the last Undo restores the prior working configuration and moves its retiring focus to the selected brush. Newer focus and background ownership retain their guards. Undo deliberately replaces unapplied Level JSON; the running preview changes only after **Play configuration**.
- **Clearer map descriptions and diagnostics:** signal zones and hangars have distinct markings and readable descriptions. Live measurements stop presenting an earlier preview as current; saved geometry captures remain labelled as historical. Gameplay rules are unchanged.
- **Updated authoring guidance:** related guides, maintainer and level-design skills, and the cross-mode prompt are included in the qualified source.

The earlier History Back mismatch is corrected, not an outstanding software defect. The observed return created a new child session, so this result does not establish browser back-forward-cache preservation.

## Delivery and verification

| Gate | Accepted result |
| --- | --- |
| Exact source qualification | Both hosted families passed **5,449 tests across 433 files each**, with zero failures, cancellations, skips or TODOs. These are repeated qualification families, not 10,898 unique tests. Six source gates, production reproduction/readiness and ordinary build passed. |
| Source review | [PR #84](https://github.com/mekhovov/revealline/pull/84) merged. Qualification binds the exact game source and matching tree retained in the acceptance record. |
| Immutable release | [v0.60.2](https://github.com/mekhovov/revealline/releases/tag/v0.60.2) published **17 September 2026 at 11:18:01 UTC**, with the inspected original release attachments. |
| Pages deployment | [PR #85](https://github.com/mekhovov/revealline/pull/85) merged; [Pages run 35215437655](https://github.com/mekhovov/revealline/actions/runs/35215437655) succeeded. The acceptance record pins publisher, deployment and success status separately from game source. |
| Actual public files | **2,705 files / 639,168,008 bytes** verified; zero failures, retries, skipped or uninspected files. Every result reconciles to the exact inventory. The [subsequent authority refresh](../after-http-authorities-public-1/result.json) confirmed source, release, latest version and deployment remained unchanged. |
| Affected browser journeys | **Accepted within scope:** shared preferences, actual History Back, held virtual input, last Undo, import/export and failed-import recovery, explicit preview play, real practice victory, Retry and explicit Pause/Resume. |
| Complete phases | **Still open:** P03 navigation, the rest of P05 presentation and P18 qualification. No fresh offline or physical-device acceptance is claimed. |

The canonical [Play route](https://mekhovov.github.io/revealline/game/) was observed opening v0.60.2. Earlier immutable releases and rollback routes remain preserved.

## What was actually played and inspected

The public in-app Chromium journey used ordinary UI actions without injected game state:

- Practice retained a held **virtual** pad button and the exact current preview session while text size changed. Explicit Release all and Disconnect worked. This is not a physical-controller test.
- Actual Home → Display changes → browser Back produced matching Plain/Standard/reduced preferences and selector state. Practice and Playground were inspected at **390×844 and 844×390** in Theme/Large/full and Plain/Standard/reduced; document width matched the viewport.
- Playground's Scout → Fiber draft → last Undo restored Scout, focused Wall and kept preview revision 1 unchanged.
- An owned pack was imported, exported, then reimported through the actual file chooser. Both original files are **862,703 bytes and byte-identical**, with matching SHA-256 recorded in the [byte review](../native/export-byte-review.json). Malformed JSON was rejected while the prior background, Undo and preview remained intact. Explicit Play advanced the preview to revision 2.
- The imported practice mission was genuinely played to **52.2% / 8,160 points / 0:04**, then retried from zero. Escape paused and explicit Return resumed. These were practice results, with **no campaign awards**.

Inline screenshots were inspected during the root browser session but were not retained as image artifacts. Original pre-deployment 404 and automation lookup misses remain separate; they are not relabelled as successful attempts or diagnosed product defects.

## What remains unverified

| Boundary | Remaining work |
| --- | --- |
| Complete display/input matrix | Meaningful desktop 200% zoom, complete EN/UA and style/size coverage, physical touch/controllers, Safari and actual target devices. Resizing Chromium does not certify those devices. |
| Undo ownership | Newer-owner/background refusal is modeled; no naturally occurring native non-owner/background invocation was reproduced. |
| Diagnostics | A nonempty offscreen action set remains unobserved. Empty measurements do not prove that every control is visible. |
| Lifecycle and recovery | Browser-admitted BFCache, fresh offline/media recovery, saved-run migration and broader cross-mode acceptance remain separate. The specific public pack round trip and malformed-import recovery above are complete within their scope. |
| Player experience | Human playtests must assess fairness, challenge, comfort, enjoyment and replay value. Passing code and HTTP checks cannot establish them. |

## Next work, in priority order

1. **Continue P03 native navigation.** Prioritize decision/cancel paths, genuine Collection/score pagination, Team terminal results and failed/cancelled transitions. Then cover foreground interruption, story return, offline/recovery and saved-run migration. Preserve previously accepted ordinary journeys without counting them again.
2. **Integrate the two focused P03 test-only candidates, then exercise real browser journeys.** Team's First Connection won-terminal cases pass on each Node 20/22 runtime; the saved Continue cancellation/mode-departure candidate's complete affected file passes **37/37 on Node 20**. Neither found a runtime bug. They are separate from v0.60.2's qualification and do not establish native Team victory or native delayed Continue cancellation. The failed Relay Yard rehearsal remains explicitly retained.
3. **Continue P05 supporting screens.** Review and integrate Production/Viewport, then qualify browser navigation, layout and zoom. Its two affected files passed **24 cases on Node 20**; only its **12-case startup file** separately passed on Node 22. Do not infer two-file Node 22 acceptance. Motion/Recovery and disabled-transport presentation remain later items; no accepted public tool route is claimed.
4. **Complete the three-level gameplay/presentation benchmark before bulk campaigns.** Follow artwork/actor parity, action feedback and fair enemy pressure in the approved order below. Use actual playtests before expanding content production.

For saved Continue, test a genuinely played and UI-saved flight. Restoration reads the pinned original from IndexedDB and decodes a local blob; delaying its old HTTP URL cannot hold that restoration. A controlled network delay can separately test **fresh Start** preparation. Keep an unobserved native cancellation window open rather than mislabelling that different path as coverage.

## Remaining phase plan — approved order retained

| Phase | State and completion requirement |
| --- | --- |
| **P00; P01; P02-A** | **Accepted within retained scope:** integration, loading feedback and shared sound authority. |
| **P03 — native navigation** | **In progress.** Complete screens, decisions, pagination, terminal/lifecycle/recovery journeys and real-input gates. |
| **P05 — readable presentation** | **In progress / partial.** Studio/Replay, the scoped Team correction and now Practice/Playground are accepted. Complete other routes, EN/UA text, palettes, contrast, focus, zoom and reduced effects. |
| **P08-A — artwork and actors** | **Partial.** Exact art across modes, recognizable silhouettes, heading, scale, both detail treatments and compatible installed content. |
| **P08-B — action feedback** | **Partial foundations; queued.** Clear trail danger, capture, loss/recovery, bonuses, Support/rescue and victory effects without obscuring play. |
| **P09 — challenge and enemy intelligence** | **Partial foundations; queued.** Fair pressure, readable warnings/counters and compatible deterministic encounters, checkpoints and replays. |
| **P07 — rewards and continuation** | **Partial foundations; queued.** Retry/Next, objectives/mastery, full-picture and optional story rewards, failed-transition recovery and no duplicate awards. |
| **P02-B — music** | **Partial foundations; queued.** Custom/mixed playlists in every advertised mode, exact media transfer, offline/failure recovery and an auditioned soundtrack. |
| **P04 — creation framework** | **Partial foundations; queued.** Registries, Studio, history, prompts and original-byte upload/edit/export/import/play demonstrations. |
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

**The 132 new Solo missions remain future work.** Counts have not advanced: **15/29 map families, 60/116 pictures and 1/12 victory stories** are recorded as delivered; **40 reserve originals** are accepted as source artwork. The target of **56 complete animated character sets** remains unmet. The **24-track album** still requires listening and qualification, separate from existing music infrastructure.

Every completed phase or named subphase requires related-hunk review and commit, a new synchronized version, final-source checks, reviewed source and publication PRs, immutable release originals, and actual public verification before being marked Complete. Published releases are never overwritten.

## Recommendation informing the next checks

Continue applying [Xbox XAG 112](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/112): verify predictable keyboard/controller focus through the **whole journey**, including Cancel, Back, retry and text-size changes. Keep the selected action and its complete focus ring visible, and verify that delayed operations cannot steal a newer choice. The [retained research follow-up](../research-followup.md) supports this priority; these recommendations are not an accessibility certification.
