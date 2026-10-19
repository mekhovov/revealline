# WebKit Blob decode ownership — bounded diagnostic conclusion

Recorded 2026-10-19. Investigation closed; no production change is indicated by this finding. The original unprojected restoration receipt remains **functional 12/12, strict failed with one diagnostic**. This analysis does not change that result. After the separate shared loading fix and fresh build, run the ordinary unprojected WebKit restoration qualifier; another instrumented observation retry is unnecessary.

## Evidence and observed ownership

The [original receipt](restoration-webkit-final-emitted-16ebd7b-71a0ac38a-affected.json) reports a native Blob access-control diagnostic during Solo `ordinary-control-reload-1`, received at `2026-10-19T04:57:46.710Z`. Its stack identifies `browserDecode` and the existing `main` work submission. All 12 functional checks passed; no DOM window-error or unhandled-rejection event was observed. The original internal URL was `blob:http://127.0.0.1:8771/6bd27257-0cb8-4990-b559-f4fa3a0228f7`.

The [same-build observer run](webkit-blob-owner-emitted-71a0ac38a.json) passed its three Solo ordinary, watching, and practice reload checks. Collection, strict diagnostics, functional checks, immutable bindings, browser closure, and preview closure all completed. The child exited normally with code 0; streams drained without overflow or parse failures. The [supervision receipt](webkit-blob-owner-emitted-71a0ac38a.supervision.json) verified four owned process identities, zero cleanup signals, and zero remaining processes.

The native access-control console line did **not** recur. A native `createImageBitmap` rejection **did** recur in the departing ordinary document. The [child trace](webkit-blob-owner-emitted-71a0ac38a.artifacts/restoration.json) proves the following chain within document `1792386735330-0.44370328411650173`, host 1, load 1. Sequence numbers are local to that document:

| Sequence | Epoch milliseconds | Observation |
| --- | ---: | --- |
| 223–224 | 1792386737248 | Operation 53 created/submitted: direct image decode, `pickup.supply`, PNG 152 bytes; queue signal not aborted. |
| 225 | 1792386737249 | `beforeunload`. |
| 226–227 | 1792386737250 | Existing `main` and load catches receive the same error object, observer `errorId: 1`, `InvalidStateError` from reading the Blob argument. No pending requests. |
| 228–230 | 1792386737251 | Disposal completes before rethrow; load finally runs; app catch receives the same `errorId: 1`. |
| 231 | 1792386737257 | Existing app fallback completes for that same error. |
| 232 | 1792386737259 | Nonpersisted `pagehide`. |
| 233–234 | 1792386737278 | Host close enters/completes: closed true, pending false, picture/audio read counts zero. |

The operation identifies validated asset SHA256 `7954823e793dd6140528d271c12653fca559eda862ca83c4be73c6bfbdf9c26c`. This is actual observed ownership through existing handlers, not a new handler added by the probe. The replacement document `1792386737250-0.5404423428606173` reaches ordinary briefing with no demo, practice, dialog, or native surface. Subsequent watching/practice reloads also reach briefing, preserve the checked storage signature, and report no active player-state mutations or remaining workers. The observer records no DOM error/unhandled-rejection, native console error, or Playwright pageerror; its observed prefix has no overflow or observer failures.

## Interpretation and remaining uncertainty

