# Journey transitions: native timing observations

2026-09-21. Source `3581a85212b946ec86b6ea2e3592ab67b16534a8`.
This is a bounded P13/P15 evidence unit, not a gameplay optimization, phase
acceptance or a deployment claim. No production game file, content identity,
picture, physics, award or release version changes in this unit.

## Method

The development-only [observer](journey-performance.html) embeds the real
`whole-spatial-v4` Solo/Versus pages. Native browser clicks and keyboard input
operate the actual game. The observer does not create input, read engine state,
complete missions or change results. Its files are outside the release include
list. It records ordinary DOM readiness in two consecutive animation-frame
callbacks after activation. This is **not physical input latency or proof of
two painted frames after readiness**. Polling/layout reads/log rendering add
observer overhead.

Native in-app browser, local no-store server, 1280×561 embedded viewport, DPR 2;
exact `7d1f99dd` fallback supplies absent sparse media, as in the earlier source
preview. Existing browser/process load was not controlled. These single samples
are not medians, low-end-device results, or the public distribution's CDN/cache
performance. A navigation reload is not a cleared browser-cache experiment.

The normal game still saves progress; only the observer log is session-only.
No new telemetry is sent. Title/flight/Versus error channels, cancellation,
focus departure, visibility loss, supersession and timeout discard samples.
Restart starts at confirmation, not while a person decides. End-of-Journey
chooser actions are excluded. Boot-inert shells and Versus result-review boards
are not accepted as ready play. Next/Skip must change the mission; chooser
readiness retains the correct mode-specific mission identity.

## Observed results

| Action                                                               |                     Solo |                   Versus |
| -------------------------------------------------------------------- | -----------------------: | -----------------------: |
| Load → usable menu                                                   |               2,312.2 ms |               2,123.4 ms |
| Continue / prepared race Start                                       |               1,171.4 ms |                  17.1 ms |
| First Return clear → deliberate Next activation → next ready mission | 595.9 ms from activation | 292.1 ms from activation |
| Confirmed Skip → Two Keepers ready                                   |                 560.6 ms |                 254.2 ms |
| Confirmed restart → fresh Two Keepers ready                          |                 386.9 ms |             Not measured |

Solo First Return was won by an ordinary downward cut, with 34.3% earned coverage,
three lives and 8,160 points. Time spent waiting while inspecting the observer is
not a route pacing measurement. Versus ended when Player 1 cleared first; this
native check does not assert simultaneous input or two successful clears.
Next and Skip reached fresh boards with 0% coverage and three lives.
The restart activation was reported as `isTrusted:false` by the browser after
native accessibility activation; retain that distinction, not a hardware-input
claim. Other listed gameplay activations were `isTrusted:true`.

The recorded Continue/Next/reset observations are below the corresponding local
readiness targets (2,000/1,200/1,200 ms). They do not close those device-level
acceptance gates. Win-to-usable-Next ≤350 ms, automatic damage recovery ≤800 ms,
automatic attempt reset, Team, ten consecutive missions and physical controllers
were **not timed** here.

Earlier observer-development samples (including 507.8 ms Continue and 562.5 ms Skip)
are not pooled into a statistical baseline. The retained Solo observations were
collected after the initial cancellation/restart/boot safeguards; subsequent
hardening corrected cross-mode identity, added title-channel coverage and blur
discard. No such failure/blur occurred during those retained successful Solo
samples. Versus was measured after these corrections. Game source stayed fixed.

## Findings and next work

The measured Continue/Next/confirmed-restart samples are below the stated local
targets. There is no evidence here to justify changing physics or stripping
verification from preparation.
Initial module transfer is the clearer unresolved concern. At menu readiness,
the browser returned 250 resource entries in both modes, which may saturate its
buffer. The returned entries alone included 4.27 MB of decoded Solo JavaScript and
2.61 MB of decoded Versus JavaScript. These are lower bounds, not complete bundles.
The [benchmark report](../../.gstack/benchmark-reports/2026-09-21-benchmark.md)
and [raw numeric record](../../.gstack/benchmark-reports/2026-09-21-benchmark.json)
preserve missing metrics as null and make no before/after claim.

Next technical item: profile and reduce unnecessary startup module loading with
exact historical route/runtime comparisons. Establish a controlled repeated-run
baseline before optimization, preserve normal compiler validation and artwork
ownership, then measure again. Public and physical-device gates remain separate.

The primary documentation recheck supports increasing the resource timing buffer
before claiming a complete inventory: its initial required capacity is 250 or more.
See [MDN resource timing buffer](https://developer.mozilla.org/en-US/docs/Web/API/Performance/setResourceTimingBufferSize).
Dynamic imports can defer non-critical modules; applying them to historical
candidate factories is a proposed next experiment, not a proven saving here.
See [MDN lazy loading](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Lazy_loading).

## Verification

Thirteen observer regressions pass on Node 20.19.5 and 22.22.2, with no failures,
skips, cancellations or todos. Independent review reran both versions and
verified the corrected host contracts. These test measurement boundaries, not
game enjoyment or browser speed. Native observation supplies the timings above.
Formatting, lint and diff checks pass. Human difficulty, capture understanding,
accessibility, full performance qualification and P00–P15 acceptance remain open.
