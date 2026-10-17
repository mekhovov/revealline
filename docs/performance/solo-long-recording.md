# Long recordings and saved-flight reload

This follow-up for [PR #1544](https://github.com/mekhovov/revealline/pull/1544) adds an opt-in public-export comparison to the existing qualification runner. It does not change gameplay, recording limits, save formats or ordinary qualification scenarios.

The real-time recipe plays one unfinished First Return flight for at least 29 minutes, pauses, exports its recording, reloads the page, loads the saved flight through the normal control and exports again while paused. The two exports must have identical bytes and hashes. Strict replay verification still checks the restored recording against the declared mission and browser engine. The witness retains at most two scalar identities and hashes exports only at paused boundaries.

The 29-minute duration leaves 7,200 simulation ticks below the existing 216,000-tick recording limit. A separate 30-minute capture/Retry soak tests sustained gameplay; it cannot substitute for one continuous recording. The earlier 30-minute continuous-recording proposal was rejected before execution because reaching the recording limit would discard the recorder before its final export. No production limit was increased.

## Evidence and limits

The full deterministic rehearsal on Node 22.22.2 passed at the unchanged `a5106a7cc` runtime. It reconstructed the exact authored Opening mission, simulated all 208,800 ticks with 1,739 moving direction changes, retained all three lives and restored an identical exported recording and authoritative checkpoint. The saved session used 228,126 bytes of the unchanged 2,097,152-byte local budget. The bounded process closed normally with approximately 164 MB peak resident memory.

The rehearsal receipt is `.cache/solo-followup/remote-long-recording-followup-01/model-control-01/receipt.json`, SHA-256 `0350720d4d49fe3c24fa93ccefedb0097bab3cde6e6394b5bd147ce4df888e65`. This is a fast model check, not 29 minutes of browser observation or evidence of device performance. The browser recipe SHA-256 is `5ffad85e4dc752ea3e8bcf236f88e65c09875d58ac339c096890c0b6f2133150`.

The integrated qualification and identity tests pass 45/45. A subsequent schema check rejects an extra reload hidden inside a repeated action; all six identity cases pass after that correction. Scoped lint and formatting pass. None of these checks launches a browser.

The hosted continuation retains three baseline/candidate pairs per engine, the existing process owner and calibrated Chromium method, a 40-minute scenario limit and a 44-minute per-arm limit. It remains unreleased until the preceding correctness and sustained phases are closed and reviewed. Its timing assessment must use the snapshot from before reload; the new document's reset counters cannot replace the long recording window.

Exact public export equality after page reload demonstrates recording survival through ordinary saved-flight loading. It does not identify which of Pause, export or page exit completed the save, and does not prove browser restart, offline launch, operating-system flush or power-loss durability. Those remain separate checks.

The proposed save-readback shortcut has since been evaluated and declined. Its safe variant passes eight mutation/corruption controls, but the two fixed local kernel medians improve only 16.84% and 17.04%, below the predeclared 20% engineering floor. The raw-byte-only variant could miss mutation of the intended session and was rejected. No save validation or durability check was removed. These standalone kernel results do not replace the still-pending native 29-minute saved-flight observation; [the current plan](solo-performance-followup-plan.md) retains that gate.
