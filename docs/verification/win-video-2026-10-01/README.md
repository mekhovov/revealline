# Full-view picture and video rewards — 2026-10-01

Continuing PR #906 with current main merged. Source qualification, not deployment.

## Browser verification

In-app browser, `http://127.0.0.1:8778/game/creator/`:

- Uploaded the actual supplied MP4 and PNG using the file chooser. Native inspection
  decoded 1920×1080 H.264/AAC, about 9.45 seconds. Three poster candidates appeared.
- Selected the supplied PNG under Reveal poster and applied choices. The studio
  generated one mission and included the complete original video.
- Reopened the saved draft, edited name/title/description/credits, generated,
  approved, downloaded `.rlpack`, and installed it in the normal creator UI.
- Played Sky Watch twice through ordinary Start and ArrowDown input. Each legal
  win showed 50% coverage, 3 lives and 11,250 points. Video started automatically;
  after its end the exact poster persisted, without navigation to the menu.
- Used Replay, Pause and Continue. Continue removed the native video and returned
  focus to `next`; the DOM contained zero video nodes afterwards.
- Checked desktop, portrait and short landscape. Whole-video aspect is preserved;
  controls remain reachable. Screenshots show the actual supplied media, not a mock.
- Opened the bundled example through the studio button (portable import path).

Two authoring defects discovered here were fixed: mixed-media drafts disabled
name/credit editing, and reopening a video draft passed extra private inventory
fields into the strict portable asset boundary.

## Automated checks

90 focused tests passed across victory-story UI/dialog, creator video host/player,
media intake/review/campaign, shipped example, persistent win host and confetti.
The shipped-example test reads the actual exported pack, checks exact original
hashes, round-trips private source backup, reopens the bundle, wins through legal
core inputs/replay verification, and prepares its exact video. Native decoders
are modeled in that test; actual decoding/playback was checked above.

Additional checks: 21 creator/draft host tests and all 3 boot/build tests passed.
The boot fixture was updated for main's new access-gate script and stylesheet.
Changed JS ESLint, formatting, localization and whitespace checks passed. The
full build succeeded (2,715 files, version 0.142.4, distribution SHA-256
`b64e18a9cc4ee693adb6f297f72c8dfbe14a0190dafb5df987c575557d09e73f`).
Built app/player/styles/studio/story code, catalogs and sample pack were compared
with final source bytes and match.

## Design references and limits

[MDN autoplay](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay)
and [play()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play)
inform the explicit Play fallback when autoplay is refused. Reduced motion keeps
the still until Play; backgrounding pauses without automatic resume. These extend
the earlier [picture celebration research](../../research/win-picture-celebration-2026-10-01.md).

The earlier soft procedural win cue remains in the ordinary game mixer. The video
retains its own audio and cinematic volume. Output audibility/mix quality has not
been independently measured on speakers. No physical gamepad, iOS or offline
release qualification is claimed. The sample is a studio-installed Social Drone
campaign, not a replacement of the published community edition.
