# Native MP3 controls — retained incomplete result and bounded successor

This control follows the captured finite-zero import in run 38998342774. The
implementation adds a separate one-shot diagnostic, with no game runtime change
or performance credit. The original four-arm execution is retained below as
incomplete; the separate one-arm backend observation has not run. The application's
finite, positive, at-most-720-second duration and
structural-duration agreement checks remain intact.

## Original four-arm result

[Run 39001646076](https://github.com/mekhovov/revealline/actions/runs/39001646076)
finished with failure on tooling/source
`cce49c81d82b79aefc24898f32eeebc609e569fb`. Artifact `12089406092` is 20,428 bytes,
SHA-256 `280027f5534dff769fb54559a8a093a768c8acaa49699055d79a975a4b257dab`.
The API identity/digest, complete ZIP CRC, all eight member hashes and extracted
readback passed. The 283,425-byte original report has SHA-256
`431f5b5f6f2260c6b8e111195f3489c2cd1c6c626212b88cc4f43936fca704f7`.
Local retention is `.cache/solo-followup/remote-native-mp3-39001646076/retained`;
the compact 24,362-byte analysis has SHA-256
`a15c923dbb58f42749e7aa27fa08d24911ed5506a16971012251825b328f1745`.

Every arm retained native `loadedmetadata` with **finite 0**, `readyState=4`,
`networkState=1` and no media error. Duration remained 0 at the five-second
passive boundary. Each trusted Play gesture fulfilled and emitted `playing`.
Each then emitted 42 duration-change events, exhausting the shared 64-record
buffer before any playback-period sample was retained. The separate pre-cleanup
snapshot survived the cap:

| Arm          | Metadata at (ms) | Terminal duration (seconds) | Terminal currentTime (seconds) | Dropped records | Diagnostic          |
| ------------ | ---------------: | --------------------------: | -----------------------------: | --------------: | ------------------- |
| Bossa / Blob |               91 |                 0.009644639 |                   10.008043717 |              23 | Failed / incomplete |
| Bossa / HTTP |               71 |                 0.006761478 |                   10.008522295 |              23 | Failed / incomplete |
| Party / Blob |               63 |                 0.007589570 |                   10.006357459 |              22 | Failed / incomplete |
| Party / HTTP |               64 |                 0.006512923 |                   10.009751648 |              22 | Failed / incomplete |

These durations differ substantially from the unchanged structural durations
59.61142857142857 and 96.05224489795918 seconds. All terminal snapshots still
referenced the assigned original source, with `readyState=4`, `networkState=1`,
no media error, `paused=false` and `ended=true`. Their currentTime values alone
cannot prove continuous native progress, decoded audio, audible output or complete
recording playback. The original `nativeProgressObserved=false` / zero-continuous-
progress fields remain unchanged and **inconclusive**, because all playback
samples were dropped. Cleanup was submitted, but its before/after records also
fell beyond the cap; no retained post-cleanup metadata is claimed.

All original asset hashes matched. Requests completed with status 200 and no
request, range or page-error overflow. HTTP response-header fields in the server
receipt are null because this recorder reads `getHeader()` after `writeHead()`;
this is a receipt limitation, not evidence that response headers were missing.
The full preliminary fetch separately validated MIME, length and hash. All four
contexts/profiles and the server closed within the declared bounds. The owned
preparation and browser processes closed without forced cleanup, unattributed
processes or survivors; browser exit 1 preserves the four cap failures.

The observed processes were WPE MiniBrowser/WebProcess/NetworkProcess, on Linux
with Playwright 1.62.1, WebKit revision 2336 / reported version 26.5. The executable
launcher SHA-256 is
`a85baad3d8c07173ac387a59b41500c382b21ed692afe0964d29aac247ccc63b`.
The installed host GStreamer package inventory is incomplete (`gst-inspect-1.0`
was unavailable), and cannot identify the plugins actually loaded by the bundled
browser. The 93-byte browser log contains no useful native pipeline diagnostics.

This demonstrates neither a Blob-only nor a Bossa-only early-zero condition.
It does not support a game guard change or an iPhone Safari diagnosis. All four
results remain failed and excluded from gameplay/performance qualification.

## Original declaration: question and fixed inputs

Does the exact audio produce a later valid native duration or playback progression
when application cleanup is absent, and does the result depend on Blob delivery?
Use one isolated hosted Linux job with the same Playwright 1.62.1 / WebKit 2336
(`26.5`) WPE headless binary. Retain executable/registry, OS and available
GStreamer plugin/package identities; missing inventory tools are an explicit
diagnostic limit, not a reason to install an unreviewed media stack.

Reuse only the verified original bundle and assets; do not transcode or alter
tags, frames, headers inside the files or expected identities:

| Input           |     Bytes | SHA-256                                                            |
| --------------- | --------: | ------------------------------------------------------------------ |
| Original bundle | 3,124,928 | `aa25ae643608cfa9a2dd6aac1a3dcd7ba65d667f998144d0927c194df7c1e99f` |
| Bossa Nova      | 1,196,325 | `0ee835fd279ac5fa15f9346744cbafc2ba800c1c0671b78ca9abe2b4353402f7` |
| Party Sector    | 1,925,141 | `77e1ad0bd0a7c5625a12eaa1c8099408ede6959b2ee2dbf5bace85d09a602ada` |

Four declared controls, serial and without retries: Bossa/Blob, Bossa/HTTP,
Party/Blob and Party/HTTP. Each uses a fresh owned persistent context with the
original music observation's 1280 × 800 / DPR 1 desktop display and CPU factor 1. It
loads a small standalone diagnostic page; no game, imported playlist, save,
simulation, replay or production-build result is claimed. A production-package
download is unnecessary for this browser/codec control.

## Observation

1. Prepare the existing exact bundle through the explicit creator-download path,
   verify its pinned length/hash and every original recording byte/hash.
   The owned loopback server serves only these assets and the diagnostic page,
   with explicit `audio/mpeg`, exact length and validated single byte ranges (prefix, open-ended and suffix forms); malformed,
   multiple and unsatisfiable ranges remain rejected.
   Preserve bounded request/response metadata. Blob mode materializes the same
   verified bytes with MIME `audio/mpeg`; HTTP mode points to those same bytes. Each fresh context first fetches and hashes the full recording
   under `no-store`; HTTP playback then uses the same owned immutable file.
   This is a controlled delivery comparison, not a cold-cache benchmark.
2. Create a native audio element and attach listeners before source assignment.
   Set `preload=auto`, assign the source and call native `load()` exactly once.
   Keep the element and source alive for 5 seconds, even after an early zero,
   NaN or error. This observes the unmodified native element outside the game;
   it does not bypass the production import guard.
3. Use a visible public button to call native `play()` in its original gesture.
   Retain fulfillment/rejection and observe for 10 seconds. Record native playing,
   ended, error, pause, seek and duration/ready-state changes plus bounded
   currentTime samples every 500 ms. Do not seek, change playback rate, replace
   duration, decode whole recordings to PCM or retry after a failure.
4. Separate the first native duration, first finite-positive duration, duration
   at the 5-second boundary, terminal duration, native playback result and largest
   continuous monotonic currentTime advancement. Track seeks, resets and implausible
   jumps; none can count as playback progress. More than 1 second of native progress
   is a control observation only, with no speaker/output-device or full-file claim.
5. Pause, clear the source, load/reset and revoke only the owned Blob URL, then
   close the context/profile. Record cleanup separately from pre-cleanup metadata.

Each arm has a **60-second bound**, including native launch, page/source setup,
the fixed observation windows and cleanup. This corrects the initial proposed
30-second total before any execution: the reused native owner itself permits up
to 30 seconds for launch and 10 seconds for closure. The arm reserves 11 seconds
for native-source cleanup and context closure; insufficient remaining time fails
the arm rather than shortening either observation window. The owned browser
command has a **300-second limit**, with no automatic retry and one active
context. A failed arm remains retained; the next declared arm starts only after
confirmed context/profile closure. Uncertain closure aborts the remainder as
unobserved. The loopback server closes in the finalizer.

Existing process supervision retains 6 GiB RSS and 4 MiB per-command log limits.
Exact original-asset preparation has its own 180-second command bound. Maximum
64 event/sample records per arm, 8 time ranges per state, 32 HTTP request records
per arm and 1 MiB per report JSON. Additional event counts and dropped counts
remain explicit; saturation invalidates completeness. A pending `play()` promise
never extends the observation window. Native zero, error or failure to progress
can be a completely observed diagnostic outcome; none becomes an application pass.
HTTP failures stay distinct from native metadata/playback outcomes.

The evidence directory has a 16 MiB cap (12 MiB working allowance plus 4 MiB final
reservation), including both logs, fixture identity, source identities, process
receipts and final summary. Audio remains only in task-owned scratch, capped at
512 MiB, with at least 1 GiB free disk. The result artifact does not duplicate audio.
Contexts delete only their identity-checked profiles; the remaining exact scratch
is retained on the hosted runner until job teardown. Host package/available
GStreamer version inventory is bounded and labelled host-only; it does not prove
which bundled plugins the actual media pipeline loaded.

The executable entry point is `scripts/solo-native-mp3-control.mjs run <new-output>`.
The new workflow runs only on PR 1544's next synchronization from
`c9e637ad81fadf49caec884155d1bd0c2496c59c`, with no cancellation/retry. It checks out
that event's exact tooling revision, records its identities, installs only pinned
Playwright WebKit and always uploads failures. Its 22-minute job budget covers
2-minute checkout, 1-minute Node setup, 2-minute dependencies/contracts, 5-minute
WebKit installation, 9-minute preparation/control and 1-minute upload limits,
with two further minutes reserved for job initialization and post-job cleanup.
This independent native page uses the existing source preview and public CSP,
not a fabricated production-build identity.

Focused Node tests exercise original native returns/errors, zero before cleanup,
byte/MIME/origin rejection, bounded samples, progress discontinuities, request
saturation, owner cleanup and actual loopback range responses. They are contract
and transport tests, not native browser evidence. All original run results and
qualification gates remain separate.

## Interpretations that the control can support

| Observed result                                                       | Narrow implication and next action                                                                                                                                                                      |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Early 0 becomes a matching finite-positive duration before playback   | A transient native-metadata path is demonstrated. Consider bounded waiting within the existing import timeout, retaining all final validation, only after a controlled application regression proves it |
| Blob remains 0 but HTTP obtains matching duration and native progress | Investigate the Blob delivery/loader path; do not claim an MP3 decoder failure or replace the application's import transport without a reviewed fix                                                     |
| Bossa fails on both transports but Party succeeds                     | Investigate the exact recording's native parser/decoder interaction; original bytes and Chromium playback remain useful controls                                                                        |
| Both recordings fail on both transports                               | Native backend/dependency state becomes the priority; obtain narrowly bounded GStreamer duration/error diagnostics before changing the application                                                      |
| All raw controls pass without transient 0                             | Investigate application context, source lifetime and load ordering; the original failed import remains valid evidence                                                                                   |
| Playback advances while native duration stays 0                       | Native content progression exists, but the application's positive-duration/structural agreement requirement remains unsatisfied; structural duration alone cannot authorize import                      |

The control cannot qualify Safari on iPhone or Chrome on Steam Deck. It cannot
repair or promote the previous failed music recipe, historical first-eight,
raw timing gates or sustained observations. A production change must have its
own causal regression, unchanged validation contracts and actual-source native
confirmation.

## Separate held backend observation

The next question is narrow: **does the unchanged Bossa/Blob source produce
continuous currentTime samples while native duration queries remain invalid or
near zero, and what does this exact Linux backend report about those queries?**
This requires a fresh observation; no old dropped samples are reconstructed.

The explicit `run-backend` entry point declares `SoloNativeMP3BackendControlV1`
and only `bossa-blob`. The original `run` entry point, four-arm order and V1 record
cap remain unchanged. This mode separates up to **64 native/lifecycle records**
from **32 periodic samples**. Either overflow still fails completeness. Both
passive and playback samples must be present (at least two playback samples);
seeks, resets, source changes and implausible jumps still invalidate continuity.
Native returns, events, media values and source cleanup are unchanged.

The original Bossa/bundle identities, 1280 × 800 / DPR 1 / CPU 1, same pinned
WPE headless browser, five-second passive and ten-second trusted-Play windows,
500 ms sampling, 60-second arm limit, 300-second browser command and 180-second
preparation command remain fixed. There are no seeks, retries, media re-encodes,
new decoder flags or game/runtime changes. No timing credit is available.

Only the browser command adds `GST_DEBUG=2,webkitmediaplayer:6`,
`GST_DEBUG_NO_COLOR=1` and `DEBUG=pw:browser`. It clears inherited
`GST_DEBUG_FILE` / `GST_DEBUG_DUMP_DOT_DIR` so backend output cannot bypass the
existing **4 MiB process-log cap**. The 16 MiB evidence cap and its 4 MiB final
reservation remain unchanged. Log saturation is a failed control, even if media
values are otherwise captured. A small summary hashes the complete retained log
and counts actual category/source-line records, excluding merely echoed launch
configuration. Missing category output is explicit and prevents a complete
backend diagnostic; it does not establish a codec cause. The exact installed
launcher source is retained separately with a 64 KiB bound and its hash.

The new workflow `.github/workflows/solo-native-mp3-backend-temporary.yml` admits
one synchronization from `cce49c81d82b79aefc24898f32eeebc609e569fb`, with the same
22-minute setup/job budget, owned command/context/server finalization and always-
upload failure path. All other modes and historical artifacts remain separate.
This declaration is prepared for root review; it has not been dispatched.

The mode selection is supported by the exact
[Playwright 1.62.1 Linux launcher](https://github.com/microsoft/playwright/blob/v1.62.1/browser_patches/webkit/pw_run.sh#L21):
its headless branch chooses WPE, while its default Linux branch chooses GTK.
Changing to headed mode would therefore be a different backend comparison,
not a correction of this cohort. The pinned
[WebKit media source](https://github.com/WebKit/WebKit/blob/343e13bf22dca9d0ec227801419aab0f9001a32f/Source/WebCore/platform/graphics/gstreamer/MediaPlayerPrivateGStreamer.cpp#L304)
registers `webkitmediaplayer`; its duration-query path emits `GST_LOG_OBJECT`,
which motivates the narrowly selected level 6 rather than unrestricted verbose
logging. These source paths identify a useful observation point, **not the cause
of the recorded zero**. GStreamer documents
[category-specific logging](https://gstreamer.freedesktop.org/documentation/tutorials/basic/debugging-tools.html),
and Playwright documents
[browser process logs](https://playwright.dev/docs/ci#debugging-browser-launches).

After this single Linux control, the next media compatibility comparison should
use separately declared **macOS WebKit** with the same exact recordings and byte
proofs. Playwright explicitly recommends macOS for the closest Safari media
behavior because available codecs vary across operating systems.
[Official browser guidance](https://playwright.dev/docs/browsers#webkit).
Actual iPhone 17 Pro Safari remains authoritative for the reported device issue;
macOS WebKit is useful supporting evidence. Successive WPE probes must not be
treated as evidence of an application failure without a causal application
regression. This step does not itself authorize another browser dispatch.
