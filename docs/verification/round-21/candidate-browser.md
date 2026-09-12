# Round 21 packaged browser check

Checked the working-tree **v0.11.0-rc1** build on 12 September 2026 at the separately owned `http://127.0.0.1:8819/` origin. The CLI served the actual distribution with its production content-security policy. The user workspace server on 8767 was not stopped or reconfigured.

The builder reported 124 manifest assets and ZIP SHA-256 `7d3c842f1d1f719ce0ae8c58676838876dd55ddfce1b180031a959d412477284`. Its source revision is null because this candidate precedes the Git freeze. All 295 [final tested inputs](source-inputs.json) were rehashed after building and still matched aggregate `3aed055469e7a9b345e7d9a89b42646fa44be634cb7225cfebd9dbfc0894edfb`.

## Player and rewards

- Opened the release game and installed Sentinel Relay through the normal Expansion packs button. All six bundled install choices were present.
- Imported the unchanged public-API, replay-backed Immediate ordinary-finish prefix through Save JSON. Enabled Tap steering, resumed, and pressed Left. This exercised the last 24 recorded simulation ticks through live UI controls, not a fresh full manual route.
- Won at 100%, three lives, 16,640 points and gold in approximately 15 recorded seconds. The phase said CORE RELEASED, with the timed-release explanation. The result offered the completed campaign, picture view, retry and appearance choice.
- View picture exposed the full original scene and retained the new-appearance notice below the board. [Captured picture](screenshots/candidate-picture.jpg), visually inspected.
- After a page reload the library retained one picture, one campaign result, one local score and no optional equipment seals. Normal player-library export was 1,690 bytes, SHA-256 `ae54a51e3bdfa56e7a92d462634830f8b24947b2fce7c790ed3e2204e8791205`.

## Other shipped pages

The packaged Playground loaded Sentinel. Export scenario retained copyable `xonix-playground.v3` JSON (6,346 characters) in the opened field. Export loaded library replaced that field with `xonix-pack-library.v1`, containing the one loaded pack. The map-expansion export had already been checked against the same source in the [source browser report](source-browser.md).

The packaged couch page offered the installed Sentinel map. Starting and pausing a round showed independent, matching paused stage-1 cues at 1.8 seconds on both boards. The full fresh-board couch win and narrow layout observations remain separately recorded in the source report; this short packaged check is not another full round.

Replay Theater imported the standalone verified Scout v4 recording through its JSON field and played at 2× through all 1,792 ticks. It reached checkpoint `74178fe96a758d82`, with 100% coverage, three lives, 16,640 recorded points, CORE RELEASED and “No progress awarded.” Its existing Fieldcraft options remained available.

Error/warning samples from solo, Playground, couch and Theater were empty. There were no observed missing-script or CSP failures. These checks establish the identified local candidate's browser paths. The frozen archive/rebuild and offline shutdown/reopen checks follow separately; physical devices, hardware controllers, listening quality, native execution, public hosting and player enjoyment are not certified here.
