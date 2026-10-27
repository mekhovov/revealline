# Delayed Missions construction during Solo

Source under investigation: `2c519bfe94b6364a57c71ba40b7212c71f0994ab`, tree `76f5c88845d0340ae27e13f5ab61b0c82a9ac1bf`. This report records a reproduced scheduling defect and retains the earlier inconclusive startup observations. It is not a native-browser performance pass.

## Reproduced defect

The public host test opens Missions, holds its actual mission-index response, dismisses the opening through Featured Start, waits for active Solo, then releases the response. The existing loader reads `content-design/themes.json` and constructs `journey-collection` while `flightState` is `running`. The run object and authoritative checkpoint remain identical; the diagnostic does not advance simulation frames or mutate private game state. The bounded test fails its intended assertion in 11.79 seconds.

`getUnifiedMissionLibrary()` checks page disposal only after its asynchronous catalogue construction. Its earlier import, index, theme and profile awaits can therefore resume expensive constructors after the original UI intent has ended. Its nested route, spatial-edition, installed/custom and creator owners also need checks before their asynchronous continuations perform work. Holding the shared main-work slot across this entire asynchronous operation would be incorrect: optional network activity could block required Start preparation, and nested admission could deadlock that slot.

The integrated correction checks eligibility before compilation, validation, registration and DOM publication. Each pending construction belongs to its run, foreground lifetime, phase generation and current callers. Valid callers may coalesce, completed catalogues remain reusable, and retired partial owners are disposed. A fresh explicit Missions request starts new work; merely pausing again cannot revive an old request. Native module imports already submitted cannot be synchronously canceled, and synchronous work already entered cannot be preempted. Their eventual results do not authorize retired construction or adoption.

Nine complete source test files pass 199 controls, including five public delayed-response cases, six continuation controls and all eight lifecycle cases. The exact fifteen-path patch has SHA-256 `c10e4d387513523b65130ab6532a383b5bb0a740a5229a75834cf386dfa43ef6`; the final review receipt has SHA-256 `f7a8847504f952941181c349d63498425b79fb8e1a54223f24483b27e6bd8c0a`. All reviewed runtime and test bytes matched before and after integration. The lifecycle test awaits the actual new Missions handler, then asserts the current 240-card catalogue, unchanged checkpoint and explicit Start behavior. Retained earlier attempts expose the obsolete five-second reuse assumption and 201-card count; production deadlines were unchanged. Two unrelated published-provider shape assertions also fail on untouched source and remain recorded separately. These checks establish ownership behavior, not native speed.

## Separate source profile

A source-only run of the complete `backup-content-feedback-host.test.mjs` passes 10/10 in 30.46 seconds under CPU profiling. It retains a 9,593,831-byte profile with SHA-256 `8f91f25bd47cfc226a969993491defcbbd145406f04a1168bfe5a2b9d07cfeed`. About 8,002 ms of inclusive sampled work is under the eighth page's unified-library builder, including unrelated Team/Duel construction. The diagnostic also observes a 10,521 ms event-loop gap. These overlapping measurements must not be summed, and the profile and diagnostic clocks were not independently mapped for interval-level attribution.

The WebCrypto wrapper records 904 digest submissions, no dropped records, and a longest inclusive settlement of about 430 ms. This does not identify hashing as the CPU cause. A digest promise's settlement includes scheduling delay; the Web Crypto specification copies input bytes and performs the digest asynchronously. A UI status that still says “verifying” is an owner/location observation, not a CPU profile. [Web Crypto digest algorithm](https://www.w3.org/TR/webcrypto/#SubtleCrypto-method-digest).

The first delayed-Missions diagnostic compared a full DOM object with `null`; assertion formatting itself consumed excessive memory. That owned diagnostic was terminated with exit 143 after 41 seconds, retaining its 201-byte causal witness. Its successor compares a boolean and completes with the intended assertion failure. The first attempt is retained as partial diagnostic output, not a completed test.

## Earlier CI remains unattributed

The superseded e9 focused run retains four initial-picture failures. Three public status observations report per-asset release-artwork verification; one reports downloading. The observations show a visible, focused, current document, and no captured application error. The fixture reports zero pending reads at one verification failure. Neither a hidden page, backup-lock wait nor native image/font decoding is established at that point.

The new catalogue reproduction establishes a real route for unrelated work to obstruct startup or active play. It does not prove that route caused each historical CI timeout. Those failures remain failed and unattributed until their own evidence supports a narrower conclusion. Original predicates, first-frame order and deadlines remain unchanged.

Raw source evidence is under `.cache/solo-followup/startup-owner-trace/` and `.cache/solo-followup/late-library-admission/`. The complete e9 four-shard readback is under `.cache/solo-followup/integration-e9f/focused-superseded/`: all 201 planned commands are accounted for, 77 started and 124 did not start; every receipt remains planned with no completed aggregate result.

## Plan correction

Add a delayed optional-Missions response followed by public Start/Resume, hidden-page completion, teardown and explicit retry to source and final native readiness coverage. Verify every nested continuation, not just the initial request. Keep the UI responsive during explicit menu preparation and avoid unnecessary work before considering a worker. Breaking functions apart does not itself yield to the browser; work still runs to completion within its task. [Browser long-task guidance](https://web.dev/articles/optimize-long-tasks).
