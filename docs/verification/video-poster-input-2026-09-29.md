# Video Poster input qualification

The bounded Video Poster workflow passed native-keyboard and shared virtual-pad
checks against runtime commit
`40c35003e3b4cb9c8a89e07c4f3f0e9598588ef9`. This receipt covers the local source
candidate on `http://127.0.0.1:8990`, its actual PNG downloads and source dependency
attribution. It does not qualify the separate soundtrack follow-up, native
platform execution or a published release. Historical Video Poster receipts
remain pinned to their original revisions in the
[workshop README](../../authoring/video-poster/README.md).

## Runtime correction and focused tests

The existing page now preserves operation input ownership through inspection,
capture, stepping and optional-converter checks. Completion restores an enabled
successor only after controls unlock and while the operation still owns foreground
focus. A newer focus owner, backgrounding or disposal vetoes stale focus recovery.
Visible Cancel remains an owned destination during work; Clear returns to the
source input. The shared Confirm guard, neutral gate and existing source/capture
semantics remain in use.

The focused cohort passed **112/112**, with zero skips, on **Node 20.19.5**
(473.6 ms, stdout-only; no retained test-log file). It includes **39 workshop
host tests**, of which 18 are new ownership regressions:

```sh
node --test --test-reporter=spec game/test/video-poster-workshop.test.mjs game/test/video-poster.test.mjs game/test/video-editor.test.mjs game/test/mediabunny-trim-adapter.test.mjs
```

These tests model DOM/media boundaries; browser capture and OS-file validation
below provide separate evidence. Scoped fixture syntax, ESLint and Prettier
checks also passed.

## Native keyboard browser journey

Codex in-app browser, English, dedicated origin 8990. After setup, the actual
journey used unbound native keyboard events without a pointer focus reset:

1. Canceled the source picker, reopened it and selected the bundled Dawn Signal
   video. Inspection returned focus to requested time.
2. Entered an empty requested time. Capture rejected it and returned focus to
   that field. Corrected the time to 2 seconds, captured and explicitly activated
   Download. The visible evidence reported a presented frame at 2 seconds.
3. Used the actual later-frame action. Its next displayed observed timestamp was
   **2.083 seconds**, at a requested seek of **2.125 seconds**. This is observed
   timing evidence, not a promise that every browser advances exactly one frame.
4. Applied an invalid **4–4 second** playback range. The prior applied range was
   retained and focus returned to Playback starts. Correcting it to **1–4 seconds**
   kept the complete original video; no physical trim or conversion was invoked.
5. Cleared the source and verified source-input focus, selected the same bundled
   video again, captured at 2 seconds and explicitly downloaded again.
6. Used Escape to return to Workshop, where the Video Poster link had focus.
   Enter reopened the tool with an empty source, consistent with its in-memory
   lifetime and absence of a persistent project Save.

Both actual 2-second PNG files were found in Downloads and passed the independent
production/full-image validation below.

## Shared virtual-pad browser journey

The current [manual case](../../game/test/manual/video-poster-current-workflow.mjs)
passed **3/3 recorded stages** through real shared controller commands. Selectors
identify destinations; the fixture does not click/focus controls or invoke domain
handlers to advance the application.

- Source, numeric, slider and transform-plan drafts canceled without committing.
  Empty requested time and a zero-length playback segment were rejected; correcting
  them preserved the inspected source and allowed capture at **1 second**.
- The actual captured PNG decoded through production `prepareStillAsset` checks.
  The displayed original/PNG hashes, dimensions and requested/reported timing
  agreed with the bytes. Two explicit download activations referenced the exact
  same captured PNG. Canceling source replacement retained that source and poster.
- Clear returned to the source entry. Reselecting the same bundled video and
  recapturing at 1 second produced the third actual PNG download. The first
  capture reported **presented-frame timing at 1 second**; the fresh capture
  truthfully reported **playhead-estimate timing with no presented-frame callback**.
  Their identical pixels do not upgrade the latter timing evidence.

