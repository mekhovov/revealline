# Built-browser qualification — 5 October 2026

Runtime source: `a4d9b96757a467b2771f686b5db614ce9ef51473`, served from the complete
build described by `candidate-build.json`. The later `9e7c03240` change repairs
only the Community test harness; it does not alter these runtime bytes. Source
hashes and hardware context are in `candidate-source.json`.

Local coverage uses a Mac16,7 / Apple M4 Pro, 48 GiB RAM, macOS 26.7.1, AC power,
in-app Chromium reporting Chrome/154.0.0.0, 1280×720 viewport at DPR 2, and the
native fixed 960×540 renderer backing. Default effects and seeded authored cast
are enabled. Observed render cadence is approximately 120 Hz; this record does
not independently certify the physical panel refresh setting. No recording,
build, replay or test process ran during measurement. The user's prior game tab
remained paused. Trials ran one at a time and each began with a fresh page load.

This is **not** the specified Iris Xe/Windows/1080p/60 Hz acceptance, M1 Air
coverage, a physical-controller review, or a human playtest.

## Independent reference trials

Each trial includes its own 30-second warm-up and complete 120-second measurement,
then freezes before the inspection pause. `mac-reference-report.json` validates
three distinct captures, matching settings and full raw interval coverage. All
three are valid and pass the local timing thresholds. None excludes foreground
stalls; all retain 1,500 simulated and 700 visible actors.

| Trial | Rendered frames/s | p95 interval | p99 interval | Frames >33.3 ms |
| ----- | ----------------: | -----------: | -----------: | --------------: |
| 1     |           119.996 |      10.3 ms |      13.5 ms |              0% |
| 2     |           120.000 |       9.8 ms |      10.5 ms |              0% |
| 3     |           120.000 |       9.8 ms |      10.7 ms |              0% |

Raw records are lossless `mac-reference-trial-{1,2,3}.json.gz`; the report hashes
each input. Export pages were read in two bounded DOM chunks to avoid the browser
tool's 200,000-character response truncation; concatenation parsed successfully
before compression. No missing chunk or truncated JSON was accepted as evidence.

## Independent stress trials

The larger workload retains 2,500 simulated and 1,200 visible actors. Three fresh
30+120-second trials also pass, independently validated by `mac-stress-report.json`.

| Trial | Rendered frames/s | p95 interval | p99 interval | Frames >33.3 ms |
| ----- | ----------------: | -----------: | -----------: | --------------: |
| 1     |           120.003 |      10.6 ms |      13.5 ms |              0% |
| 2     |           120.003 |      10.2 ms |      13.2 ms |              0% |
| 3     |           120.002 |      10.3 ms |      13.7 ms |              0% |

Raw records are `mac-stress-trial-{1,2,3}.json.gz`. All six reference/stress runs
use the same built source, default effects, seed and appearance. Stress success
on this Mac does not imply either workload will pass on integrated graphics.

## Soak and lifecycle

`mac-reference-soak.json.gz` retains the complete 30-second warm-up plus
900.004-second measurement. `mac-soak-report.json` binds its checksum and reports
107,997 measured intervals: 119.996 frames/s, p95 10.0 ms, p99 11.1 ms and a
37.6 ms worst frame. That one interval above 33.3 ms remains included (0.000926%).
The run is valid, with no dropped simulation time, interruption or buffer overflow.

All 63 resource observations preserve 1,500 alive, 700 visible/rendered, one
canvas, 5,533,504 atlas bytes and pool capacities of 2,500 enemies, 2,048 pickups
and 512 effects. Sprite allocation reaches 1,837 by the 150-second observation
and stays there through 930 seconds. Browser-reported used JS heap ranges from
44,660,701 to 95,794,161 bytes, starting at 69,068,824 and ending at 66,975,723.
This includes diagnostic buffers and garbage-collection variation; it is neither
total graphics memory nor proof against every possible leak.

A separate fresh lifecycle run invoked the native real WebGL recovery control.
The browser logged one loss and one restoration, displayed “Graphics restored.
Resume when ready.” and stayed paused until explicit Continue. Time advanced
after that action. Ten native Retry actions each retained one renderer canvas;
the first and last inspected appearance identities match. No browser errors were
reported. See `lifecycle-browser.json`. This is functional evidence, not another
timing trial. Two DOM automation clicks did not reach the raw-inspection control;
the visible control succeeded with the supported native coordinate action. The
record does not infer an application failure from those automation attempts.

## Fresh-origin offline installation

On `localhost:8884`, previously unused for this review, the ordinary Downloads
page installed only **Solo Starter**, with no optional soundtrack or authoring
selection. The UI reported “Solo starter ready offline” and verified completion.
The dedicated build server was stopped and a separate HTTP probe failed to
connect before the first visit to `/game/overflight/play.html` on that origin.

Overflight prepared its native scene and entered ordinary combat without browser
errors. At 00:18 it reached an earned upgrade; its Now → Next card diagrams rendered
offline. `offline-browser.json`, `offline-ready.png` and `offline-upgrade.png`
retain the sequence and visible result. The server was restarted only afterward
to leave a usable review URL. This demonstrates local service-worker installation
and native play, not a full offline sortie, desktop app installer, soundtrack
download, authenticated Community publication or hosted release.

## Remaining external review

Iris Xe/Windows/1080p/60 Hz and M1 Air Chrome/Safari, physical standard/remapped
gamepad/radio behavior, five players including two newcomers, and full-interface
contrasting-build recordings remain open. The native canvas recorder produced a
clip in memory, but its Blob download timed out in the browser tool; no saved
video is claimed. See `device-review.md` for the reproducible device/player packet.
