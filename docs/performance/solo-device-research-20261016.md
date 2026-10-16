# Device research follow-up — 16 October 2026

Target devices remain the reported iPhone 17 Pro, Safari on iOS 27.0.1, and Steam Deck OLED, Chrome with its default display setting. Neither physical device is available to this qualification host. Record the actual callback cadence, browser/OS version, power state and sustained conditions; do not infer a 60 or 90 Hz cadence from the product name.

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
