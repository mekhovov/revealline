# Replay presentation preference read contract

The real Replay Theater constructs its Soundscape before requesting runtime content. That Soundscape owns one shared gameplay-audio preference object, which reads `GAMEPLAY_AUDIO_KEY`. The native fixture previously omitted this legitimate presentation preference from its explicit read whitelist.

This test-only prerequisite imports that exact key and admits it only for reads. At the first existing runtime-content fetch, the fixture records and asserts exactly one construction read. Its existing player-profile boundary asserts the same construction fact and explicitly rejects gameplay-audio writes. Every original read, write, recording, paused-playback, focus, saved-flight and profile assertion remains. Unexpected keys still fail the whitelist. The existing lifecycle owner may perform its legitimate persisted-return rereads; no production module, shared helper, timeout or game behavior changes.

## Evidence and qualification

Hosted preview run `39323375471` at exact head `7b9ec7e6ccd7bae9594c5c4085ec0ed59de05f52` completed 1872 cases: 1857 passed and 15 failed, with no skips, cancellations or todos. Nine failures were the Replay fixture’s unexpected-read assertions. Their complete TAP and command evidence remain retained. The other six package failures are separate; in particular, the real FPV runtime-byte and source-input budgets remain unresolved. Preview build, archives and package identity were skipped after the failed checks.

The test, Replay application, Soundscape, gameplay-audio output and preference owner OIDs match between that tested head and captured current main. The source call chain and unchanged fixture establish the intended construction boundary. A reversible source-only review preserves all prior test bytes apart from the six explicit local fixture edits.

At preparation, this successor has not run. Repository formatting, syntax, complete native-file qualification and a new preview must be recorded against its eventual exact version. No prior passing test count qualifies this prerequisite, and it makes no browser, package, controller, device or PWA-offline claim.
