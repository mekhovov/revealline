# v0.31 — Soundtrack transfer and still-image foundation

The player-facing change is an explicit, retryable soundtrack download: **Prepare saved-library backup → Download prepared backup**. Preparation verifies the saved original bytes; the visible download action allows normal keyboard Enter, pointer and touch activation. The game never equates a click with a file successfully written. Unsaved drafts are excluded; retained files can be retried or discarded.

The independent still-image foundation validates original PNG/JPEG files and exact map/theme assignments without changing gameplay, replay or score identity. An opt-in v3 storage adapter retains exact historical owners and original bytes in the shared bounded ledger. It is not yet connected to runtime picture replacement. See [the API and limits](../../media-presentation.md). Actual-browser v3 migration, authoring UI, optional stories, earned-picture retention and full binary media backups remain P5 work.

## Verified before freezing

- The audio component's 105 focused tests and the still-image foundation's 73 affected tests passed in their respective isolated source revisions. Finite controller/DOM/database adapters are not physical devices.
- An actual browser selected and decoded an owned 26.12-second MP3, imported it, created and saved a mixed MP3/synth playlist, and observed the automatic transition to Signal Afterglow.
- Native keyboard Enter downloaded a 418,029-byte `.rlsound`. A different local origin imported it through the file chooser, saved it and exported **exactly the same bytes**. Reload preserved the track and playlist; playback and another identical export passed with that server stopped.
- A development-packaged integration prepared all 217 offline files. Its server was then stopped before cold navigation. The game started from its prepared cache, retained the custom library, played the MP3 after explicit activation, advanced automatically to the built-in song, and exported an identical backup. Browser errors/warnings were empty. [Machine-readable preflight](audio-browser-preflight.json).
- The MP3 is coded silence: these observations verify file transfer, decoding and transport. They are not audition evidence for a finished soundtrack.

The common backup SHA-256 is `d508c58dc816b3a2256e45bf5e46fcb8c79d72c033e088771cc4b1c166330547`. Its unchanged original MP3 is 417,000 bytes with SHA-256 `f09b4472b1112f8e0ba1c7f2955fcc698eff663a456453ad20a052be31f7ff93`. The independent binary inspection verified the 12-byte header, 1,017-byte canonical manifest, original payload, selected ordered two-entry playlist and repeat-all preference, with no trailing bytes.

## Suspended-only continuity correction

The v0.30 public test found that an unfinished first attempt could exist without a persisted player profile. Its old edition restored 51.4% /12,240 points /three lives /1:47 exactly, and complete-backup export/import restored that same state in v0.30; automatic discovery omitted it. The new correction unions exact profile and suspended namespaces under the same bounds. An explicit null profile is accepted only with a fully verified saved flight, and the preview explains that its collection/preferences are empty/default. Corrupt, undefined and entirely missing sources still fail; source locks, journal checks, copy-time fingerprint revalidation and unchanged original bytes remain. Nine new tests cover both turning modes, the shipped R4 cut, Gentle expansion and real panel handlers with modeled storage. The affected74 tests passed, with final nine passing on Node20/22. Actual frozen/public discovery verification follows.

The optional still store separately passed101 affected tests on Node22 and40 storage cases on Node20, including17 new migration/history/rollback cases. Older core, replay, audio and foundation inputs remain exact. This is model-based storage evidence; no database is automatically upgraded in the ordinary game.

## Delivery gate

Exact committed-source tests, immutable artifact reproduction, frozen browser checks, PR/CI, Pages byte verification and public browser play are pending for this milestone. The development build has `sourceRevision:null` and must not be presented as a frozen release. The previous v0.30 delivery has passed and its published receipt retains the discovery limitation.

## Next media work

1. Qualify the opt-in shared storage revision: retain historical owners across restart and pack removal, preserve audio and generic media during migration, and reject stale, cancelled or over-budget imports atomically.
2. Add explicit admin still upload/assignment/preview with safe runtime fallback and independent earned-picture receipts.
3. Add video/GIF upload, segment selection and a separate chosen poster frame. Record a win before optional playback; skip/replay never grants another award.
4. Complete media backup and offline bundles, then adopt reviewed original art through the same bounded pipeline.

For video posters, the implementation should observe the presented frame rather than assume a seek time identifies a decoded frame. `requestVideoFrameCallback` exposes frame metadata including `mediaTime`; fallback behavior and codec precision still require tests. [MDN frame callback](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback). On iPhone, use inline playback and handle permission refusal explicitly so a story stays within the game interface. This is a future design decision, not a device result. [WebKit inline video policy](https://webkit.org/blog/6784/new-video-policies-for-ios/).
