# e1cc transition and lifecycle observations — 2026-10-17

The six Next observations failed: two stopped at CPU calibration admission, two exceeded the unchanged 100 ms keyboard-operation deadline during the first victory, and two automatically paused at tick zero. No manual Next transition completed. Both separately declared Chromium lifecycle observations passed their correctness and strict native-replay checks. Darwin ownership preflight failed; its dependent Cocoa observation was skipped. None of these observations qualifies performance or physical-device behavior.

All three workflows used tooling `7c7cc2648331870683ac7b76850bbeff859f802e` and attempt 1. The game observations used the independently admitted [e1cc package](solo-artifact-e1cc5dd76.md), source `e1cc5dd7656bab349715cd1c3ce6e9f783508c17`, tree `58f19392e25384620d896098fce8616b538e318d`. Historical declarations and failures remain unchanged.

## Six Next failures

[Run 39044567236](https://github.com/mekhovov/revealline/actions/runs/39044567236) completed with six failed jobs. Every candidate passed archive/source/CSP setup. Chromium r1/r3 rejected fresh mid calibration as unstable or off target before starting a route. Their actual factors were 2.52/2.53; neither is admitted gameplay evidence.

Chromium r2 (verified factor 2.42) and WebKit r2 (factor 1) both failed while awaiting the native **ArrowDown keyup** after the original 3,908 ms hold. The first mission had reached victory. The partial recordings reconstruct their own state exactly, but fail the declared final `second-landing` identity: they remain failed first-mission observations, not completed cohort correctness.

| Retained boundary                     |       Chromium r2 |     WebKit r2 |
| ------------------------------------- | ----------------: | ------------: |
| Capture/victory accepted, document ms |          26,521.6 |        28,976 |
| Terminal work begin/end, document ms  | 26,532.1–26,611.6 | 28,979–29,058 |
| Terminal work duration                |           79.5 ms |         79 ms |
| Same callback update / draw           |    102.2 / 1.3 ms |    150 / 1 ms |
| HUD / simulation within that update   |        6.4 / 5 ms |     64 / 3 ms |
| Phaser PRE_STEP–POST_RENDER window    |          106.7 ms |        151 ms |
| Partial replay ticks / moving ticks   |         646 / 639 |     632 / 632 |

HUD and simulation are contained in update and must not be added to it again. The Chromium journal also retains a 137 ms native task overlapping that callback. WebKit native long-task observation is unavailable. Node action wall times plus the document time origin place keyup invocation inside these windows, but there is no explicit cross-process clock bridge or retained DOM key-delivery timestamp. The record preserves the timeout; later promise settlement does not retroactively pass the deadline. These observations locate a first-victory cost without identifying its expensive function.

WebKit r1/r3 both recorded the public long-frame interruption warning, one interruption of 304/293 ms, zero simulation time and zero replay ticks. Their first active callbacks measured only 6/8 ms. The next long interval preceded a 245/219 ms Phaser window, including update 242/217 ms and HUD 14/15 ms, ending in Pause. The scene clock intentionally makes its first active sample neutral; the next interrupted sample pauses before simulation. Therefore the expensive pause callback cannot be assigned as the cause of the preceding interval. Browser/render/scheduler/observer attribution remains unresolved. No page errors, failed responses, visibility/focus journal events or harness-induced pause were recorded in these four partial attempts.

All six ZIPs passed complete CRC/member-size/SHA readback; all 25 retained command receipts closed without forced cleanup, ambiguity, violations or survivors. The four binary journals independently passed hash, count, sequence and threshold checks. No deadlines, input routes or failed verdicts were changed and no rerun was issued.

- Full terminal/owner/journal analysis: `.cache/solo-followup/e1cc-native-outcomes/next-terminal-analysis.json`, 111,537 bytes, SHA-256 `635a8a985b32a8307d4d748e4a9117e845cc9e2cee8d348349868dfd231db940`.
- Additive paused application-marker readback: `next-app-marker-analysis.json` in that directory, 16,699 bytes, SHA-256 `c22b2843b3b801eaebc928394bc77a9b5d63ea62e24afa14bbab9405408697ec`.
- A local reserve refusal for artifact 12105432364 remains separately retained; its later ZIP-only retention used a fresh output directory after disk space recovered.

## Two observed Chromium lifecycle passes

[Run 39044567203](https://github.com/mekhovov/revealline/actions/runs/39044567203) passed both jobs. ZIP-only readback independently reran the complete adapter assessment and explicit background/hidden-preparation/replay proofs against the actual source/package identities.

The running-background case paused at tick 22, checkpoint `59e94a42fe0e7123`. That checkpoint remained unchanged through 10 seconds hidden and a further 515 ms visible before explicit Resume. The final 88-tick recording, including 82 moving ticks, matched checkpoint `dc901d80b108b91a` before and after public export.

The preparation-hidden case observed the actual busy selected font, then released its verified bytes only after trusted native hiding. Preparation completed while hidden; tick zero/checkpoint `ee88022bdea7907c` remained unchanged through the hidden interval and a further 511 ms visible before explicit Start. The final 75-tick recording, including 14 moving ticks, matched checkpoint `b8b68dfd1ef56dcb`. The font owner completed with zero pending operations, owned routes or owned responses.

Both cases retained the original bounded clock/movement checks, exact default-context connection, graceful browser exit and clean command ownership. These are single observed Chromium correctness cases; WebKit background behavior and physical-device behavior remain unobserved, and performance is excluded.

- Background artifact 12105332476: 277,759 bytes, SHA-256 `a7b3c23c40bb3a37568ab00d8294b77216222727bdfab8a545c68133a85d71ec`.
- Hidden-preparation artifact 12104604494: 281,116 bytes, SHA-256 `1c2afb144f10ddf2414ecc4f92caec40c8f0f82e13d7e9d8631efa20981be9c9`.
- Independent proof/member inventory: `.cache/solo-followup/e1cc-native-outcomes/lifecycle/independent-readback.json`, 26,167 bytes, SHA-256 `f2b4c3e9ba848cdafb42c6d289d3e241b86ad059b1c17525e3e7b9f07c4d79e6`.

## Darwin remains failed; Cocoa unavailable

[Run 39044567305](https://github.com/mekhovov/revealline/actions/runs/39044567305) passed the single-leader owner case, then failed the process-tree case with `unattributed-new-browser` and forced cleanup. The owned leaf received SIGTERM; the resulting branch/parent failure and absent terminal tree file are retained. The deadline case was withheld and Cocoa was skipped.

The final ambiguity list is empty because subsequent cleanup samples overwrote the live list. The triggering foreign/ambiguous row was not retained, so these bytes cannot identify it as `/bin/ps` or any particular browser. A separately reviewed first-witness retention correction preserves future evidence; it does not weaken classification, signal authority or the failed result.

Artifact 12105456779 is 10,800 bytes, SHA-256 `1e61c61c19ac634da8f2c534e20a3b03e6c940f1190bbf4e2ff154016b2b37cd`. The independent terminal/source assessment is `.cache/solo-followup/e1cc-native-outcomes/darwin/terminal-analysis.json`, 6,536 bytes, SHA-256 `7f42477bfd287aee6657853c9be66ac94fdbc029f6f012dabbf240ad287c4fb2`. Original ZIPs, APIs, inventories, failed rows and the lost-witness limitation remain available; no unchanged retry was launched.
