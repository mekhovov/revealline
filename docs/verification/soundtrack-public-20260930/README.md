# Public soundtrack acceptance — 30 September 2026

## Released scope and source

Game PR [#830](https://github.com/mekhovov/revealline/pull/830) merged at
`ef997643d1cd84cf93282feaf6f83815ae0ad8d7` on 2026-09-30 at 08:56:04 UTC.
Its six additions are Retroracing Nightlife, Agony Space-deep, God of Darkness,
Suffocation, Pixel Damnation and Revenge's Waiting. The resulting trusted catalogue
has 77 recordings, preserving all previous 71. Revenge's Waiting is a short boss
cue; none of these licensed additions count toward the paused 36 originals.

At 16:30:11 UTC, the public root `release.json` identified accepted source
`908bc6b08d1999edafa79d1581d2bab9395285b7`, build `main-908bc6b08d19`.
[Pages run 36742307201](https://github.com/mekhovov/revealline/actions/runs/36742307201)
passed build, deploy and public verification. Public catalogue JSON and JavaScript
match the corresponding files at that accepted main.

PR #830's exact-source run
[36691759770](https://github.com/mekhovov/revealline/actions/runs/36691759770)
passed preflight, focused tests and the release-ready gate. Broad test/build jobs
were skipped under the active release policy, not passed. Company candidate
[36691759930](https://github.com/mekhovov/revealline/actions/runs/36691759930)
passed candidate and optional-practice jobs; default-capacity was cancelled.
Original merged-source Pages
[36692834575](https://github.com/mekhovov/revealline/actions/runs/36692834575)
also passed. Earlier blocked production-review evidence remains unchanged in
`../approved-synth-metal-20260930/review.json`. The shared provenance gap remains
tracked by [issue #813](https://github.com/mekhovov/revealline/issues/813).

## Public delivery checks

| Resource                    | HTTP / bytes  | SHA-256                                                            |
| --------------------------- | ------------- | ------------------------------------------------------------------ |
| Root `release.json`         | 200 / 308     | `51987fde9f145970a9d3af654483347f8eff9ccd5ba729aa29ee934f588936bf` |
| Game catalogue JSON         | 200 / 139,446 | `d785175d3bbf1979715745eeb2d80210a095c84173a55de1b30f079701c53794` |
| Game catalogue JavaScript   | 200 / 148,255 | `5fa28b6718f0b1963a4b45ca7cb476b077d617a4e891297516538d9e91c3bcb6` |
| Archive admission inventory | 200 / 1,607   | `64f0e2ac28718af710fc20702519dfa171fe4020a56037242795027c8f1d5caa` |

The immutable inventory is
[`admissions/approved-synth-metal-20260930.json`](https://mekhovov.github.io/revealline-soundtracks/admissions/approved-synth-metal-20260930.json).
All six admitted MP3 paths returned `206`, the requested first 16 bytes, valid
Content-Range totals and `Access-Control-Allow-Origin: *`, with `audio/mp3` MIME.
Their total byte counts were 5,199,456 / 9,048,860 / 6,281,970 / 6,880,488 /
4,302,515 / 1,538,133, respectively in the track order above. This was a range
availability check; full native hash/decode/measurement evidence remains in the
admission inputs and was not replaced by a range request.

## Browser observations and limits

The following transport actions used an already-open public `/game/` page loaded
from source `53444e0f7ab4` in the desktop in-app browser. They precede the
908bc6 HTTP receipt above; they must not be relabelled as an exact908 transport
run. The new catalogue admissions were already present in both sources:

- Audio displayed Previous, Play/Pause, Next and the ten visible style choices.
- Music library & playlists displayed both new approved albums.
- Selecting Synthwave & Electro — approved reached Retroracing Nightlife at
  playing 0:14 / 2:42. Selecting Metal — approved reached Pixel Damnation at
  playing 0:17 / 2:14.
- Pause followed by Next selected Suffocation at paused 0:00 / 3:35. Previous
  selected Pixel Damnation while remaining paused. Play resumed its clock.
- Quick Next selected other Metal tracks, including Revenge's Waiting. Returning
  to selected-style Ukrainian restored bundled Carol of the Bells. The existing
  zero-upload/zero-custom-playlist library was preserved.

These are transport/UI observations, not a claim of human full-track audition.
The initial player was globally muted. During a later unmute test, master volume
changed to zero without an intentional range edit in this test. The quick row
correctly displayed Sound muted while the mute boolean remained off. Read-only
code review found no Next/completion/demo-reset master-volume writer; another
same-origin tab's current audio preference can legitimately be adopted via a
storage event. The writer was not captured, so the cause is **unresolved**, not
labelled a fixed playback defect. Subsequent verification must isolate the browser
profile if this recurs. Initial volume 0.8, mute, pause and selected-style Ukrainian
were restored; no browser data was cleared.

A subsequent reload after deployment briefly failed to fetch the app module. Direct HTTP returned 200, and the normal Reload game link recovered the main menu and Audio settings; this is retained as a transient browser observation, not a fixed source bug. The screenshot `audio-controls.jpg` shows that recovered Audio view with the original paused/muted preferences restored. This reload followed the 908bc6 public marker check; its individual loaded module hashes were not captured in the browser.

Physical iPhone/controller, cold offline, full-track/repeated listening, warning
audibility, mono and small-speaker checks remain pending or user-deferred as
specified in the master plan. Content ID/gameplay-video permission for these six
recordings remains unknown, so Recording mode excludes them.

## Local reconciliation

The task game checkout fast-forwarded cleanly to main 908bc6 and the canonical
archive to main 5a835e54. PR #830 and separate spatial/Demo owner PRs are merged.
The root and current owner checkouts had no unpublished source changes at audit.
Historical `team-after-music` dirty files were left untouched because their
contents are represented in preserved remote history. Existing node_modules
entries are dependencies, not product source. The historical combined tip remains
at remote `codex/preserved-combined-native-spatial-audio-20260930`, exactly
`1c70bc3a92cc6e36247badb80d17e9371b40c46d`.

The new runner2088 derivative is separate archive
[PR #65](https://github.com/mekhovov/revealline-soundtracks/pull/65), not part of
these six public game admissions. Its recipe, original source evidence, independent
measurements and review-only status are retained in that PR.
