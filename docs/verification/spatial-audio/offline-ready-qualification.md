# Installed audio and missing-pack recovery — 30 September 2026

Audio-only follow-up to merged PR #851, based on main
`e39b4197a75441d74c35299c8545d8bdfd0a7c61`. Implementation commit
`06fe0afbe5a3b8b28714454b8d12b01ff7d85a42` is embedded in the tested build.
PR #858 is scheduled for **v0.150.0 — Unified native experience**.

## Missing recordings no longer cause a request every frame

An uninstalled optional recording previously caused 120 failed downloads over
120 rendered frames. The [failing regression](offline-retry-before.tap) retains
that result. Failed HTTP responses, network errors, truncated WAVs and decoder
errors now trigger a five-second cooldown for that cue. Explicit audio activation
clears the cooldown after installation or reconnection. Pending requests remain
deduplicated; successful decoding only makes the buffer available for future
cues, never replays a missed event. Closing clears retry state without a timer.

All [167 integration checks](offline-ready-tests.tap) pass with no skips. They
include cooldown/recovery, disposal, the complete Couch audio host suite,
movement, loudness, Demo integration and offline closure. Changed-source ESLint,
Prettier and diff checks pass. No approved sound bytes, startup sequence, music
catalogue, simulation, replay format or PR #795 content changed.

## Exact-build offline observation

The [build receipt](offline-ready-build.json) records the embedded commit,
distribution hash and bank/source/inventory comparisons. All 56 runtime cues
match their approved hashes. The `extras:spatial-audio` pack contains 58 WAVs,
including both redistribution source recordings.

A fresh browser origin installed Solo Starter plus **Optional spatial sound
effects** (89.3 MiB total). After the Downloads UI reported completion, the owned
HTTP server was stopped and a direct request failed with curl exit 7. The game
then reloaded from the installed cache. Real UI/keyboard play covered:

- First return: a legal cut, 34.3% capture, victory and the earned picture.
- Next: Choose your share loaded and a partial 34.3% capture remained playable.
- Continued movement, line damage/respawn, pause and resume.
- Movement sounds off/on in Audio Settings and explicit master unmute.

The later sound-enabled steering check used native key input and retained
**Sound: on** through damage and pause. Earlier locator-based steering did not
reliably retain that state, so those earlier captures establish gameplay and
asset availability, not audible output. No browser warnings or errors were
observed. Screenshots and DOM records are retained alongside this report.

Downloads was reopened while the server remained stopped. With the spatial
sound pack selected, its [native verification](offline-ready-cache.json) passed
1,211/1,211 core files and all 27,998,535 bytes of selected gameplay/sound files,
with zero missing or corrupt entries; the launcher was ready too. This closes
the fresh installed-pack offline gameplay check left open in the previous
qualification, within this single-browser/Solo scope.

## Remaining acceptance

This is an origin-server-offline check, not airplane mode or physical-device
certification. Recorded soundtracks were not installed; built-in procedural
music remained available. UI intent and cache verification are not a listening
review or a measurement of decoded output. Sustained listening with music,
speakers/headphones, and physical-device qualification remain deferred. Final
immutable release qualification and public acceptance remain with the canonical
publisher. The [structured receipt](offline-ready-qualification.json) preserves
these limits and the earlier source/native-mix evidence remains unchanged.
