# v0.17.1 offline worker: independent review

Date: 2026-09-12. Read-only review of the [accepted repair plan](../../round-27-offline-repair-plan.md), [worker template](../../../game/offline/service-worker.template.js) and [worker regressions](../../../game/test/offline.test.mjs). No production files, earlier reports, diagnostic copies or frozen releases were changed by this review. No broad or focused test suite was rerun by this reviewer.

## Finding and resolution

One material lifecycle qualification was reported and incorporated into the plan: rejecting the activation handler's `waitUntil()` promise does not guarantee that the browser restores the previous active worker or leaves the new worker waiting. The specification replaces the previous active worker before running activation; activation errors do not prevent activation. The existing readiness check protects this handler's cleanup and client-claim operations. The installation promise, which must succeed only after complete verified writes, is the relevant earlier protection. [Service Worker activation algorithm](https://w3c.github.io/ServiceWorker/#activation-algorithm), accessed 2026-09-12.

The accepted plan now states that distinction, and the new failure regression explicitly tests the handler guard rather than claiming browser rollback. No additional concrete implementation defect was identified in the reviewed repair.

## Reviewed boundaries

- Inventory count and integer byte limits are checked before network downloads. The original response reader feeds one exactly sized application buffer; chunks are rejected before copying if they exceed the remaining space. Truncation and wrong hashes fail. Reader cancellation and lock release are present. This bounds retained application payload, not all browser memory or a browser-provided chunk's allocation.
- Reconstruction preserves successful status and status text, including empty text. Zero-byte 204/205 responses receive a null body. Delivered bytes are verified before `Content-Encoding` is removed and `Content-Length` is replaced with their verified length; other exposed headers are copied. This matches the distinction between network content decoding and a constructed response body. [Fetch statuses, response initialization and content decoding](https://fetch.spec.whatwg.org/), accessed 2026-09-12.
- The network path does not clone and retain an unread original response. Installation and missing-file repair share the bounded downloader. Repair constructs separate responses for cache consumption and the caller. Partial 206 and `Vary: *` responses are rejected before retention; ordinary Vary and security headers remain. Cache reads retain their previous verification and matching behavior. [Cache.put algorithm](https://w3c.github.io/ServiceWorker/#cache-put), accessed 2026-09-12.
- Every new download passes size and hash verification before installation opens its build cache. Writes are serial, application byte references are cleared after successful writes, and the ready marker is written last. Write failure deletes the candidate cache only. The install/activate/message listeners, scope-derived names, waiting-worker policy and absence of `skipWaiting()` retain their ordinary behavior; neither diagnostic lifecycle bypass is present.

## Regression review and limits

The test harness now consumes the response passed to its cache-write adapter. New cases exercise chunked original-body consumption, preserved response metadata, overrun/truncation/rejection/null bodies, inventory bounds, non-cacheable statuses, empty status bodies, real Workshop bytes, independent repair response bodies, deferred installation and old-cache preservation, asset/marker failure cleanup, and repair failure without deleting unrelated entries.

The Workshop transport case pins the existing 11,127,024-byte JSON and SHA-256 `a015f79c47d8bac6cd09ba04e50c0c98d759e523eea7d225edbe62a8a5254054`; it does not regenerate artwork or routes. The local HTTP fixture actually serves gzip and Brotli bytes through Node's native fetch, while the manually constructed encoded-header response tests metadata policy only. Those are different scopes.

The VM cache remains a test adapter, not a browser Cache implementation. It does not establish Chromium's underlying NetworkError cause, browser activation state transitions, real HTTP-host compression behavior, quota behavior, or complete ordinary Vary matching across real request headers. In particular, no claim of cache-body spooling, quota exhaustion or artwork corruption follows from this review.

Owner-run checks and the new candidate's public Prepare/Verify, server-stopped navigation, image/gallery and save journeys are separate acceptance evidence. Diagnostic success and this source review do not substitute for normal-lifecycle browser preparation and frozen-release verification.

## Reviewed source identities

The final read review matched these SHA-256 values:

- Worker template: `9da62506e2b91905594e72195ee3028b514ce3f34ec1b7d56ab8d860ef54d3e3`.
- Worker tests: `cfed723dd92248ce0edf2d7c6109ca52cdb7193778658abd226baf39492a1589`.

The owner's [second focused run](../../../.cache/round-27-1/offline-focused/attempt-2.tap) reports 21/21 passing tests, including ten new cases. The [first attempt](../../../.cache/round-27-1/offline-focused/attempt-1.tap), with three test-harness expectation/digest failures, remains available; the owner corrected those test-only issues before the passing run. These are the owner's executions, inspected as evidence here, not additional runs or additions to the root suite total.
