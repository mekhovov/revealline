# Independent review of 32 reopened recipe slots

Recommendation: continuing the prior **functional source/UI/player recipe approval** is justified for these 32 unchanged recipes, provided the new approval cites this exact source and the scoped lifecycle evidence. This is a new source-bound review after invalidation, not automatic inheritance from an inventory count. No concrete correctness blocker was found in the two changed recipe inputs. No generator fingerprint, quality record, compiled output or production default was modified by this reviewer.

## Exact comparison

Base: `c3398112e9a739225fdc2e8bf603b45f52a5cbb6`, canonical document/theme57. Candidate source patch: `4bb397b8994403383386d3722ed78f5c00620c042fb53f7059b3408264902eb2`; generated document/theme58 remains unapproved.

`comparison.json` contains complete selected records before and after, every changed field, input hashes, exact prior approval receipt hashes, and artifact bindings. Independently parsed both complete RLTHM1 bundles, checked each embedded payload SHA-256 and byte length, and compared their historical documents and compiled resolved assets.

For **every one of 24 UI and eight audio slots**, the only changed fields are `revision`, `provenance.parent.revision`, `provenance.source`, `quality.stage`, and `quality.evidence`. Each new parent is the exact prior selected immutable asset. Recipe ID/content, description, kind, geometry, file claim, prompt, creator and license are unchanged. All 32 are procedural `recipe` assets with null geometry/file; this does not claim 32 newly rendered or recorded media assets. Selected tokens (including palette, type, dimensions and motion scale) and compiled `theme.css` are byte/structurally identical. All 127 original payloads are exact, and all prior slots/assets/themes/collections remain exact prefixes, including their full quality history.

Six UI recipe inputs: five unchanged, only `game/presentation/host.mjs` changed. Fourteen audio recipe inputs: thirteen unchanged, only `game/ui/published-audio.mjs` changed. Main soundtrack catalogue, synthesis, scheduler, master authority, playlist/player, default selection and panel CSS are unchanged.

## Source and behavioral review

`host.diff`: adds the constrained hash-addressed retained manifest selector, validates its matching expected pin before reading, and reads that manifest through the existing byte verification/adoption path. It changes neither layout application nor image/font decoding, palette, geometry, rendering, CSS ownership or synthesis. Existing default `runtime.json` behavior remains. The complete host/dependency/retention tests exercise exact pin selection, no current fallback, bad/missing bytes, prior-owner survival, cancellation and disposal.

`published-audio.diff`: adds explicit accepted-presentation adoption so late page readiness cannot replace an already restored presentation; music reads capture the accepted host/snapshot and reject obsolete work before and after await. Cue replacement uses the existing Soundscape authority, whose `setPublishedAudio` closes old cues and aborts pending reads before creating the new cache. Repeating the same accepted snapshot preserves that cache. This changes which verified presentation owns published audio, not procedural cue synthesis, music composition, gain/mix, rights or user playback intent.

The current generated58 and canonical57 selected audio roles are recipes, not audio files. Therefore no new soundtrack payload or changed sound composition is being approved here. Native restoration of the retained manifest is useful host/ownership evidence, but cannot alone demonstrate published audio-file decoding.

## Evidence reviewed and its limits

The parent runtime receipt reports 12 complete files /109 passing checks each on Node20 and Node22, zero failures/skips/source mismatches, for the exact124-path source plus verified generated outputs. Reviewed its source audit, log case coverage and relevant test bodies; did not rerun tests. Relevant cases include retained manifest admission and resource lifetime, real Solo fresh/Continue/Retry/failed Next/cancel restoration, bad audio refusing replacement, published music versus manual assignments, Pause/dispose late-read rejection, cue lazy decode/mute, and explicit retained adoption defeating late page readiness and invalidating old readers.

The parent native receipt binds402 actual served resources on the same candidate and records keyboard Start, confirmed Restart, legal victory, direct Next, reload Continue and explicit Pause, with empty console/HTTP mismatch lists. It explicitly limits the native review to desktop local source and a paused-UI screenshot. This reviewer performed no native playback or listening.

Authenticated prior UI approval (`29b58017…`) was functional source approval with native/device/art limits; authenticated prior audio approval (`b35df30b…`) covered functional player behavior and explicitly withheld musical suitability and physical/offline/public acceptance. Continuation must retain those boundaries. It must not turn existing pending musical review of70 hosted recordings into approval, or imply UA-FPV redistribution authorization.

## Precise remaining checks, rather than a blanket listening gate

No new geometry/palette/synthesis rerender or full-song review is warranted solely because these two reader/lifecycle modules changed. The exact recipes and their substantive dependencies are unchanged, and the lifecycle tests support source-level continuation now.

If the release receipt additionally claims **native fresh/retained audio behavior**, the existing402-binding journey does not establish it. Add a bounded exact-source ordinary sound-on journey: play a cue/music, switch/restore the accepted retained presentation, verify subsequent cue/music still works, explicitly mute/pause and retry, and distinguish listening from merely observing an AudioContext or network request. A retained recipe-only theme proves unchanged procedural fallback, not custom published-file decoding. Use a validated audio-bearing imported theme if making the latter claim; no production content change is required.

Two useful focused regressions beyond the current assertions are (1) switch accepted presentation while its published music `readAudio` promise is already pending, then settle old bytes and assert no media/URL adoption; (2) replace presentation while a cue decode is pending through the real Soundscape adapter, then assert old completion creates no voice and a subsequent event uses the new owner. Current tests separately cover post-switch reader rejection and mute/dispose late completions; their explicit-retained case does not itself exercise these two in-flight switch combinations. Source review finds guards for both, so these are precise coverage improvements, not reproduced product defects or a demand to rerun all soundtrack tests.

Production readiness, exact final-source tests after any new edits, packaging/dependency retention, offline and publication remain the release owner's gates. This review grants none of them and does not adopt generated58.
