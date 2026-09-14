# Published audio and interface replacements

The release host reads only the accepted compiled manifest and its hash-named files. UI/font images load with presentation; audio remains lazy. It does not open the Asset Studio database or write the player library. A local Studio draft does not affect a running game.

## Audio

The eight slots are `audio.focus`, `audio.confirm`, `audio.cancel`, `audio.capture`, `audio.failure`, `audio.victory`, `audio.pickup` and `audio.music`. Published WAV, OGG and MP3 files pass the existing manifest size limit, exact byte count and SHA-256 checks before playback. Authenticated original blobs are cached for this release host's lifetime; closing it aborts reads and clears that cache.

Music uses the existing Soundtrack Player and its media element, gain/ducking, transport, seek, natural end and cleanup. The session-only published track never enters the editable or exported music library. The actual file duration drives its seek range. Creating the host, opening Settings and assigning a published fallback do not start audio. Explicit Play/Enable remains necessary; loading or decoding a file does not grant user activation.

In solo FPV, published theme music takes precedence over automatic procedural chapter recipes. An explicit playlist or saved map/campaign/theme/global assignment wins. Explicit `scenario.music`, the fallback genre override and another gameplay theme retain their existing choices. A newly available published track becomes pending at the existing track boundary; it does not restart a playing track merely because the manifest finished loading.

Couch shares the same session transport without a music database. Enable/Mute, lifecycle suspension and the chapter recipe work as before. A published file can replace the baseline FPV chapter music. Installed chapters retain their authored music; they are not silently reclassified as the baseline release. Browsers without file-audio support keep the existing procedural Soundscape.

Effects use the existing Soundscape context and master/effects buses. Gameplay events select capture/failure/victory/pickup. Native focus and button/link activation select focus/confirm/cancel while sound is already enabled; no listener changes input routing. The first uncached gameplay event retains its procedural cue while the file loads. A completed asynchronous decode never replays an old event. Subsequent events use the decoded replacement. Missing, invalid or unsupported audio retains the procedural behavior. UI-only cues remain silent when no replacement is available.

Cue files must decode to at most 15 seconds and 4,194,304 channel samples. Keep them short and normalize their loudness before publishing. A decode failure or exceeded cue budget falls back safely. Mute/lifecycle suspension cancels pending cue reads; disposal stops owned voices and removes listeners. Audio must never carry the only indication of success, failure or a required action.

## Interface mappings

Compiled CSS maps panel/dialog/tooltip/status frames, primary/secondary/danger/icon/tab/chip buttons, text/select inputs, checkbox/radio/toggle/slider artwork, meters, focus decoration and cursor. Native checked, selected, disabled, focus and input handlers remain authoritative. Replacement checkbox/radio art uses its authored asymmetric nine-slice values and decorates the frame; an independent filled mark and outline preserve checked state. Forced colors restores native input appearance. Scrollbar image styling uses WebKit/Blink's native scrollbar pseudo-element; other engines retain their native scrollbar and semantic palette.

Title/portrait, Missions, Hangar, Collection, Settings, Couch and result surfaces consume their registered background variables. `screen.studio.background` is a reusable explicit opt-in (`data-presentation-screen="studio"`); the local draft Studio intentionally keeps its own isolated preview. Chip/radio/toggle slots have reusable selectors even on screens without a current instance. No new gameplay meter or radio telemetry is invented to consume a slot.

Current buttons receive semantic icons, HUD values keep their real numbers, and touch directions keep native accessible labels. Controls created later, including the soundtrack panel, are decorated by a bounded DOM observer that inspects only newly added element subtrees, including the subtree root. Per-frame HUD labels do not cause a full-document scan. Cleanup removes only host-owned attributes/variables. Medal attributes come from actual earned progress; a missing raster leaves their existing text visible.

Future instances may use `data-presentation-icon`, `data-presentation-control`, `data-presentation-hud` or `data-presentation-reward` with an existing registered semantic name. Signal/connection glyphs, confirm/cancel input glyphs and currently unused authoring actions are available for explicit legitimate instances; registration is not evidence that those mechanics currently exist. Asset Studio Field context presents isolated native component specimens for these symbols and chip/tooltip controls, with explicit labels separating them from live telemetry, earned rewards and production approval.

## Verification

`published-audio.test.mjs` exercises lazy authenticated reads, automatic versus manual music priority, native page cue listeners, pause/disposal races, mute during decode and procedural fallback. `presentation-ui.test.mjs` checks original handlers/checked state, later-created controls and ownership cleanup. Existing audio, playlist, navigation and distribution tests remain release gates.

For acceptance, use a separate test distribution or temporary local server to publish a valid replacement WAV and exact 24×24 control frames. Check the actual game and Couch Enable/Play controls, automatic playlist playback, pause/mute, native checked state and focus, Standard/Large portrait and short landscape. Inspect actual CSS dimensions and DPR. Test-only assets and servers belong outside the production registry; audible quality and browser codec support require review of the actual production audio.
