# Host fixture lifetime and immutable-input design review

Status: recommended architecture review authorized by the user's instruction to
proceed on 2026-10-17. This is a read-only design investigation, not a fourth
fixture patch, another full-suite run or permission to weaken verification.

## Established evidence

PR1456 head b71d20781f3224e7d015c0d2dfb20d067a9b84b6 retains a separate
16-file host phase, concurrency two and 600000 ms deadline. Manifest blob
788b7942f7d485e20280aadecf8ba8aa2415538e and runner blob
b82547ce7a227ff589dded4dae1238c9273c7cf1 are frozen evidence inputs.
MRU-selector, immutable-four-response and combined approaches all timed out.
Their incomplete passing prefixes do not qualify the phase. No skipped files,
increased deadlines or narrowed membership are acceptable. PR1496's 41-file
phase and the successful 37-file Linux phase are different workloads, not a
matched passing baseline or proof of a single cause.

## Selected approach and alternatives

Review explicit page ownership/retirement and immutable input preparation before
choosing another implementation. This targets shared fixture boundaries without
changing gameplay. A matched Linux diagnostic is an alternative but requires its
own pinned source/dependency/workload and separately reviewed runner scope.
Deferring the problem preserves safety but blocks 1456 -> 1493 -> 1520.

## Investigation contract

1. Read the complete exact-head fixture and static transitive helper closure;
   identify per-page globals, imports, event handlers, timers, animation callbacks,
   workers, fetches and IndexedDB resources actually owned by the fixture.
2. Produce a lifecycle table for create, ready, active, retiring and retired.
   For every asynchronous entry identify its owner, scheduling point, observable
   completion/cancellation and behavior if it fires after retirement. Distinguish
   fixture-owned resources from application behavior the fixture must observe.
3. Evaluate whether readiness and retirement have explicit observable boundaries.
   Existing pagehide -> setImmediate -> database close -> detach -> restore is
   source evidence, not proof of leaked work. Do not invent a global promise drain,
   catch-and-ignore error path or cancellation that hides real application bugs.
4. Specify immutable preparation separately: exact source hash, read-only bytes,
   bounded lifetime and independent response bodies, with existing caller hooks
   first. Never share DOM, stores, decoded/validated objects or mutable responses.
5. Recommend the smallest justified change only when an actual ownership gap is
   demonstrated. Otherwise recommend a narrowly scoped diagnostic with explicit
   acceptance and failure interpretation, rather than claiming a root cause.

## Deliverable and acceptance

Deliver the source-pinned lifecycle/ownership table, demonstrated versus suspected
gaps, alternatives and a concrete next design with adversarial tests. Required
test design includes post-retirement callbacks, rejected operations, concurrent
pages, hook ordering, restored globals and no cross-page state reuse. Every
original test body/assertion/options remains unchanged; full membership,
concurrency, process boundaries, initial readiness, deadline and zero-skip/source
admission requirements remain intact. No synthetic negative case substitutes for
passing the full original phase on an accepted environment.

No runtime/test/workflow implementation, PR branch update, CI rerun, package
download or browser launch belongs to this design investigation. Retained logs
and profiles are reused read-only. Do not claim Darwin/SMB profile correlations
are controlled Linux performance evidence. Independent spec review and user
review of a concrete implementation design precede changes; this review's
approval does not waive that boundary. Other eligible PRs continue independently.
