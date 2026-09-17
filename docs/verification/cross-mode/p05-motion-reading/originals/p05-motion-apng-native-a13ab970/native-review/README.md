# Motion APNG retest handoff

**The scoped retest supports the APNG default-poster correction.** These are the parent’s native observations in `root-native-observations.json` (Codex in-app browser, temporary 768×900 viewport), independently linked to exact served source bytes and retained originals; this reviewer did not operate the browser or claim a new playtest.

All 151 recorded HTTP responses (2,698,221 bytes) match: 141 exact-a13 Git bodies and all ten pinned candidate runtime overlays. There were 151 status-200 rows, no faults and no hash mismatch. Only 2,550,419 Git bytes were read, one body at a time, with a 1 MiB per-body and 4 MiB total admission bound. The largest was 970,634 bytes. The frozen build-info remains pinned but was not requested in this Motion-only session. The audit verifies server-recorded bodies against source; it is not a browser network capture.

The original 21 preparation files and retained predecessor/fixture pins remain unchanged. Fourteen browser originals totaling 468,077 bytes are pinned in `browser-original-pins.json`. Neither the old blue-APNG failure nor the candidate files were rewritten.

| Native observation reported by root | Evidence and scope |
|---|---|
| Static red control and APNG red default under the same retro palette, Cover at 70%, Large text | `static-control.*`, `apng-loaded.ax.txt`, `apng-default-red.png`; APNG status explicitly reports “Static PNG default preview.” |
| Standard → Large redraw; Play, moving craft, travel 9.0 / W heading, red poster; Pause | `reading-redraw.ax.json`, `running.ax.txt`, `running-red-poster.png`, `invalid-upload.ax.json`; root observed longer than a fixture animation cycle. Discrete screenshots do not prove every frame. |
| Invalid 8-byte PNG retained the preceding red APNG | `invalid-upload.ax.json`, `invalid-retains-red.png`; preparation error is explicit. |
| GIF and WebP uploaded and appeared red | Their respective AX and PNG originals; only these fixtures and observed redraws are covered. |
| Clear removed the background and disabled itself | `clear.ax.txt`; original local fixture bytes still match their pins. |

Effective shared/system reduced effects remained active although the local checkbox was off. **No full-effects native pass is claimed.** Controlled pending-read/decode races retain modeled coverage only. Cross-browser, physical devices/controllers, actual BFcache, full zoom/text combinations, continuous frame capture, performance and whole-phase/public acceptance remain separate.

The old `p05-motion-native-a13ab970/browser/apng-blue-default.png` and associated report remain the historical failed observation. Its Turn policy locator concern was separately resolved by `label-lookup-review.json`: the wrapping label is valid; the locator failure alone does not establish an accessibility defect.

Root reports closing tab 38, resetting the viewport and stopping its verified PID 45380 with SIGINT (session exit 130). `root-stop.json` and `root-native-observations.json` are pinned as the retained cleanup records. No new server/browser/test/build/source/index/remote action occurred during this audit. `coverage.json` records the finite scope and outstanding boundaries; `request-byte-audit.json` lists all exact comparisons.
