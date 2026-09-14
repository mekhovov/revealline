# Couch shell: source and desktop native checks

Recorded 2026-09-14. Feature `9fe241b42365d8c9822746232f3ea8746a18f8ad` replaces the couch banner and permanent control strips with lobby, setup, options, help, pause and results screens. Normal merge `e1bbba7debe4562fc67a9df393a00ec90fbd7aa7` includes separate v0.37 source `14d04b80` and its [media connection correction](media-connection-recovery.md); all nine couch source/test files remain unchanged. This source follow-up has no version bump, build, freeze or public release.

## Behavior and checks

The shell uses the existing navigation/router and match lifecycle. Confirm and Back operate on the active screen; cancelled setup/leave prompts restore their opener. One **New match · setup** action retains explicit reset confirmation. Results can show both completed boards without advancing play. Two independent direction latches, capture/recovery stopping, explicit Resume, neutral action gates and series results remain intact; couch grants no solo awards.

Each player has session-local Auto, Always and Off controls. Auto observes accepted input for that seat; an old held controller cannot reclaim presentation after fresh touch or keyboard input. The optional observer reports adapter requests, not guaranteed core action execution. Automatic hiding waits for pause and physical-input release, retaining direction. Always supports pointer use. Controls stay outside the full arena with 44-pixel minimum targets; a viewport grid allocates space around encounter rows. Arcade hides unavailable manual actions; Tactical labels follow the equipped class.

The affected suite passed **56/56 on Node 22 and 56/56 on Node 20** after correcting raw-held-controller presentation, the actual `.pressed` class and available-height layout. The earlier 53-case candidate and unsuccessful intermediate runs remain retained. Removing the duplicate new-match action and correcting finished-board captions then passed **six affected cases on each Node version**, with scoped format/lint/diff checks. Node 20 additionally enumerated 30 intentional name-filter skips; this was not another full suite. Parent source review and an independent input-adapter read closed without a remaining blocker.

The parent used ordinary keyboard and pointer input at **1280 × 720**, reviewing four actual screenshots:

| Journey                    | Observed result                                                                                                                                    |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lobby/setup/options/help   | Keyboard navigation, actual selector edits and reading; child Back restores focus.                                                                 |
| Immediate match            | P2 clears at 50.0% / 7,820 / three lives, then 52.2% / 8,160 / three lives for a 2:0 series; P1 life loss/recovery remains independent.            |
| One and two control pads   | Complete boards and controls fit the observed desktop viewport.                                                                                    |
| Grid with pointer controls | P1 reaches 20.6% / 3,220 / three lives; P2 wins at 52.2% / 8,160 / three lives.                                                                    |
| Results and cancellation   | Frozen boards remain visible; cancelled new-match/leave prompts retain values and focus.                                                           |
| Final menu recheck         | A new P2 down tap wins at 52.2% / 8,160 / three lives; one setup action remains, cancellation restores it, and captions say “Results for options.” |

## Evidence binding

The first native receipt sampled source **after** menu cleanup. Its mandatory supplement binds observations 01–11 to preserved `native-8965-source` files and 12–14 to final menu source. Neither the first receipt nor raw observations was rewritten. Read/hash reconciliation matched 18 artifacts and ten original/final source pins; all 14 text snapshots were read without another browser run.

Paths beginning `.cache/round47` are under the repository root; the others are under the couch worktree.

| Record                                                                                            | SHA-256                                                            |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `.cache/round47/couch-native/receipt.json`                                                        | `c9cc7cff4baf8c67b7cc2255af1da95bb040a8481e301b5da3510270303d99be` |
| `.cache/round47/couch-native/source-binding-and-menu-supplement.json` — required with the receipt | `fe7063a2d8f57a7373add7de79b35285ddfc6654f07279aa83a320ff21728166` |
| `.cache/couch-shell/review-correction/verification.json` — 56-case checks                         | `61b1fa1312b59947bba5bb89020bd3f3adaba827ffe22c60e0f4b32e72713038` |
| `.cache/couch-shell/menu-consolidation/verification.json` — final source and focused checks       | `42dea8dfe2bb15dfe7f321668d5e0d3636bcac1342bb285ce2e2c2b59e5c3aa4` |
| `.cache/couch-shell/callback-review/peer-runtime.json` — independent callback read                | `681c74063af2da4f0037c5a49886fc447a67453a41639f7f20ac8efa2d9ee9a1` |
| `.cache/couch-shell/native-reconciliation/verification.json` — binding reconciliation             | `db84252d749a2ccdc0f86cc80e629f2fd6c1e59e05b92d58bfc1c9c0c64bc34f` |

## Remaining qualification

This does not establish physical-controller/touch behavior, compact portrait/landscape fit, every wide/dual-encounter board, sustained performance, offline/public delivery or human enjoyment. Screenshots and text snapshots are sequential observations. The couch loader retains its existing embedded-pack path: external chapter indices and exact-original readiness are not adopted, and generic artwork must not be presented as external-original support.

After the separate v0.37 run, select the next exact source candidate. Check compact layouts with both pads and encounter rows, then actual devices when available. Run that candidate’s complete source gates and verify the new shell module in loose, ZIP and offline graphs before frozen/public acceptance. Preserve v0.37 evidence and historical releases. Follow the [couch navigation contract](../../couch-controller-navigation.md), [shared agent workflow](../../feature-delivery-workflow.md#couch-shell-and-accepted-input) and [production plan](../../production-plan.md).
