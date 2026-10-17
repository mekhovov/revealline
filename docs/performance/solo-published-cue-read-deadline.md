# Published cue read deadline

The optional published-cue loader could occupy both shared fetch slots indefinitely when a response stalled. A required soundtrack read then remained queued. The controlled reproduction uses the actual cue owner and shared preparation queue; it does not claim browser performance qualification.

The loader now applies a ten-second deadline after fetch admission, matching the existing optional effects and reaction loaders. Expiry aborts the read and selects the existing procedural fallback for that cue. Queue wait is excluded. A noncooperative read retains its shared slot until actual settlement, and a late result cannot decode or replace a newer owner. The timer ends when the read settles or the owner cancels. Native audio decoding still has no cancellation timer and retains its reservation until settlement.

The initial test run contained an incorrect compile-result fixture and is retained separately. After correcting that fixture, the unchanged loader fails the deadline assertion; the implementation passes all four focused cases. These cover real presentation-read abort propagation unblocking the real soundtrack owner, noncooperative read settlement, queued work and replacement generations, and a pending native decode retaining its reservation after closure.

The full published-audio, media-preparation, audio, soundtrack-player, soundtrack-host, and Solo soundtrack-admission host files pass **165/165 tests**, with no skips or failures, in 50.28 seconds. Lint, formatting, and the diff check pass for the two changed source/test files. No local browser, server, or production build was launched.

Retained local evidence is under `.cache/solo-followup/resource-owner-audit-c9e/`: `published-cue-starvation.json`, `deadline-red.tap` (invalid fixture), `deadline-red-corrected-fixture.tap` (valid negative control), `deadline-focused-green.tap`, and `deadline-full-regression-receipt.json`. The full raw TAP is 40,250 bytes with SHA-256 `cea925f22bd50d557dcd1b9912585693d473f47b30989c29d595217503c60adc`.

Tested runtime bytes: `game/ui/published-audio.mjs`, 14,094 bytes, SHA-256 `a5e1a7544eae590b0b39b1023ea778483419b2fe000690b42087b57ec6ddb722`. Test bytes: `game/test/published-audio.test.mjs`, 28,694 bytes, SHA-256 `6942326fa5f6477bbe301f57e4b0e96ff333d292cdab93448b1e0156a369b028`. This correction preserves the shared media budgets and makes no final-device performance claim.