The complete local/session storage snapshots remained unchanged: **0 local keys
and 0 session keys** before and after. The fixture never opens or mutates IndexedDB.
Its JSON is a qualification receipt, not an application evidence export.

## Source and actual OS artifacts

The bundled source was **713,732 bytes**, **8 seconds**, **640 × 360**, SHA-256
`d643a6ebbf92b93dc57a0cfe65ca4bcf484ceecd8ed632ed6476707ec720e85a`.

| Input path                           | Actual Downloads files                                                            | Bytes per file | SHA-256                                                            |
| ------------------------------------ | --------------------------------------------------------------------------------- | -------------: | ------------------------------------------------------------------ |
| Native keyboard, requested 2 seconds | `fpv-line-poster-2.png`, `fpv-line-poster-2 (1).png`                              |        518,033 | `cf8ee5fac069a5800712f0f45cf6401d8e6500bb9f69b0f9e5c3300a16002b13` |
| Virtual pad, requested 1 second      | `fpv-line-poster-1.png`, `fpv-line-poster-1 (1).png`, `fpv-line-poster-1 (2).png` |        522,378 | `ce77b3ba973d81df8ffc299c62df7aa77a399fe9ee34f48782289cde28804256` |

All five files passed production `prepareStillAsset` verification with a real
`/usr/bin/sips` PNG-to-BMP decoder. Every result was **640 × 360**, with complete
32-bit pixel data: **360 scanned rows and 921,600 scanned pixel bytes**. The
validator checked the BMP payload, masks, dimensions and bounds, rather than
accepting only a PNG/BMP header. Original PNG bytes remained unchanged, and each
prepared Blob retained its exact byte length and SHA-256. The two native files
were identical to each other; all three virtual files were identical to each other.

Local machine receipts:

- `/private/tmp/video-poster-native-downloads-20260929.json`, completed
  `2026-09-29T07:51:41.906Z`.
- `/private/tmp/video-poster-virtual-downloads-20260929.json`, completed
  `2026-09-29T07:51:49.826Z`.

Verification-only attribution supplied to the PNG validator is not embedded
product provenance or evidence of capture time. The rendered browser observations
provide the independent source/time/input evidence. The downloaded artifacts were
retained without re-encoding.

## Source closure and edition attribution

The read-only default collector/dependency check passed at the same commit,
capturing **243 source paths, 209 static modules, 667 module edges and 48 resource
edges**. The actual default collector selected **1,723 files**, with **zero manual
fixture files**. Its input inventory SHA-256 is
`1b1976f462a13c3af789ff229752a3428a1f285f65670e47199df50591662280`.
The graph includes both Still/Video entry points, shared authoring/reference
entries and optional Video Poster converter dependencies. Referenced navigation
targets were admitted without claiming complete coverage of those other tools.
Generated `game/build-info.json` and the guarded native bridge remain their
documented build/platform boundaries.

`/private/tmp/still-video-authoring-source-closure-20260929.json` records no source
drift or Git mismatch. The matching
`/private/tmp/still-video-commit-attribution-20260929.json` compares the default
closure with the prior **835 edition inputs and six compiler pins**: **877 unique
paths** match commit `40c35003e3b4cb9c8a89e07c4f3f0e9598588ef9`, with no disk drift.
The prior 14-edition compilation remains attributable because all 841 captured
edition/compiler inputs are byte-identical. No compilation was rerun for this
receipt, and its earlier generated source-revision metadata is not relabeled.
These checks do not constitute a materialized web/native build or deployment.

## Remaining boundaries

The tool has no editable provenance/text field, product evidence-JSON export or
persistent project Save. Supported reopening here means source reselection or
the verified Workshop return/reopen path. The checks above do not qualify a
physical controller, physical/native device, offline or published delivery,
complete video playback, timed cancellation during real decoding, OS file-picker
import, audible-track behavior, a codec matrix or optional MP4 conversion.
The native frame-step observation is one real browser/source case, not exhaustive
frame-stepping or frame-accuracy certification. Soundtrack recovery and the ongoing
audio follow-up are outside this accepted Video Poster batch.
