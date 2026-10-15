# Final-source qualification

Frozen production/test source: `f0136c2b0f2916af142f6e27a86b3ed2141b844a`. All previous failures and preliminary attempts remain preserved in [the parent record](../README.md). No retries of unchanged source were performed.

## Complete sequential source audit

| Owner                     | Verified source/selection cases | Maps usable under both selections | Real wins/losses, immediate | Real wins/losses, grid-center |
| ------------------------- | ------------------------------- | --------------------------------- | --------------------------- | ----------------------------- |
| Base + Pressure Lines     | 46/46                           | 15/15                             | 20/3                        | 20/3                          |
| Journey + Original Legacy | 208/210                         | 101/103                           | 101/3                       | 102/2                         |
| DroneAid                  | 84/84                           | 42/42                             | 41/1                        | 36/6                          |
| Coupa                     | 72/72                           | 36/36                             | 34/2                        | 33/3                          |

The [combined summary](audit-summary.json) derives complete playback from `verifiedSourceIds`, not registration. The one batch finishes at 2026-10-15T22:31:16.853730Z. All sampled source/content hashes remain stable, no top-level audit errors occur, and Worker owners/listeners finish at zero. Owner runs take 92.891/1079.689/293.748/287.418 wall seconds respectively; this is accelerated preparation/verification, not spectator time. Authored recordings retain their actual steering policy.

Two Journey cases exceed the unchanged 15-second loading deadline: **Staggered Reserve/immediate** (15,001 ms) and **Side Door Bays/grid-center** (15,097 ms). Each policy individually covers 102/103 maps, but their failed identities differ, so only 101/103 work under both. Passing focused route checks does not waive these deadlines. Every other source reaches a real terminal result and independently reconstructs its replay checkpoint. Full all-level availability remains unqualified.

Reports/logs: [base](base-final.json), [log](base-final.log); [Journey](journey-final.json), [log](journey-final.log); [DroneAid](droneaid-final.json), [log](droneaid-final.log); [Coupa](coupa-final.json), [log](coupa-final.log). [Exact batch commands/outcomes](batch-state.json).

## Real browser observation — running, not acceptance

The existing observer was refreshed once after all audits finished, then the ordinary Help & Extras → Watch demo and Start observation controls were used. The single two-hour clock started at **2026-10-15T22:35:30.499Z**, with no source edits, navigation or restarts afterward. The first stable checkpoint contains the actual initial served-source inventory; its hashes match local files at collection. Pressure Lines remains installed. Recorded scenes and both Orchard Crossing/Courtyard Exits live scenes have appeared; this is preliminary observation, not final endurance proof.

Actual UI checks independently pause demo playback while music stays playing, resume the demo, pause music while gameplay advances and explicitly resume music. Sound was explicitly enabled, and details were closed afterward. These are DOM transport/intent observations, not proof of audible output. No steering or practice takeover was injected.

The initial browser had no drawable native viewport; early canvas samples report `canvas-not-visible`. A supported 1200×900 viewport was applied around 194 seconds into the same run, and the page was scrolled to the game board. The [live rendering view](browser-viewport.png) shows actual Courtyard playback. Browser visibility was briefly presented for rendering inspection, then restored to its prior hidden-presentation setting. **Only report visibility/focus samples can establish hidden/unfocused execution; presentation settings alone cannot.** Reset the viewport override during final cleanup. This limitation prevents treating the early interval as a complete rendering stress test.

The [immutable initial checkpoint](browser-start-checkpoint.json) and [handoff state](browser-handoff-state.json) record startup and explicit controls. All first 72 samples remain visible/focused and zero JS diagnostics; 35 have sampled canvas output. The [initial layout screenshot](browser-initial-layout.png) preserves the unusable pre-override framing. The live running checkpoint remains incomplete until automatic completion, terminal source/storage checks and final evidence collection. Follow [the finite handoff](../browser-observation-handoff.md). Do not start another observation, reload, navigate or edit served source. A normal saved completion permits exactly one later accelerated Worker check after owned observer cleanup; an interrupted observation skips it.

Physical iPhone/input/audio acceptance and three unfamiliar viewers remain deferred by the user. No release acceptance, merge or publication is claimed.
