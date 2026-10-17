# Bounded startup graphics capability witness

This is an additive setup observation for the explicitly admitted `first-running-v1` readiness diagnostic. It has no native observation yet and grants no timing, graphics, or physical-device qualification. Existing timing protocols, manifests, browser arguments, graphics settings, and gameplay are unchanged.

Chromium documents that headless GPU support depends on its environment. The browser-reported fields improve future interpretation; they do not establish hardware acceleration or explain any retained hitch. The change does not apply Chromium's optional graphics flags. [Chromium guidance](https://chromium.googlesource.com/chromium/src/+/HEAD/docs/gpu/using-gpu-hardware-in-headless-chrome.md)

## Admission and lifetime

Only the already strict readiness admission loads `solo-readiness-gpu.mjs`. After the existing browser/page owner starts and before blank-page cadence calibration, Chromium opens one browser-target CDP session and sends one `SystemInfo.getInfo`. No context, page, animation loop, polling, graphics context, or retry is added. The command requires the browser target; the ordinary page emulation session is insufficient. [Playwright API](https://playwright.dev/docs/api/class-browser#browser-new-browser-cdp-session), [Chromium handler](https://raw.githubusercontent.com/chromium/chromium/main/content/browser/devtools/protocol/system_info_handler.cc)

Creation and request share one monotonic 5-second deadline. The exact session then gets a separate 2-second detach reserve. Both promise delivery and the clock must satisfy the bound. These setup bounds consume the existing outer owned-command budget; the scenario action deadline is initialized later and is not extended or presented as their authority. The bounded result is saved before calibration can begin.

A request timeout, failed or unacknowledged detach, invalid clock, malformed response, or unexpected error fails the row before calibration. A timeout is never cancellation or unsupported capability. A late-created session gets one handled, bounded detach attempt, while the existing browser owner remains responsible for closure; that attempt cannot change the returned failed result or permit measurement. Chromium's internal GPU-information watchdog is not treated as a cancellation guarantee. [Detach API](https://playwright.dev/docs/api/class-cdpsession#cdp-session-detach), [handler lifetime](https://raw.githubusercontent.com/chromium/chromium/main/content/browser/devtools/protocol/system_info_handler.cc)

WebKit and an unavailable Chromium browser-session API are explicit unsupported observations without a session. A known, actually settled unsupported-method response may continue only after detach acknowledges. Other errors remain failures. Native request and detach booleans distinguish these cases.

## Retained information and limits

`environment.graphicsCapability` contains fixed metadata and at most 16 KiB of serialized UTF-8 JSON. It preserves four devices in reported order, actual/omitted device counts, integer vendor/device identifiers, four bounded descriptive device fields, three GL description fields, and eight fixed feature-status strings. Strings are limited by encoded JSON bytes, with missing/nonstring values and truncation explicit. No arbitrary coercion or nested serialization occurs. The final byte check fails on overflow.

Command lines, machine model fields, raw attribute dictionaries, workaround lists, codec details, process inventories, and environment values are omitted. The retained-output limit does not bound the CDP transport response before projection; the existing process/memory owner remains authoritative. The [experimental protocol schema](https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/pdl/domains/SystemInfo.pdl) is recorded as capability data, without deriving backend categories, utilization, presentation latency, or physical input-to-photon results.

The readiness-only finalization also preserves the bounded navigation count used by its existing assessor so the hosted adapter can independently repeat that assessment. Default reports gain neither field.

## Verification

Pure fake-session controls cover ordered request/detach settlement, missing APIs, unsupported versus unexpected errors, one shared deadline, late acquisition/reply/rejection, detach failure, delayed timers, invalid clocks, hostile getters, omitted fields, encoded bounds, and immutable failed results after late cleanup. A test executes the actual guarded qualifier setup block and verifies that saved failure prevents calibration, while the default path neither imports the helper nor gains metadata. No native browser was started for these checks.

The final six complete directly affected test files passed **104/104**, including all **14 GPU controls**. Scoped lint, formatting, and whitespace checks passed. The final receipt is `.cache/solo-followup/readiness-gpu-proposal/direct-v2.tap` (25,892 bytes, SHA-256 `6ab311acdd9bec6c25cd5c875a21f49be703840d91b1efbd39bc909cc9480b60`). Cleanup controls explicitly let Node deliver an unhandled-rejection event after clock failure; none occurs, and continuation remains prohibited.

The first broader nine-file run is retained as **121/125**, not replaced with the focused result: `combined-v1.tap` in the same directory (34,036 bytes, SHA-256 `706875f87ba6d326d4a3ec2f3ecd93c591242c3165243b19fef9048b7f45f7b6`). Its four failures compare historical release pins against an independently edited common runner. No historical manifest was rewritten by this change. Updated historical-source witness checks belong to that runner's separate admission change.

The helper and its complete test must enter the held pilot's frozen tooling/source closure before any future release. Historical executed declarations remain immutable. Native success, overhead, and hardware applicability remain unobserved.
