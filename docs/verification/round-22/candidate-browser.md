# Round 22 packaged candidate

Checked 12 September 2026 at isolated port 8822, served by the CLI from `.cache/round-22/candidate`. This working-tree build identifies `sourceRevision: null`; it is not the frozen Git artifact. Its build reports 126 assets and distribution SHA256 `af2e6d3510347dfcb7c0ea0665c3ef5c742026edd3ce1224614d98de301c5cf3`.

The generated landing page, solo game, Controller Lab, Playground, couch race and Replay Theater loaded under the build server's production CSP. Error/warning logs were empty for all six pages. Theater finished verifying its default Copper Crossing recording and enabled playback with 1,305 exact ticks. This is a load/verification check, not another completed Theater playback.

Both Immediate and Grid + buffer completed a real First Signal run through visible Tap steering. Each run entered Read mission brief during a live cut, paused, exited through Done, explicitly resumed and closed the cut. Both finished at 52.2%, three lives, 0:03 and 8,160 points. [Recorded visible results](candidate-wins.json). Reload retained one First Signal picture at gold/8,160 and the earned first-clear appearances; the next campaign mission was ready.

In packaged Controller Lab, selected The patient route and its measured 320×640 frame. Joined the virtual controller, entered the full brief, and held Down for seven seconds. The final paragraph and facts were visible with an end-of-details hint. Done returned focus to Read mission brief, while the mission remained ready. [Candidate reader](screenshots/candidate-reader-end.jpg). Its error/warning log remained empty.

The separate [source checks](source-browser.md) cover remaps, other viewports, native input handoff and diagnosed layout/focus fixes. No physical device, public host, native binary, audio listening, online service or player-retention outcome is certified here. Frozen/offline checks follow separately after tagging.
