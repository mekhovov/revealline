# Bounded elapsed-review lifecycle diagnostics

The earlier strict-focus Urban segment stopped at1,036.3 seconds after blur; a fresh visible-commanded segment later stopped at659.501 seconds on a frame gap above250ms. Both negative reports remain independent. Blur correlation does not establish scheduling cause, and this change does not reinterpret either as a successful endurance run.

The authoring review records a bounded diagnostic trace alongside its unchanged acceptance clock: the last128 focus/visibility/freeze/resume/page lifecycle events, last64 frame intervals, and last64 supported long tasks. Counts and dropped-sample totals remain explicit; long-task names, attribution URLs and unrelated page data are excluded. Unsupported or unavailable observation is reported honestly. Final pending entries are drained and observers/listeners released at segment finish. The terminal interval is captured before clock invalidation; page exit is recorded before the existing cleanup removes listeners.

No production runtime, simulation, timer source, browser flags or acceptance threshold changes. Hidden tabs, context loss, contacts, rejected ticks, viewport changes, wall-clock discontinuities and frame gaps over250ms still invalidate the segment. Focus policy remains explicit; strict is the default. History cannot combine elapsed segments.

Five functional groups verify actual event sequencing, malformed/old task exclusion, bounded snapshots, final draining/cleanup, explicit unsupported capability, and unchanged clock rejection. Existing five observation-policy and seven elapsed-clock/production-flight checks pass. These deterministic diagnostics are not a native elapsed run or hardware result. Root independently reviewed and reran the focused verifier.

The next manual fixture must use a fresh origin, an exact qualified package and separately hashed authoring tools. Every runtime module must match its archive. Keep the prior9162 fixture unchanged. Native full-duration acceptance, physical controls and broader device performance remain separate gates.

References: [Page visibility and focus are distinct](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API); [browser page lifecycle](https://developer.chrome.com/docs/web-platform/page-lifecycle-api). These explain possible scheduling context; they do not diagnose the observed gap.
