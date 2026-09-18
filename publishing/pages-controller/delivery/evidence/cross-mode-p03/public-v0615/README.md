# v0.61.5 — accepted public Studio guide continuity

**v0.61.5 is accepted for its scoped correction and verified public journeys.** [Play v0.61.5](https://mekhovov.github.io/revealline/releases/v0.61.5/site/game/) · [Immutable release](https://github.com/mekhovov/revealline/releases/tag/v0.61.5) · [Current plan and next phases](planning/progress-and-next.md)

The Studio guide remains keyboard reachable during collection loading. Closing it returns visible focus to its opener and preserves temporary description edits and preview state. Actual public keyboard checks also passed Solo Pause/explicit Resume, a completed mission, full-picture viewing, Next, Collection picture replay and the preserved release route. These results do not complete P03, P05, P07, P08 or P18.

| Authority | Accepted identity |
| --- | --- |
| Game source | `d34e283819376eb43e4942287d9767b22a4f6487`, tree `3af511259e14ed2af11a2e2498535744450a378f`; [source PR116](https://github.com/mekhovov/revealline/pull/116) |
| Published release | `391391690`; nine immutable release assets and annotated tag preserved |
| Pages controller | `8f4f395272f78a74b6b5ae40f0126b811491e05e`, tree `bae67e16d5510ba5fbc8b807c2470fd7a99c71d4`; [publisher PR133](https://github.com/mekhovov/revealline/pull/133) |
| Deployment | Run `35340056708`, deployment `6523401020`, successful status `18521652587` |
| Complete public byte audit | **3,051 files / 641,652,183 bytes**; 3,052 attempts, one recovered HTTP 503, zero final failures |
| Existing exact-source qualification | 5,853 passing tests in 462 files in each hosted family; source gates, ordinary build and frozen inspection retained; no repeated full suite in this documentation task |

The [root acceptance](root-public-acceptance.original.json), [row reconciliation](public-row-review.original.json), [HTTP report](http-report.original.json) and [independent peer review](peer-public-review.original.json) are original records. Fresh before/after authorities agree with the exact deployment, release and tag. The recovered 503 affected historical `releases/v0.27.0/site/distribution.zip.sha256`; both the failed attempt and successful retry remain in the original attempt rows.

The [Studio journey](native/studio-guide.original.json) exercised Guide during visible loading, Escape and explicit Close, retained temporary edits and cosmetic preview state, and restored visible opener focus. Loading completed before the Escape observation, so this is not a long-running cancellation test. An accessibility/DOM-role lookup disagreement on the actual SUMMARY caused an automation lookup failure, not a demonstrated product defect. No upload, crop, pixel editing, Save, export/import or exact backup was accepted here.

The [Solo and Collection journey](native/solo-collection.original.json) won First Signal at **52.2%, 8,160 points, 0:07, three lives and three stars**. Full picture → Results restored View picture focus without changing the result; Next opened Relay Orchard at 0%, and Collection replay returned to the exact earned card. This introductory win is a navigation check, not difficulty or replay-value acceptance. The [history journey](native/history.original.json) opened preserved v0.61.4 on Archive24 and returned to current v0.61.5. Archive24's broader byte/play retention is recorded separately in its existing admission.

**Enemy Workshop is shipped.** Earlier source-only descriptions were incorrect; the [dated correction](../public-v0614/packaging-scope-correction.md) remains authoritative. Its startup-close focus fix is a separately qualified v0.61.20 source, awaiting publication/public verification. Team's unobscured earned-picture fix is separately qualified v0.61.21. Neither is part of v0.61.5.

All native observations here used actual browser keyboard input at desktop size. Physical controllers/touch, audible listening, offline/media recovery and complete cross-mode journeys remain separate gates. Held-Escape protection has source-test evidence; this public check did not establish native key-repeat behavior. Inline screenshots were observed but no exported screenshot artifact is claimed.

The [originals index](originals-index.json) pins **227 unique originals / 8,159,851 bytes** inside [the evidence bundle](public-originals.zip), with unique safe member names, CRC checks and exact SHA-256/body comparisons. The bundle contains receipts, logs, JSON rows, helpers and dated source/native queue records; public game payloads, browser storage and giant release carriers are excluded. Historical failed attempts and pending statements remain unchanged. New queue interpretation uses [the explicit six-version clarification](queue-clarification.original.json).

Snapshot: 18 September 2026, 11:59 UTC. This report updates delivery documentation only; it changes no game bytes, version, release selector or publication workflow.
