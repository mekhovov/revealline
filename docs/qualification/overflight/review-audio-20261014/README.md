# Optional game audio in native review recordings — 2026-10-14

The bounded native canvas recorder accepts an optional `getAudio` adapter. The native host supplies `createOverflightReviewAudioTap(sound)`, which connects a new MediaStream destination after the shared compressor (or shared master when no compressor exists). This connection runs alongside the normal audible output and follows its existing master mute/volume and source-bus settings. It never requests microphone access and never resumes, suspends or closes the game's audio context.

The recorder attaches cloned tap tracks, retaining ownership of both clones and the new destination. Completion, cancellation, size rejection, recorder error and setup failures stop only capture tracks and disconnect only that destination. Existing audible connections remain in place. The default without an adapter remains silent; recording remains limited to 20 seconds and 16 MiB. `audio: true` in capture state means an audio track was attached, not proof that the game was unmuted or that any sound occurred.

This captures sounds already connected to the shared sound mix, including game effects, start cues and dialogue. An HTML audio playlist is **not** captured unless its source has actually been routed through that same Web Audio graph. The capture still contains the battlefield canvas, not surrounding DOM HUD or menus.

`tests.tap` records 28 passing tests: all 19 existing host cases plus 9 audio ownership/cleanup cases. These are lifecycle tests, not listening evidence or a claim about a particular browser's codec output. Native audio/video captures and listening review are recorded separately by the integration task.
