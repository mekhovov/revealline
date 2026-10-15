# Bounded endurance attribution

This is an authoring diagnostic. It does not change the player, flight physics,
250 ms frame-gap rule, route requirements, observation policy or acceptance clock.
It does not make an interrupted run valid.

## Why this exists

The preserved Urban attempt on origin 9175 started at 2026-10-15T18:15:01.428Z and
became invalid after 102.9565 real seconds / 5,127 ticks. It remained visible and
focused. The report contains a 408.5 ms maximum clock interval and a 417 ms long
task. Its aggregate physics/draw maxima were 300.2 / 191.5 ms; display updates were
at most 1.3 ms. These maxima describe observations at different boundaries, not
exclusive CPU or proof of a responsible function. Reducing live-report work did
not prevent this failure. The original report and frozen source remain unchanged.

That report identifies a main-thread interruption but cannot distinguish snapshot
construction, pilot decisions, simulation, renderer submission, sampling, browser
scheduling or garbage collection. A further production change requires narrower
evidence.

## Collected evidence and bounds

The authoring harness records synchronous wall spans for observer checks, the
snapshot before a tick, pilot command, flight step, the snapshot before drawing,
renderer draw, sample collection, live display, and renderer preparation submission.
The last item ends when the promise is returned; it does not pretend the later
asynchronous preparation or GPU work is synchronous CPU.

Each begin/end writes preallocated typed arrays. The last 128 spans and aggregate
count/total/maximum per phase are retained. Full diagnostic snapshots are built
only when explicitly creating a report, not by the bounded live display. Marking
cost is not claimed to be zero and requires a native observation.

Where supported, a second PerformanceObserver retains the last 16 long animation
frames. It scans at most 64 script entries per frame and keeps the eight longest,
their timing/layout fields and at most 12 overlapping phase examples. Reported
counts and discarded-entry counters expose truncation. Observer callback cost is
recorded. Missing, malformed, unsupported or unavailable evidence stays explicit.
Stopping drains only records already available and disconnects; the terminal frame
may not yet have reached the observer queue. The harness does not wait or alter
acceptance to obtain that entry.

Only same-origin script paths within the game, civilian-FPV runtime and regional
authoring tree are retained. Query, hash, origin, credentials, foreign/unowned
paths and raw DOM invoker strings are excluded. Caller function names and character
positions are bounded. This is not a browser-wide activity trace.

Chrome documents that long-animation-frame script locations identify **entry
points**, which may call an expensive descendant. They do not provide a sampled
stack or garbage-collection cause. Main-thread, same-origin coverage also excludes
some work. Correlating a script and phase is a way to narrow an investigation,
not a causal conclusion. See [Chrome's long-animation-frame documentation](https://developer.chrome.com/docs/web-platform/long-animation-frames)
and [MDN's script timing fields](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceScriptTiming).

## Source audit: allocation candidates, not measured causes

The following production modules matched the qualified `da5df483` runtime used in
9175 byte for byte when inspected. None is modified by this diagnostic increment.

| File under `optional-practice/civilian-fpv/regional/`         | Candidate boundary                                                                                                                                                     |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `flight-prototype.mjs`                                        | Candidate steps clone the body. Public snapshots clone the body and request a terrain snapshot. A step requests terrain readiness and returns another public snapshot. |
| `verified-mixed-window.mjs`                                   | Summing layer geometry/texture/source counts repeatedly calls layer snapshots, including when deriving resident bytes. The mixed snapshot also clones its provenance.  |
| `verified-terrain-window.mjs` / `verified-scenery-window.mjs` | Layer snapshots clone their provenance. Repeated mixed snapshots can therefore repeat these allocations.                                                               |

This establishes allocation sites in source, not their time, frequency in a failed
frame, or GC responsibility. Do not intercept global structuredClone, change
snapshot contracts or reuse mutable player state merely to obtain a faster result.
First correlate a costly interval with these spans, then inspect a bounded native
browser performance trace for the expensive descendant and any allocation/GC
events. Preserve the failed run if trace capture itself invalidates it.

## Verification and next native gate

Run the focused attribution verifier and existing lifecycle, observation and live
display verifiers. They inject API-shaped observer entries and an authoring clock;
they establish timing, bounded retention, teardown, redaction and unchanged gap
rejection contracts. They do not measure real browser LoAF delivery, callback cost,
performance, GC or elapsed endurance.

Before another full endurance attempt, freeze exact tool hashes and qualified
player dependencies on a new origin. The browser owner should make one short
native observation with a single renderer, keep the existing thresholds, and save
its complete report even on failure. Check capability, real phase/caller metadata,
bounded payload, teardown and observer cost. If a gap occurs, compare the overlapping
spans with a native sampled trace before selecting a production correction. If no
gap occurs, report only the short observation; it does not establish two-hour
stability. Preserve all prior negatives and player storage.

The authored review offers an explicit **5-minute attribution review (not
endurance)** between the one-minute review and two-hour endurance. It gives the
existing bounded diagnostic a longer observation window without starting another
full-duration qualification attempt. It uses the same real clock, production
route, 250 ms frame-gap limit, focus policy and disposal rules. Save a failure
honestly; a completed five-minute report still does not qualify the required two
hours. Do not combine short reports or imported history into an endurance pass.
