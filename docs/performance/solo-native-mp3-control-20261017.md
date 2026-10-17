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

## Retained Linux backend outcome

The declared backend control ran once as
[39004951647](https://github.com/mekhovov/revealline/actions/runs/39004951647),
attempt 1, exact source `adb1c0c7b7dd1a526a0693917f2012d1dbc08b22`. It remains
**failed**. Both preparation and browser commands closed without forced cleanup,
ambiguous processes, survivors or resource violations; the persistent profile and
loopback server also closed. The browser command returned exit one to preserve
the native/completeness failure, not because of a process-owner leak.

The actual launcher is pinned Playwright 1.62.1 WebKit revision 2336, version 26.5,
**Linux WPE/headless**, with its launcher bytes retained. The original Bossa Blob
was 1,196,325 bytes, SHA-256
`0ee835fd279ac5fa15f9346744cbafc2ba800c1c0671b78ca9abe2b4353402f7`,
with structurally validated duration 59.61142857142857 seconds. Transport completed
with the same byte identity, no page errors, no source changes and no seeks.

The two observation channels have different completeness:

- All **30 independent 500 ms samples** were retained, with zero dropped samples.
  Five seconds of passive metadata reported duration zero. Trusted playback then
  advanced continuously for 9.576013384 seconds, with no discontinuity. The final
  observed duration was 9.995923815 seconds, far from the structural duration.
- The **64-record event/lifecycle channel saturated**, dropping 23 further
  records. This remains an incomplete channel and prevents diagnostic completion.
  Independent samples establish observed progression; they do not reconstruct
  dropped events, prove full recording playback or promote the run to a pass.

The complete 160,933-byte browser log contains 600 `webkitmediaplayer` category
lines. At 72 points (first raw line 89, last line 652), the backend reports its
native duration-cache adjustment to current playback position. This corresponds
to `MediaPlayerPrivateGStreamer::recalculateDurationIfNeeded()`: the primary
implementation covers both non-finite cached duration **and a finite duration
already behind currentTime**. Thus the log plus samples supports native duration
chasing playback position; it does **not** establish that each upstream duration
query failed, nor the exact reason the initial duration was zero. The backend
summary's `durationQueryLines: 0` is its narrower query-pattern count and does not
contradict these separate cache-adjustment lines. [Primary WebKit implementation](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/platform/graphics/gstreamer/MediaPlayerPrivateGStreamer.cpp).

This independent native page contains no game code. The evidence narrows the
Linux result to its media backend rather than proving an application source-
lifetime defect. It does not establish behavior in macOS WebKit or iPhone Safari.
The application still requires finite positive native duration agreeing with
validated structure; that guard, media bytes, import timeout and failure status
remain unchanged. No further Linux rerun is released by this observation.

Artifact `12090587461` is 26,928 bytes, SHA-256
`1cc0d7034bb88722293e8919f2313c768ba1b653f8f81b784dec9c8c270743ee`.
All ten members (285,383 bytes) passed authenticated API identity, full archive
hash, ZIP CRC and full local readback. All five admitted tool hashes match their
exact committed adb1 blobs. Retained root:
`.cache/solo-followup/remote-39004951647/small-retained/`; its `analysis.json`
records original failed status, source proof, closed-owner receipts and the
separate complete-sample/incomplete-event interpretation (4,335 bytes, SHA-256
`b17e37d333d9a11826215d0594d01dde36a44cbfebfa4b6a45301931bfd4c2a0`).
`browser.log` SHA-256
is `3c87eb9f029cc0c9c1109abe024cf7b50b27d8ce693713f7c3d9417683cf7ffc`.
No audio or full game archive was downloaded locally.

## Prospective hosted Cocoa counterpart (one-shot admission)

The Linux result is insufficient to attribute behavior to Safari. The next narrow control uses the original Bossa Blob in a fresh persistent context on explicit `macos-15-intel`, with Playwright `1.62.1`, WebKit revision `2336` and native version `26.5`. It retains the same five-second passive window, ten-second trusted Play window, 500 ms independent sampling, an explicit Cocoa-only 128-event capacity, 32 samples, 60-second arm deadline, 300-second command deadline, original byte validation and 16 MiB evidence cap. Saturation remains a failed, incomplete observation. No game duration guard, playback method, recording bytes or qualification threshold changes. The prospective workflow admits only PR1544 from the same repository, on a synchronize event whose previous head is `adb1c0c7b7dd1a526a0693917f2012d1dbc08b22`. It checks out and verifies that event's exact new head as observer source. The prior WPE run remains historical; there is no observed Cocoa result or game-package authority. This codec-only control can run independently of a successful production package.

Before fetching fixtures or creating media, a separate blank-page child must prove the original browser version, zero media elements, `about:blank`, closed persistent context/profile and a clean common process-owner receipt. The process inventory must observe both the browser application and its WebContent/WebProcess child. Missing, ambiguous, incomplete, forcibly cleaned or surviving ownership withholds the media arm; it does not invoke a less strict fallback. The native Cocoa backend has no GStreamer logging flags. The actual launcher, OS, architecture, native version and bounded browser log are retained.

The existing supervisor gains only an explicit Darwin inventory provider, imported on Darwin before spawn. Linux imports, process discovery and signalling remain on their original path. The provider compiles a read-only helper against the runner's SDK using `libproc` and reads exact PID, parent, group, start seconds/microseconds, resident bytes, executable identity and a matching owner-tag bit. It never emits arguments or environment values and cannot signal processes. The supervisor retains pre-existing-process exclusion, ancestor/tag/group ownership, a fresh birth check before each signal, aggregate RSS limits and failed forced-cleanup status. Unknown new processes with incomplete inspection also fail admission. The helper's 16,384-process, 8 MiB-output and three-second call limits are independent of the browser limits.

A process is considered disappeared only after a nonpositive native result with explicit `ESRCH`/`ENOENT`, or a changed birth between the two identity reads. Permission failures, a zero result without an exit error, positive short identity reads and malformed/denied tag inspection cannot become confirmed absence. Denied or partial path/RSS/tag inspection stays explicit uncertainty. Kernel fixed-width names are read with an explicit bound. The helper binary is bound to canonical path, file identity and SHA-256, and every call rechecks that identity. Before native launch, Cocoa admission verifies and copies a bounded receipt of the exact C/provider source hashes, compiler version, SDK path/version, compilation arguments and resulting binary hash, tied to the tooling checkout.

The hosted job is finite: two-minute checkout, one-minute Node setup, two-minute SDK compilation, two-minute contract tests, five-minute browser install, twelve-minute observation step and one-minute upload total 25 minutes within a 28-minute job. The observation step contains a 120-second owner preflight, 180-second original-byte preparation and unchanged 300-second media command, with remaining time for the existing owner drain/cleanup. Raw build provenance is uploaded even if a later test or admission fails. No local browser/server or large package download is required.

Primary sources support the distinction, with limits: [Playwright browser guidance](https://playwright.dev/docs/browsers) recommends macOS for the closest WebKit behavior to Safari, while [GitHub's runner inventory](https://docs.github.com/en/actions/reference/runners/github-hosted-runners) identifies `macos-15-intel` separately from ARM64 and `-latest` runners. [Apple's SDK header](https://github.com/apple-oss-distributions/xnu/blob/main/libsyscall/wrappers/libproc/libproc.h) exposes process inspection APIs, and [the native process structures](https://github.com/apple-oss-distributions/xnu/blob/main/bsd/sys/proc_info.h) provide the start-time fields used here. This is a hosted Cocoa comparison, not physical iPhone qualification.

Release source provenance also remains qualified: [Playwright v1.62.1 configuration](https://github.com/microsoft/playwright/blob/v1.62.1/browser_patches/webkit/UPSTREAM_CONFIG.sh) names WebKit base `343e13bf22dca9d0ec227801419aab0f9001a32f`, whose [`recalculateDurationIfNeeded` implementation](https://github.com/WebKit/WebKit/blob/343e13bf22dca9d0ec227801419aab0f9001a32f/Source/WebCore/platform/graphics/gstreamer/MediaPlayerPrivateGStreamer.cpp#L2931) covers both nonfinite duration and duration behind current playback. [The official revision-2336 roll](https://github.com/microsoft/playwright/pull/41890) maps a browser-build commit, but that build repository was inaccessible here. The configured upstream base is not a verified compiled-binary source hash; the differing runtime log line cannot be attributed to the public patch without evidence.

Local validation is limited and explicit. The four-file control group passed 44 executed tests, with five platform/hosted-only skips; its loopback-server case was excluded to preserve the no-local-server constraint. Full original protocol/owner tests remain declared in the hosted job. The actual installed SDK `27.0` compiled the production C functions for deterministic fault cases: explicit disappearance, second-read disappearance and recycled birth return no owned row; permission, zero-without-error and positive-short identity reads fail; incomplete task/tag reads remain uncertainty. A separate 634 ms control queried only twelve naturally exiting owned Node PIDs (86 live snapshots, seven disappearance snapshots and twelve absent post-reap lookups), with no browser, server, signals or all-process scan. This validates the SDK error handling locally, not the still-unobserved macOS 15 WebKit owner preflight.

The complete green TAP is `.cache/solo-followup/darwin-native-control-final-v2.tap` (12,007 bytes, SHA-256 `c7d3195575aa3940d5989a8675edd8050433cbfbb4e44f159fee8642ab16d3e4`). The final SDK exit-race receipt is `.cache/solo-followup/darwin-owner-sdk-control/exit-race.json` (25,708 bytes, SHA-256 `1bc796976bca9b5ef9d420afc3bda68dbd9f70221a6e9437d4f4ed4329b53efe`), binding C source `2ea45f3a19e568b7f63edeb4d2699b01d269dc0e86d7e1bb0cb5d03039884c62` and provider source `f93dd0b8c0cd4c2a569c283a00cd922d27f79e92a791d982acf2eeb71e2b1e2a`. Initial fixture-escaping failures and the earlier exit-race control remain retained beside the final results. Scoped lint, formatting and SDK warning-as-error syntax checks passed.

A final Cocoa-only retention correction copies original preparation provenance immediately after the preparation command settles and before asserting successful preparation. Failed HTTP requests therefore retain the requested URL, response URL and status already recorded by the fixture writer. Fixed reads are capped at the existing 1 MiB report limit plus one overflow-detection byte; symlinks, replacement, concurrent mutation and overwrite are rejected. Partial JSON is retained as raw incomplete evidence, and a missing file is explicitly unavailable. The original failed command still withholds media; a successful command additionally requires successful provenance retention. Legacy Linux formats keep their existing behavior.

The focused four-file group after this correction passed 45 executed controls with five hosted/platform skips, including failed/partial/missing/oversized/symlink/overwrite provenance cases. The local server case remained excluded. Raw TAP `.cache/solo-followup/cocoa-provenance-contracts.tap` is 12,266 bytes, SHA-256 `04ade46a7bcf96daf36ba7e31835747a341dc53ac78d2ee9e017281c0ef51120`. Scoped lint and formatting passed; common process ownership, runtime source and observation limits did not change.

Before any Cocoa dispatch, its event capacity is prospectively set to 128 through the explicit `cocoa-128-v1` mode. This follows the retained Linux observation's 87 record attempts (64 retained and 23 dropped), including 72 `durationchange` events. The 40 `timeupdate` events were counted separately and did not consume this buffer; the evidence does not establish an ordinary timeupdate overflow. The Cocoa change preserves 32 independent periodic samples, the original five-/ten-second windows, all timeouts and the 1 MiB report/16 MiB evidence limits. Legacy formats still use 64 records and their historical failed results stay failed. An absent or different capacity declaration, or any overflow beyond 128, still prevents a complete Cocoa diagnostic.

The final contracts passed 46 executed tests with five hosted/platform skips, including identical 87-attempt controls that preserve all Cocoa records while reproducing legacy truncation, explicit overflow and missing-capacity rejection. Final TAP `.cache/solo-followup/cocoa-provenance-cap-contracts-final.tap` is 12,520 bytes, SHA-256 `7f0c35e8eaa87a2131d281f8fecfc35f6679a9ff53cafd14be4cfaad51c2113a`. This changes bounded diagnostic retention only; it supplies no game or performance qualification.
