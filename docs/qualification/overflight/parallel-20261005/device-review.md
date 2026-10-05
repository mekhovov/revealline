# Device and player review packet

Use the current candidate after its source is frozen; attach its Git revision and
source receipt to every device record. Local M4 Pro observations do not qualify
the Iris Xe or M1 Air targets.

## Target-device protocol

Primary: i5-1135G7 / Iris Xe, 16 GB RAM, Windows 11, current Chrome, 1080p viewport,
60 Hz display. Additional coverage: M1 Air with Chrome and Safari.

Record exact CPU/GPU, RAM, OS/browser version, display refresh, viewport and backing
resolution, device pixel ratio, mains/battery and power mode, effects setting,
seed, project/appearance identities, and other foreground workload. Keep the tab
active and close competing gameplay/recording tabs. Do not record video during
measurement. Unexpected foreground stalls stay in the result.

Serve the checked-out candidate with the repository server. For each fresh trial,
open the following suffix, press Start through the native briefing, leave the
fixture running and download the automatically frozen measurement:

1. `game/overflight/play.html?fixture=reference&trial=1&diagnostics=1`
2. `game/overflight/play.html?fixture=reference&trial=2&diagnostics=1`
3. `game/overflight/play.html?fixture=reference&trial=3&diagnostics=1`

Each page has its own 30-second warm-up and 120-second measurement. Close it before
opening the next. Repeat for `fixture=stress`. Never relabel windows of one run as
separate trials. Pause/focus/context interruptions invalidate an unfinished trial;
start a fresh trial instead. The reference preserves 1,500 simulated/700 visible
enemies; the stress fixture preserves 2,500/1,200.

Summarize raw downloads (JSON or gzip):

```sh
node scripts/report-overflight-trials.mjs trial-1.json trial-2.json trial-3.json --out device-reference.json
```

Reference gates: average at least 59 rendered frames/s, frame p95 at most 18 ms,
p99 at most 33.3 ms, and fewer than 1% of frames above 33.3 ms. The report checks
raw completed-render intervals, matching populations, same seed/settings and
interruption flags. Hardware identity and source provenance remain review inputs.
Stress results are reported separately; stress failure must not be presented as a
reference pass or hidden through actor sampling.

For the resource soak use `?fixture=reference&trial=soak&diagnostics=1` (30-second
warm-up plus 15 minutes). It records owned sprite allocations, one renderer
canvas, atlas bytes, pool capacities, context events and browser heap observations
where the browser exposes them. Assess bounded owned resources and trends after
warm-up; browser JS heap is not total GPU/process memory. Safari may omit heap
fields. Save raw data before separate ten-retry and actual WebGL recovery checks.
After recovery, the run must remain paused until explicit Resume.

## Physical controls

Use a standard gamepad and one saved remap. Verify analog flight, dash on the
intended binding, menu navigation, unplug/reconnect, neutral release after cards,
and no dash from the confirmation press. Raw devices require the existing
explicit radio profile; an unknown raw device must not silently steer.

## Five-player formative review

Recruit five players, including at least two newcomers. Each completes two runs:
one pulse build and one different build without pulse. Counterbalance the order.
Use ordinary play; automated review pilots are examples, not participant results.
Retain anonymous notes rather than names or recordings of participants.

For each player record newcomer/experienced, device/input, seed, choices, outcome,
first damage and confusion points. Before confirming a card, ask what the picture
suggests it will do. Afterward, ask what changed in their route and why they chose
that upgrade. Observe rather than explain unless they are stuck. Ask which damage
source ended the run and which gaps felt escapable. Check EN/UK, reduced effects
and text size where applicable.

| Player | Experience | Run order | Diagram prediction | Route change | Damage clarity | Repeated problem |
| --- | --- | --- | --- | --- | --- | --- |
| P1 | | | | | | |
| P2 | | | | | | |
| P3 | | | | | | |
| P4 | | | | | | |
| P5 | | | | | | |

No participant acceptance is recorded in this blank worksheet. Resolve recurring
confusion before A approval. Full-interface combat → card → combat recordings
must be captured separately from benchmarks; canvas-only clips omit HUD/cards.
C / Рій stays gated on accepted A gameplay and shared foundation, not publication.
