# Native Library export placement defect

**DEFECT CONFIRMED** on the published v0.57.0 frozen game, not a v0.57.1 acceptance pass. Library module, backup-set module, shared legacy stylesheet and the complete Library HTML fragment are byte-identical between public b7db013 and committed patch source 4c85277. `public-identity.json` records the actual browser URL/build metadata and fetched Library body hash.

| Native viewport | Visible export button | Actual busy status | Actual active Cancel/Stop | Terminal status |
| --- | --- | --- | --- | --- |
| 390 × 844 | y563.188–607.188 | y1689.375–1743.375 | y111.297–155.297, visible, 44px | y1625.375–1841.375, offscreen |
| 844 × 390 | y172.641–216.641 | y945.828–972.828 | y−189.953–−145.953, offscreen, 44px | y945.828–1053.828, offscreen |

The original screenshots show the native view before and after each export. The original event log records trusted activation and real read, verify, download and terminal phases. The operations lasted about 150ms; no claim is made that the screenshots capture busy frames or that each short phase painted separately. Both browser downloads completed at 799 bytes. The same destination was reused by Chrome, so only the second original file remains; the first original completion event remains in the log.

Native navigation used Workshop → Scores & saves → Saves & loads, followed by focus and Enter on the visible export action. No Solo play was necessary. No fake state, delay, API patch, CSS change, offline preparation or bulk import was used. Focus could scroll before action; no driver scroll occurred after activation. In landscape Chrome scroll anchoring changed dialog scrollTop 250→314→250 when the header cancel appeared/disappeared, while the export button stayed in place. The result stayed below the viewport and the escape control stayed above it.

Attempt 1 was stopped before export by the own-profile 40MiB capacity guard after background OptimizationGuide model downloads. A detected post-death CLI fallback about:blank was closed and excluded. The explicitly authorized same-profile second attempt disabled background model downloads, guarded the exact live PID and WebSocket around every CLI action, and stayed within the 60MiB cap. The lowest projected free space after remaining artifact bytes, future profile headroom and 16MiB evidence/package allowance was 541,360,116 bytes, above the 536,870,912-byte reserve.

The first copied close helper refused its different allowed-profile suffix before action; the corrected helper changed only that exact owned-profile guard. Browser.close then succeeded, the Chrome and observer exited 0, and both owned browser ports/PIDs are confirmed closed. No profile/cache is included in the explicit evidence manifest.

This is a required P01 visibility/recovery correction. Shared presentation tests do not make an offscreen host visible. A separate cache-only proposal will keep active Library feedback and its actual cancel control together without changing operation ownership or forcing scroll. Source, Git, releases and public bytes remain untouched.