[WebKit ThreadableLoader](https://raw.githubusercontent.com/WebKit/WebKit/main/Source/WebCore/loader/ThreadableLoader.cpp) emits the access-control wording as a JavaScript-source error console message independently of JavaScript promise handling. [FileReaderLoader](https://raw.githubusercontent.com/WebKit/WebKit/main/Source/WebCore/fileapi/FileReaderLoader.cpp) creates an internal Blob URL for its read; that URL need not be an application-created URL. [Playwright 1.62.1 WebKit handling](https://raw.githubusercontent.com/microsoft/playwright/v1.62.1/packages/playwright-core/src/server/webkit/wkPage.ts) converts JavaScript-source error console messages into `pageerror` by constructing an error from the message. The installed Playwright bundle was independently checked for that conversion. Thus a Playwright `pageerror` with this native wording is not itself proof of an unhandled application exception.

Classify the original finding as a native loader console diagnostic during ordinary navigation, with no demonstrated unhandled application rejection. The current observer directly establishes that an actual native Blob-decode rejection in the departing document is owned, disposed, and handled by the existing fallback, followed by a healthy replacement entry. Existing pagehide cleanup also completes. This supports closing the application ownership investigation without speculative extra catches or cleanup.

The exact original Blob URL and console event were not reproduced by the observer. Its error object cannot be bound to operation 53 or any asset across different runs. The reason for intermittent console emission remains unproven. WebKit main explains a matching mechanism but is not an exact source mapping for installed WebKit 2336/26.5. Instrumentation may affect timing; no absence of an undelivered final document tail is claimed. The three projected diagnostic checks do not replace the original unprojected four-mode gate, prove BFCache/discard behavior, or establish a clean future build. No raw diagnostic is filtered, waived automatically, or rewritten as passed.

## Reproduction bindings

Full argv, emitted original/projected bytes, and before/after bindings are retained in the observer report and [preparation receipt](webkit-blob-owner-emitted-preparation-71a0ac38a/preparation.json). Primary-source response hashes and installed-library provenance are retained in the [mechanism preparation receipt](webkit-blob-owner-preparation-71a0ac38a/preparation.json).

| Binding | Value / SHA256 |
| --- | --- |
| Candidate / integration base | `71a0ac38a391ca1ec305a4ad7afc75527b8d2e23` / `16ebd7b51984387c39622380a8e51a60e745152e` |
| Runtime source (9997 files, 404446327 bytes) | `8da700ba5a9cab9787ecec0b9064830ffea6e5687d407caeb2b290260b97df04` |
| Build inputs | `31d7feed289f5e8f2e40f32c72422bb2a4a5a9ab9b8c802e1a0a77cbc2dc9e44` |
| Capture manifest | `dc5b83bb9c0f3ca8ba6fc656cb8a06b25d3b5905a72aa8ac2e880ceaaba6ac2f` |
| Emitted inventory identity | `7d436362db5ad2408fd1f1a8811404d4918b90473a001344551fa4961f0cdbba` |
| Original strict-failed receipt | `24d3b4a983a2165bdc6f58ceabc9fd4534177f93bc8089925ac2960602982b81` |
| Observer report | `e2d7353582f71220b7e8b18cb42590c788edc1d18c426a2638d2e1f72b6b5e60` |
| Child trace | `e8bdcf0b8359ceaea45d3a5543dd24ecf0d314d57627d4ea5cd887f96df80318` |
| Supervision | `4c49aa4b960e44e57fb5188826621c13a9bd2316459f5b1ca8a2e2b76a723bf5` |
| Observer runner / projection | `656758af24dcee68cb3ff80aa80f17865c7fe8b3b3fbf62dec65f177085524b5` / `8f409ef6d51bac28bcb9a94b5aec9a87261cd4bab8ef27466d1fe55340e1b617` |
| Original restoration harness / derived observer | `13d80135cff69674fe569f991df674d1e633ecaa138eded41ce78207bb59ce83` / `36250bd6d5b0e304b71d2e3c404fc37cc325d9cd11a80837038a021d0882a29e` |
| Original emitted host / app | `ae0ee1270b586807f0c96987988f970c0048c1844a085d748efe31e4de43b623` / `8110efdf57db9a88236c0c293451db4ac3e4ea9369036bd538d15164f51d8ba7` |
| Projected host / app | `1fbc71672ff1b3d8702b2e77c8d9f6ebd46e415cafeb0b6cc1698b71d1e6f2ec` / `a73cb60cae926cd7809e3a0d04d7e3faec7b9a11cab1ef7f3157bfa5cfd3637b` |
| Installed Playwright 1.62.1 `coreBundle.js` | `9393fa79e1c67c74edc26b610d65a4f7ed73d345a762465cc88340a33a2454ac` |
