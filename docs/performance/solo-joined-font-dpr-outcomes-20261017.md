# Joined-font cancellation and display-density outcomes

Run [39037875095](https://github.com/mekhovov/revealline/actions/runs/39037875095) completed with failures on both jobs. It used the verified **c696** production package (producer 39028705715, artifact 12100662115) and **e1cc** diagnostic tools. This is the pre-layout-fix application source; it provides no evidence for the later preparation-layout changes or an iPhone. All six command owners closed without a forced cleanup, ambiguity or surviving owned process. Both jobs admitted the complete candidate archive, source identity and CSP before their browser observations.

The declared Full display-density comparison failed: every active observation submitted **Reduced**, despite the actual public Full preference being selected. The four completed workloads remain useful exploratory observations at their actual tier. Neither their numerical failures nor the failed Full declaration is promoted to a pass.

## Font cancellation

Both font rows reached the public pending preparation state, delivered trusted Escape, and never reached first running. Their early microtask records reported `busy` and `defaultPrevented: false`; those records do not establish that the application remained busy after native event dispatch completed. Chromium then failed the expected cancelled-state check. WebKit failed the earlier requirement that `FontFaceSet.check()` return false; it returned true while the exact selected-font requests remained held. The old checks and failures remain unchanged. That API can return true without a matching downloadable face, so it does not establish successful loading by itself ([CSS Font Loading specification](https://www.w3.org/TR/css-font-loading/#font-face-set-check), [MDN](https://developer.mozilla.org/en-US/docs/Web/API/FontFaceSet/check)).

Chromium observed one matching GET and WebKit two matching GETs. Each owner fetched and verified the original 38,120-byte font once (SHA-256 `4797c11d5e17c3f5f9b5b3fa96efb4fd2aabb877fb4d625dfc8eb7465464e145`); WebKit's second browser request joined that same response. Neither row released the font to the page. All held routes were actually aborted, the response was disposed, and no owned or pending routes remained. There is no active-window, cancellation-correctness or subsequent replay proof from these failed rows.

An exact c696 JavaScript source model of public Start → early Escape → release → explicit Start passes: Escape is claimed, the Start attempt is cancelled, and shared theme work completing later does not start play. Source inspection establishes that the diagnostic installs its document capture listener before the application controller and queues the old completion snapshot from that listener. Native callback cleanup can run that microtask before the later application listener; a synthetic dispatch called from JavaScript can instead keep the calling script on the stack until both listeners finish. This is a demonstrated observation-design gap, consistent with the [HTML callback and script cleanup rules](https://html.spec.whatwg.org/multipage/webappapis.html#clean-up-after-running-callback) and the [native-versus-script dispatch example](https://jakearchibald.com/2015/tasks-microtasks-queues-and-schedules/). Its role in these particular native failures remains an inference until a fresh post-command witness is observed.

The held V3 diagnostic retains the early records, then reads the current state immediately after the existing awaited Escape command, without an added dwell. It also records bounded focus, source-derived root, HUD visibility and actual matching font faces. V1/V2 assessments and failures stay unchanged. No runtime correction or successor observation has been released from this evidence.

## Display-density observations

The fixed order was DPR **1, 3, 3, 1**, with the same WebKit 400 × 850 CSS viewport, public Full preference, muted audio at volume 0.8, CPU multiplier 1 and external baseline B = 16 ms. The selected Full preference permits the application's adaptive reduction. Every pre-Start artwork-ready snapshot already showed Reduced; all submitted active frames remained Reduced. The records do not locate the exact earlier downgrade. Foreground title sampling can inform adaptation, and accepting a preparation baseline does not reset the selected level. No policy reset was introduced to satisfy the invalid Full comparison.

| Arm           | Actual tier | App-work p95 | Miss rate | Fully active intervals ≥ 50 ms | Largest fully active interval |
| ------------- | ----------- | ------------ | --------- | ------------------------------ | ----------------------------- |
| Pair 1, DPR 1 | Reduced     | 3 ms         | 3.109%    | 0                              | 37 ms                         |
| Pair 1, DPR 3 | Reduced     | 3 ms         | 14.875%   | 3                              | 62 ms                         |
| Pair 2, DPR 3 | Reduced     | 4 ms         | 21.084%   | 2                              | 63 ms                         |
| Pair 2, DPR 1 | Reduced     | 3 ms         | 4.049%    | 0                              | 36 ms                         |

All four public workloads and strict native replay checks completed. Their binary journals are complete, and each row retains its original numerical **failure** and separate declared-tier **failure**. No fully active interval reached 100 ms in these four roughly 30-second windows. The table uses fully running-to-running callback intervals, excluding preparation and pause-crossing intervals. App work includes the synchronous Phaser submission; asynchronous raster/compositor cost is unobserved.

The displayed Phaser canvas and detached board each retained **1152 × 576 backing attributes in all four arms**. Theoretical viewport pixel counts are 340,000 at DPR 1 and 3,060,000 at DPR 3, but these are not measurements of native allocation. The DPR 3 rows had worse callback delivery with similarly small measured app work. Because the declared tier condition failed, this is a limited exploratory contrast, not a fixed-Full comparison, GPU attribution, physical-device result or performance qualification. These rows used Linux Playwright WebKit 26.5; the actual native port/backend and graphics-capability details were not observed by this diagnostic. The prior desktop-sized first-eight observation also differs in viewport, layout, density and workload and cannot isolate the cause.

## Retained authority

The terminal analysis re-read report, summary, bound plan, source/archive proof and binary-journal bytes against the retained member inventories. The ZIPs, member inventories and all failed/partial observations remain available:

| Artifact             | Archive bytes | Archive SHA-256                                                    |
| -------------------- | ------------- | ------------------------------------------------------------------ |
| Chromium 12103500230 | 294,015       | `2a0fb76a15b7356cbe76a1cd52f28daa256f92ae5606d538ccd53503e2f9dc60` |
| WebKit 12102903190   | 471,317       | `58e1d9bc450f0a08f6853946d1c90c8082114cb5fd26c471b05e1321d4fed22c` |

The compact authoritative analysis is `.cache/solo-followup/readiness-joined-c696-observations/terminal-analysis.json`, 142,543 bytes, SHA-256 `5ef63d74643ee09ad3aad680a4b4f1a66bb9c4796e9f5adbf76f51ca89076ba3`; its receipt is adjacent. Archive member totals are 31 for Chromium and 51 for WebKit. Local retention is selected diagnostic evidence, not a local download of the complete production package. Historical release declarations and their failed native outcomes remain immutable.
