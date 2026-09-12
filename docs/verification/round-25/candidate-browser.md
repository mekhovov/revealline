# v0.15 packaged candidate

Checked 12 September 2026 on isolated port 8831, serving `.cache/round-25/candidate` under the CLI's production policy. The build is **v0.15.0-rc1**, with 131 manifest assets and distribution SHA256 `6bb69e1bf087e0c12f8ccaaebadbe89dcd1b33a6c25a3ddc42a2e9b5449edfff`. Its `sourceRevision:null` correctly identifies a working-tree candidate rather than a frozen tag.

Landing, solo play, Playground, couch race, Replay Theater and Controller Lab loaded. All six pages returned empty error/warning logs after the following checks:

- Playground's actual 1280×720, 844×390 and 320×640 solo previews each captured eleven visible flight targets at least 44×44, with no target intersections, no target/arena intersections and no horizontal page overflow. [Exact geometry](candidate-geometry.json). After switching to Couch preview, Capture geometry reported that a solo preview is required and cleared the old report; it did not present stale solo measurements as couch evidence.
- A real solo Grid + buffer First Signal attempt completed through Tap steering at 52.2%, three lives, 8,160 points and HUD 0:03, with its full-picture celebration.
- A fresh couch round used Tap controls and Player one Down. Sunflower won the round by first clear at 52.2%, three lives and 8,160 points, with 1:27 remaining. Skyline stayed at zero coverage/score and three lives. Next round and both independent control groups remained available. This is a software check with one side idle, not a two-human balance test.
- Replay Theater verified its default Copper Crossing example at 1,305 exact ticks and enabled playback. No additional full Theater playback is claimed in this candidate pass.

The [source browser report](source-browser.md) separately covers the larger responsive matrix, maximum-length labels, keyboard hint adoption, controller reading/Retry, ordinary wins in both policies and a staged saved-prefix completion. The candidate checks do not certify physical touch/controllers, native packages, public deployment, audio listening, text zoom or player retention. Frozen/offline checks follow as a separate record.
