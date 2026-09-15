# P02-A story and paused-flight supplement

This records root-operated native observations on 15 September 2026 for candidate `a2794f954467fd97c1b89af9c6848da6b7a630e6`, served at `http://127.0.0.1:53903/game/` with missing unchanged assets supplied from `4c85277ac7393eeeabab035387d4d4ae8734aba1`. It is a source preview, not an ordinary frozen build or public acceptance. The [receipt](story-and-paused-flight.json) pins all ten retained records and distinguishes root reports from directly retained values.

## Flight and music remain separate

The [paused-flight record](native/paused-flight-master.json) starts with two lives, 2:41, master 13% muted and falling-chime explicitly paused. Root changed Unmute in Audio settings; closing Settings left the flight paused. Explicit flight Resume followed by Pause also preserved the song's paused state. Locator Enter opened Settings; this is not a complete keyboard-route certification.

## Victory and Collection story

Root earned First Signal at **52.2%, 8,160 points and 12.18 seconds**. The HUD rounds time to 0:12; the [Collection record](native/collection-story-close.json) retains 12.18s. The [fixture inventory](native/story-source.json) pins the existing Dawn Signal originals, story bundle and manifest. All three hashes/sizes were independently checked against the candidate Git blobs without copying their bulk bodies here.

The owned **silent eight-second** video decoded and advanced: [victory playback](native/story-muted-play.json) has `currentTime: 0.300005`, `readyState: 4`, `paused: false`, `muted: true`, and cinematic fader 0.4. No effective native volume value was exposed in the retained read. Silence in this fixture cannot demonstrate audible attenuation or correct quantitative gain multiplication.

The clip naturally ended before the first attempted Skip, so that selector was absent. This unsuccessful attempted action is preserved. Root then used **Replay → Skip → Close**; [the record](native/story-skip-close.json) shows the ended/skipped states, unchanged 8,160 score, restored Victory story focus and zero remaining DOM videos. [Parent transport](native/story-parent-transport.txt) retains falling-chime paused, master 13% and muted. Collection **Play earned story → Close** likewise returned focus to its opener, preserved the score and left zero DOM videos; playback reached 0.265216 seconds while muted.

**Open P03/P07 finding:** root observed focus fall to body when the video naturally ends. This transition is not fixed or qualified by the successful explicit Close paths. The ended DOM record does not independently record body focus; the finding is attributed to root's native observation.

## Independent preview faders and Pause

With master 13% unmuted, [the saved/current preview at local zero was muted while the draft at local 0.6 was not](native/independent-preview-faders.json); both were playing decoded MP3s. Root explicitly paused only current. [The later record](native/independent-preview-pause.json) shows current held at 0.085253 seconds while draft continued; Master Mute then set both mute flags without changing either transport. Draft advanced to 0.201637 while current remained paused at 0.085253. This extends the native independent-fader/transport evidence; it does not demonstrate quantitative audible gain or replacement teardown.

## Initial source CI remains failed

[PR62 run 34986888812](https://github.com/mekhovov/revealline/actions/runs/34986888812) failed its initial preflight producer check. The [retained step log](receipts/pr62-initial-preflight.txt) names exact candidate `a2794f9`, command `node scripts/produce-field-kit-theme.mjs --check`, and exit 1 at 15:15:42 UTC: “Stale production revision ledger.” Root supplied the PR/run binding; this package did not poll GitHub. The log supplies no whole-suite result, later retry or permission to approve changed recipes. Earlier focused receipts remain historical.

These observations add native decoder, transport, mute-flag and cleanup evidence. They add no listening, audible duck recovery, delayed-play race, physical hardware, iOS, complete release or phase-completion claim. Final P01 integration, production review/readiness, exact source gates and frozen/public qualification remain required.
