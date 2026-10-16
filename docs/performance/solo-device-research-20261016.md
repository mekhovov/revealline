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

A fresh Linux CI cohort can continue browser correctness checks while the local browser and external-drive owners remain blocked. Declare its runner image, Node, pinned Playwright and actual engine versions independently; do not pool its observations with the existing macOS timing matrix. Begin with package/worker/paused-render checks and unchanged baseline/candidate public gameplay with strict same-engine replay verification. Timing qualification needs its own stable reference cadence, calibrated stress and three equivalent runs per scenario.

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
