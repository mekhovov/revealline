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

## Real browser observation — interrupted; no endurance pass

The single observation started at **2026-10-15T22:35:30.499Z** after one refresh to frozen source and the completed sequential audits. At **2026-10-16T00:15:43.734Z** (6,013.239 elapsed seconds), the embedded game loaded the Couch race page, and the observer could no longer attach to `#demo-dialog`. The monitor did not steer or navigate the game; the cause of this navigation is **not established**. It was discovered at the next scheduled check. No replacement or resumed observation was started.

The observer was explicitly stopped at **2026-10-16T00:20:29.052Z**, after **6,298.309 monotonic elapsed seconds / 6,298.553 calendar seconds** (about 1 h 45 min), short of the requested 7,200 seconds. The final report says `manual-stop`, `observationComplete: false`, `requestedDurationReached: false` and `observationValidForPinnedSources: false`. The UI's `two-hour-observation` label names the selected mode; it is not a pass. The post-observation Worker run is **skipped**, as required for interruption.

[Exact finalized report](browser-observation-final.json) · [exact interrupted checkpoint](browser-observation-interrupted-checkpoint.json) · [last running report](browser-observation-running.json) · [derived outcome summary](browser-outcome-summary.json). The finalized report is 2,784,115 UTF-8 bytes; SHA-256 `eabf6dc013bebe2a78220cf3a3faab82f984e91967cd97e97420612b69a7bd05`. Both report collection and preliminary checkpoints used bounded DOM reads; before/after markers were identical for accepted joins. Three unstable reads around 23:05 UTC were discarded, not accepted as a partial report.

### What was actually observed

- **1,202 samples**, including **1,104 sampled canvas frames** after the viewport correction. DOM scene entries show repeated rotation through **15 distinct real levels**, with recorded play, both qualified live maps (Orchard Crossing/Courtyard Exits), and improvised `Live player` scenes. The summary lists 116 observed scene entries; these are UI observations, not independent replay verification of each browser performance. The last active-demo sample is at 5,990.082 seconds. Accumulated simulation time is not exposed by this observer and is not inferred from per-scene timer labels.
- Actual UI checks paused demo playback with music playing, resumed demo, paused music while gameplay advanced, and explicitly resumed music. There are 11 samples with Resume/playing and 29 with Pause/paused. Sound was explicitly enabled. These prove sampled transport intent, not physical audibility or successful playback of every audio asset. The observed song title remains Carol of the Bells (Metal Version), by Alexander Nakarada; track advancement was not established.
- **All 1,202 visibility/focus samples are visible/focused.** Hidden/unfocused execution remains untested. Two long callback gaps total **116.904 seconds**, with a maximum gap of 103.025 seconds. These intervals are unobserved, not proof that playback continued during a freeze.
- The initial native viewport was not drawable. The supported 1200×900 override was applied around 194 seconds into the same run, followed by scrolling to the game. [The live rendering view](browser-viewport.png) and [initial layout](browser-initial-layout.png) preserve that limitation. Canvas checksums are samples, not proof of all-frame spoiler protection or human viewing quality.
- Observer IndexedDB recovery failed at **22:53:27.323 UTC** with a closing database connection. [The first warning](browser-recovery-warning-20261015T2305.json) is retained. The live DOM report remained readable and was saved directly; no recovery restart was attempted. The second diagnostic is the child-navigation attachment failure. No other JS diagnostic was captured, which is not a claim that no other failure occurred.
- Initial and final served inventories contain **327 files / 19,440,399 bytes**, with **no changed/added/removed source entries**. Direct local comparison after final collection also matches all initial hashes. An inventory is not proof that every file executed or that cached loaded bytes can be reconstructed.
- Existing redacted storage entries are unchanged and none removed, but **five hashed keys were added**. Their raw identities/values were not read into evidence; attribution to settings, navigation, saves or rewards is not established. This interrupted run cannot certify zero progress/reward writes. Heap samples range from 68,680,162 to 508,478,940 bytes, including the observer and the changed child page; no leak-freedom or teardown guarantee follows.

### Cleanup and remaining acceptance

The [final interrupted view](browser-interrupted-final.jpg) retains the Couch race screen and unavailable observer. The screenshot adapter returned a narrow 164×6129 document image despite requesting a viewport capture; it does not establish final responsive framing. After exact evidence was saved, the temporary viewport was reset and only browser 2/tab 2 was closed. The task-owned port 8832 listener was verified as PID 43127, `node scripts/game-cli.mjs serve --port 8832`, then terminated; the listener is absent afterward. Browser presentation remains at its prior false setting. Other tabs, ports 8779/8820, unrelated processes and the shared checkout were untouched. Closing the tab releases its context, but browser Worker/listener teardown counts were not directly measured.

[Startup checkpoint](browser-start-checkpoint.json) and [final handoff state](browser-handoff-state.json) retain the original UI checks and finite outcome. The finite heartbeat is paused after reporting this result. No post-observation Worker check, replacement observation, merge, version allocation or publication occurs. Prior failed/interrupted evidence remains retained.

Investigate the unexplained demo exit/Couch navigation and observer storage failure before scheduling a separately authorized new frozen-source endurance run. Production loading/timing gaps remain as listed above. Physical iPhone/input/audio acceptance and three unfamiliar viewers remain explicitly deferred by the user. This report establishes neither a completed two-hour run nor release qualification.
