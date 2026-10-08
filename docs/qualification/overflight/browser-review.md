# Native browser review — 5 October 2026

This page records the initial candidate before the later upgrade rebalance.
Current card and balance evidence is in [the follow-up](upgrades-20261005/README.md).

The reviewed source is bound in [browser-source.json](browser-source.json).
The browser is the local Codex in-app Chromium on Apple M4 Pro/macOS 26.7.1.
These observations do not qualify Iris Xe, M1 Air/Safari, physical gamepads or human enjoyment.

## Verified interactions

- Native play prepares existing character artwork and enters the shared briefing/play shell.
- Automated Fan review uses normal inputs and earned upgrades. Its visible review label distinguishes it from a human run.
- [Earned upgrade cards](fan-opening.jpg) pause combat and show current→next behavior.
- [Fan mid-sortie](fan-midgame.jpg), [Fan late crowd](fan-late.jpg), and [Echo late crowd](echo-late.jpg) show different evolved attack geometry using the native roster.
- Two complete real-time native automated runs reached normal results: [Fan 05:49](fan-native-result.json) with 4,863 clears/7,360 salvage and [Echo 05:42](echo-native-result.json) with 4,702 clears/6,948 salvage. They match the deterministic simulation outcomes; these are not human playtests.
- [Ten native retries](browser-retries.json) reset hull, airframes, time and build while retaining one renderer canvas. This does not establish total browser heap stability.
- Current-source actual WebGL loss/restoration required explicit Continue, retained the paused 00:10 state and then advanced again; [final recovery receipt](browser-context-recovery-final.json) records one loss and one restoration.
- Paged inspection paused the game, kept the browser responsive, and reconstructed a complete 313,020-character JSON record across two UI pages; [compressed raw receipt](browser-paged-export.json.gz). Its ten-second run is functional export evidence, not a performance trial.
- The [final Studio view](creator-studio-final.jpg) prepared and played the default compiled sortie, then paused for review.
- Actual WebGL loss/restoration required explicit Continue and retained appearance; [receipt](browser-context-recovery.json). This predates the final small family-cue addition.
- Creator draft title/seed edit → native preview → package export → separate-origin import → installed native play retained package identity `4ea85f093aa29b2e` and project identity `6e49fcf6edc209da`. The [exported package](creator-roundtrip.overflight.json), [Studio](creator-studio.jpg) and [native import](imported-native.jpg) are retained.
- The optional 20-second silent battlefield recorder produced an inline playable Blob. Automated Blob download timed out in this browser; no saved video artifact or full-interface clip is claimed.

## Packaged distribution smoke

The full distribution built from `cbd9d23d1a2eff81e7059013024974e2d6e1ca41`
passed a separate-origin browser smoke at `http://127.0.0.1:8881`.
Native Start entered combat, time advanced to 00:09 and Pause opened the shared
menu. Packaged Creator validation reported 18 encounters and compiled identity
`8ab8476ceeb653ae`; its native preview played to 00:13 and paused correctly.
The [build receipt](full-distribution-build.json),
[browser receipt](distribution-browser-smoke.json),
[native capture](distribution-play.jpg) and
[Studio capture](distribution-studio.jpg) bind this check to the packaged candidate.
This does not establish offline installation or performance acceptance.

## Performance boundary

A moving 1500/700 reference fixture reached 15:05 before the raw-export UI stalled.
No final raw receipt could be recovered. The [incident](browser-export-incident.json)
and [loaded-source hashes](browser-reference-before-family-roles.source.json) are preserved.
Inspection has since been changed to pause and expose compact, bounded pages; the fresh-tab export check above passed.
The fresh review tab remains usable, but the old tab could not be closed through
browser control and manual closure was requested. A clean current-source
performance run and resource soak remain required.

The older [preliminary measurement](browser-reference-preliminary.json) used a
clumped fixture and must not be used as acceptance of the corrected horde or final source.
The [corrected crowd capture](reference-crowd-corrected.jpg) demonstrates spatial
distribution, not a framerate result.
