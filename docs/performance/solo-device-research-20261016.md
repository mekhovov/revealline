# Device research follow-up — 16 October 2026

Target devices remain the reported iPhone 17 Pro, Safari on iOS 27.0.1, and Steam Deck OLED, Chrome with its default display setting. Neither physical device is available to this qualification host. Record the actual callback cadence, browser/OS version, power state and sustained conditions; do not infer a 60 or 90 Hz cadence from the product name.

The user confirms that the iPhone symptoms occur in a **regular Safari tab and the installed offline PWA**. Private browsing is not the reported context. Qualify those two surfaces separately, including a verified offline launch and foreground/background return. The current controlled online desktop recipes block service workers and therefore do not establish installed/offline PWA behavior.

## Secure-origin and engine controls

WebKit issue 324968 is resolved INVALID, with a maintainer confirming that Safari 27's Enhanced Security can deliberately restrict execution for plaintext HTTP navigations. This is a test-environment warning, not evidence explaining this game's reported symptoms. Physical qualification should use the production HTTPS origin, record `isSecureContext`, and keep browser protections unchanged. A LAN HTTP development server must not be silently treated as equivalent. [WebKit's confirmation](https://bugs.webkit.org/show_bug.cgi?id=324968#c3).

Safari 27 also replaces its module loader and includes image-decoding, module-resolution and rendering fixes. Record the actual engine version in each result; desktop WebKit 26.5 remains supplementary evidence for the user's Safari 27.0.1. The release notes alone do not establish a game defect or justify a browser-specific workaround. [Safari 27 release details](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/).

## Canvas text and iOS 27

[WebKit issue 324693](https://bugs.webkit.org/show_bug.cgi?id=324693), reported on 21 September 2026 and still marked NEW when reviewed, describes GPU-process memory growth when changing short canvas strings use a downloaded font. Its submitted reproduction changes the string once per 60 painted frames. The reporter's constant-text and system-font controls remain stable. This is an open upstream report, not a confirmed cause of this game's warmth or a demonstrated defect in iOS 27.0.1 specifically.

The source has a relevant pattern: `game/ui/event-feedback.mjs` draws a changing recovery countdown, and `game/ui/classic-view.mjs` draws timed effect labels. Theme fonts are downloaded resources defined in `game/ui/field-kit-fonts.css`. Other canvas labels, including direction arrows and event names, use small repeated sets. This inspection establishes exposure to the reported pattern; it does not measure GPU retention. Desktop WebKit 26.5 cannot qualify an iOS 27 engine-specific issue.

Extend physical-device qualification with two fresh-page, otherwise equivalent sustained runs using the existing **Theme font** and **Plain** text preferences. `game/text-face.mjs` already maps Plain canvas text to system fonts, so this comparison requires no production override. Record GPU-process memory where device tooling permits, visible stalls, renderer recovery and the rate of changing canvas labels. Keep those instrumented runs separate from low-overhead timing. Compare memory plateaus across repeated recovery/effect sequences and Demo transitions. Do not silently substitute the system font, add shadow tricks, reset canvases, or claim a fix without reproducing the relevant retention problem.

## Input dispatch and application latency

Chrome documents that continuous input can be aligned with animation-frame dispatch, while discrete events are handled separately. Consequently, an event timestamp can precede the application's first observation because of browser-side scheduling. This is a possible layer to investigate, not an explanation established by the game's measurements. [Chrome input scheduling](https://developer.chrome.com/blog/aligning-input-events/).

The final-artifact touch reports retain event-to-simulation and event-to-render-submission measurements, plus a document event witness. Chrome's nine scenarios preserve every expected observation and pass mechanics and strict replay checks, but their blank reference cadence is unstable. Their latency bounds also exceed twice the provisional median, so this remains a follow-up signal rather than a pass excused by missing cadence qualification. WebKit's three separately declared native-tap scenarios pass their observed-window gates. Neither protocol measures physical input-to-photon latency.

Any follow-up should distinguish native dispatch delay, target-handler work, simulation admission and drawing submission. Do not add an extra animation-frame queue to input handling, change the 120 Hz simulation, lower sampling requirements, or redefine loaded gameplay as the reference cadence to conceal delay.

## Power and Demo

WebKit recommends minimizing unchanged canvas drawing, hidden updates and unnecessary wakeups. The implemented Demo pause and covered-board fixes directly remove such work. Its active noise loop also has an exact-output optimization with separate correctness and microbenchmark evidence. These changes are reasons to test sustained power behavior; they do not establish a temperature reduction. [WebKit power guidance](https://webkit.org/blog/8970/how-web-content-can-affect-power-usage/).

Keep the already supported Reduced Effects preference as an explicit comparison condition. Record it rather than mixing full and reduced runs. Automatic quality reduction remains based on measured application overload, not an assumed thermal state or a stable browser-imposed callback limit. Physical sustained Demo, foreground play and background/return checks remain required before making a device or thermal qualification claim.

## WebKit storage context and required picture preparation

The 8c paired Sentinel attempts failed before gameplay in automated WebKit. Candidate diagnostics recorded an IndexedDB Blob preparation error; baseline attempts had the same visible refusal but lacked the internal exporter, so their exact exception remains unobserved. Two isolated controls reproduced the candidate error without booting the game: metadata saved, while both the original PNG Blob and its empty official-reference Blob failed in nonpersistent contexts. Changing the scoped temporary directory from RAM to APFS did not resolve either failure.

A separately declared fresh persistent WebKit 26.5 context passed the same three controls and the unchanged production managed-store prepare, commit, close/reopen and hash-checked readback. The [evidence summary](solo-webkit-storage-context-20261016.json) retains all three cases, native errors, artifact identities and cleanup receipts. These excluded correctness checks do not qualify gameplay, physical Safari or performance.

[Playwright issue 42795](https://github.com/microsoft/playwright/issues/42795) reports this exact error, with a maintainer identifying unsupported Blob/File storage in private mode. Its contributor's persistent-context control succeeds. [WebKit issue 156347](https://bugs.webkit.org/show_bug.cgi?id=156347) remains the upstream private backing-store Blob support issue. Installed Playwright 1.62.1 creates new contexts through `Playwright.createContext`; its persistent launch alone adds the user-data-directory argument. This source evidence and the local controls support an automated ephemeral-context limitation. They do not show that the historical fixed WebKit issue 188438 has recurred.

Future persistent qualification must declare the context mode and use the same fresh-profile policy for baseline and candidate. Keep all earlier ephemeral failures unchanged. Do not replace a failed durable picture write with session-only history. The user has now confirmed regular Safari and installed PWA usage, so the automated private-context storage limitation does not explain the reported device symptoms. This storage result also says nothing about the separate canvas equality failure.

## Remote browser follow-up

A fresh Linux CI cohort can continue browser correctness checks independently of historical local ownership failures. After the host restart, the 17 October read-only process check no longer observed the old task owners; this does not repair their failed cleanup or verify external-drive availability. Declare its runner image, Node, pinned Playwright and actual engine versions independently; do not pool its observations with the existing macOS timing matrix. Begin with package/worker/paused-render checks and unchanged baseline/candidate public gameplay with strict same-engine replay verification. Timing qualification needs its own stable reference cadence, calibrated stress and three equivalent runs per scenario.

Run one browser observation at a time, with a harness deadline below the job deadline and retained partial reports. These choices follow [Playwright’s CI guidance](https://playwright.dev/docs/ci). No automatic retry may replace a failed observation.

Remote or calibrated desktop checks cannot establish the reported iPhone heat reduction: CPU throttling does not reproduce mobile GPU architecture, memory bandwidth or thermal throttling. Keep both regular Safari and installed offline PWA physical runs, plus Steam Deck Chrome, as distinct acceptance work. [Chrome’s calibration limits](https://developer.chrome.com/blog/devtools-grounded-real-world).

## Canvas color-space and diagnostic controls

WebKit documents sRGB as the default 2D canvas backing color space and notes
that mismatched image/canvas/readback spaces require conversion. Its inspector
can show the actual canvas color space. The canvas-debugging example also shows
context dimensions, memory and recorded drawing operations. These are useful
controls for the retained first-draw raster discrepancy and physical GPU-memory
investigation; they do not establish its cause. [Color-space behavior](https://webkit.org/blog/12058/wide-gamut-2d-graphics-using-html-canvas/).
[Canvas inspection example](https://webkit.org/blog/8452/canvas-debugging/).

Extend the separate instrumented raster investigation with actual context
attributes and image/readback color-space witnesses at creation and recovery.
Use captured drawing operations and canvas-memory inspection outside timing
runs. Keep default rendering and strict initial-draw comparisons intact. No
source found in this follow-up establishes that the game's one-channel-value
history-dependent difference is a color conversion, a driver issue or a hidden
picture leak; neither a forced color-space change nor a tolerance waiver follows.

## Further rendering and power review

The Canvas specification explicitly permits information loss when finite-precision
color values are converted to and from premultiplied alpha. That explains why
8-bit readback cannot expose every internal rendering distinction; it does not
explain the retained identical-input first-draw discrepancy or justify relaxing
its strict gate. [Canvas alpha representation](https://html.spec.whatwg.org/multipage/canvas.html#premultiplied-alpha-and-the-2d-rendering-context).

Safari 27 beta notes include additional linear color spaces and fixes involving
unnecessary Canvas2D compositing layers and observer performance. A separate
WebKit GLib Display P3 issue was fixed in August 2026. These establish that
backend/version details matter, not that a particular fix is present in the
installed desktop WebKit or explains iPhone Safari. The next raster diagnostic
records actual context attributes after the fixed draws, separately from an
unchanged control; it changes neither context options nor pixel tolerances.
[Safari 27 beta notes](https://webkit.org/blog/17967/news-from-wwdc26-webkit-in-safari-27-beta/),
[GLib color-space issue](https://bugs.webkit.org/show_bug.cgi?id=321596).

The new Linux correctness reports retain severe title callback gaps while the
measured Phaser frame work is low. Source review found a separately scheduled
menu artwork WebGL renderer and CSS/SVG animation outside that measurement
boundary. This is a concrete attribution target, not proof of causation.
Inspect its actual rendering and callbacks in a separate instrumented run;
do not warm the title until it looks healthy or redefine loaded cadence as B.
WebKit's power guidance covers both GPU work and painting outside JavaScript,
and its CPU timeline separates script, layout and rendering. Chrome's paint
flashing can identify unexpectedly large repaint regions. These diagnostics
remain separate from low-overhead qualification. [Power guidance](https://webkit.org/blog/8970/how-web-content-can-affect-power-usage/),
[CPU timeline](https://webkit.org/blog/8993/cpu-timeline-in-web-inspector/),
[Rendering diagnostics](https://developer.chrome.com/docs/devtools/rendering/performance).

The menu artwork owner also needs to defer preparation, not just animation,
while stopped. Its image-load, profile-update and context-restoration callbacks
can otherwise compile shaders and upload textures behind another screen. The
targeted correction belongs in that existing owner; showing the menu again must
prepare the latest image and preserve its CSS fallback. This follows WebKit's
recommendation to stop hidden work and reduce unnecessary drawing, without
changing gameplay callbacks or introducing a second scheduler.

MDN recommends compiling shaders and linking programs before querying their
status, because synchronous status checks can stall. The optional
`KHR_parallel_shader_compile` extension permits nonblocking completion polling;
it does not promise less total compilation work and is not universally available.
The current menu shader's synchronous checks remain a separate preparation
attribution target. A shader rewrite or a compatibility-dependent startup path
is not justified by the present traces alone. [WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices),
[Parallel shader compilation](https://developer.mozilla.org/en-US/docs/Web/API/KHR_parallel_shader_compile).

## 17 October review: controlled worker diagnosis

The latest WebKit worker smoke validates the MP3 structure but records a visible, focused long-frame pause. A successful worker result alone does not establish uninterrupted gameplay. Compare separately declared fresh worker and idle controls, retain every interruption and the existing bounded application phase/work evidence, and profile attribution separately from qualification. The PROXX example shows why moving work off the main thread can improve responsiveness without reducing total processing cost; it does not explain this particular pause. [Off-main-thread example](https://web.dev/articles/off-main-thread).

The canvas-text GPU-memory report remains NEW on this review, with no upstream resolution. Keep the existing Theme-versus-Plain physical-device comparison; do not attribute the Linux worker interruption to that different engine-specific report. [Current WebKit issue](https://bugs.webkit.org/show_bug.cgi?id=324693).

## Further measurement review — 17 October

WebKit's Rendering Frames example separates script, style/layout, painting and compositing within a frame. Application update/draw counters cover only their instrumented boundaries. Here, the accepted-Start continuation changes overlay visibility, focus and HUD after the prepared board's submission. That is a measurement boundary to investigate; it is not evidence attributing the retained 204 ms or 309 ms intervals to layout. Keep application readiness distinct from physical presentation and capture separate inspector traces where the reported browser permits them. Do not delay input or cap native callbacks as a speculative cure. [WebKit frame inspection](https://webkit.org/blog/3996/introducing-the-rendering-frames-timeline/).

Current WebKitGTK/WPE documentation describes different rendering threads, compositor coordination and display-link integration for those ports. The hosted Linux WebKit observations therefore remain a distinct platform stratum from Apple Safari, even when replay outcomes agree. A strict raster failure on one port is retained and investigated there; a pass on another cannot overwrite it. [WebKit port graphics architecture](https://docs.webkit.org/Ports/WebKitGTK%20and%20WPE%20WebKit/Graphics.html).

The audio identity probe itself must also fit the baseline workload: its original 64-record limit saturated after 95 source requests, although copied encoded bytes remained below 16 MiB. The prospective correction increases only bounded diagnostic record capacity to 128 and keeps per-source/aggregate byte limits, readiness deadlines and native playback unchanged. These probes copy and hash bytes and remain excluded from timing and memory-plateau evidence. A missing probe identity is not proof that the browser decoder or audible playback failed.

## Frame-cost investigation after the cold comparison

The completed cold comparison leaves roughly 3.75–4.03 ms of mean callback work outside the measured update and painter spans. Phaser documents its game POST_RENDER event after all scenes have drawn to the canvas; it is still a submission boundary, not browser compositing or physical presentation. A separate CPU profile can attribute sampled JavaScript within this boundary, but cannot establish GPU completion. Preserve whole-callback measurements alongside nested update, HUD and simulation spans; never add nested durations twice. [Phaser game render events](https://docs.phaser.io/api-documentation/namespace/core-events), [Canvas renderer lifecycle](https://docs.phaser.io/api-documentation/class/renderer-canvas-canvasrenderer).

Chrome's Long Animation Frames example distinguishes total frame duration from blocking duration: several short tasks can collectively delay a frame even when none is individually a long task. Its script attribution excludes workers and only covers scripts above its attribution threshold. Therefore retain the ordinary callback-interval histogram for the observed 20–40 ms frames, use a separately instrumented CPU/renderer recording for causality, and do not interpret zero long tasks or a completed worker as proof of smoothness. Keep profiler runs out of the numerical acceptance cohort. [Chrome's examples and attribution limits](https://developer.chrome.com/docs/web-platform/long-animation-frames).

## Updated Safari and media interpretation

Safari 26.2 added Event Timing support. Physical Safari follow-up should feature-detect it and may use it as a separate discrete-interaction diagnostic; the existing application event-to-render measurements remain necessary for continuous steering and controller input. API availability does not turn those application measurements into physical input-to-photon measurements. [WebKit release notes](https://webkit.org/blog/17640/webkit-features-for-safari-26-2/).

Playwright documents that its WebKit builds use different media implementations and codec support across operating systems. The hosted Linux music import reaches the first native media probe and then exposes no imported playlist; the same code path exists in baseline and candidate. Record the public import status before later preferences overwrite it, and investigate that concrete failure before attributing it to the MP3 worker or Apple Safari. Installed codec packages alone do not establish successful playback. [Playwright platform distinctions](https://playwright.dev/docs/browsers#webkit).

## Backing-store recovery review — 17 October

Safari Technology Preview 253 documents fixes for a canvas self-copy recycling regression and a context remaining unusable after temporary backing-store allocation failure. These are engine/version-specific examples, not evidence that the user's installed Safari contains either fault or fix. Keep a separate native diagnostic for actual source/destination canvas identities, allocation failure, context restoration and repeated resize/recovery memory plateaus. Preserve the existing explicit Resume boundary and authoritative run. Avoid introducing self-copy operations or forcibly resetting healthy canvases as a speculative workaround. [WebKit release notes, Canvas](https://webkit.org/blog/18357/release-notes-for-safari-technology-preview-253/).

## Native retention and measurement review — 17 October

WebKit fixed unnecessary native cache retention of completed Blob reads in commit `321948@main`, following a WKWebView reproduction. The report explicitly distinguishes retained memory from proven unbounded growth. This supports measuring process/native retention alongside JavaScript and application-owner counters over repeated loads; a stable JavaScript heap alone cannot close the memory gate. It does not establish that iOS 27.0.1 contains the issue or fix. Preserve bounded existing Blob ownership and validated binary resources; do not add speculative repeated reads, forced collection or a global cache purge. [WebKit report](https://bugs.webkit.org/show_bug.cgi?id=324952), [reviewed fix](https://github.com/WebKit/WebKit/pull/74834).

WebKit's frame-rate explainer describes refresh-rate adaptation and power tradeoffs. It is a proposal and historical rationale, not a current device capability table. Keep native callbacks and the measured pre-play reference; record actual cadence and power state on both target devices. A stable inexpensive 30 Hz session must remain distinguishable from loaded gameplay missing a previously established faster cadence. No user-agent-based frame-rate cap follows from this source. [WebKit explainer](https://webkit.github.io/explainers/animation-frame-rate/).

App diagnostics and the new hitch journal require separate overhead comparisons. The existing application-work stopwatch does not cover all journal work: the journal's end-of-work callback, rAF wrapper and native-observer delivery have costs outside that window. A journal comparison must therefore include a symmetric bounded observer-envelope measurement in both arms, alongside application work and callback cadence. Keep all matched results and use normal browser timer precision; the smallest observed timer step is not a guaranteed error bound because the specification permits coarsening and jitter. Neither an app-diagnostics pass nor a journal's bounded storage proves the journal's five-percent overhead gate. [High Resolution Time](https://w3c.github.io/hr-time/#coarsen-time).
