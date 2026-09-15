# P01 — loading feedback

**v0.57.0 is published; P01 remains unaccepted pending a visibility correction in v0.57.1.** Its public file audit passed. The portrait browser check found that the complete optional-pack list expands active offline status and displaces the count/Stop action. The existing release remains immutable; the patch needs its own source and public verification. P02 remains queued. This report is publishing evidence outside the immutable v0.57.0 game source.

[Play v0.57.0](https://mekhovov.github.io/revealline/releases/v0.57.0/site/game/) · [Frozen release and original evidence](https://github.com/mekhovov/revealline/releases/tag/v0.57.0)

## Delivered behavior

Boot, Deploy, saved-flight restoration, content installation, offline preparation, recovery, media and authoring operations now acknowledge work immediately. A shared pixel activity signal accompanies readable status text; progress counts appear only when the operation supplies real measurements. Reduced effects retain the text without animation.

Cancellation follows the operation's actual ownership. Cancelling an uncommitted picture or import preserves the prior flight or draft. Stop waiting detaches from a shared offline installation; Check progress rejoins it. A durable save remains locked until its result is known. Older promises cannot overwrite a newer operation, unlock its controls or steal focus. Required picture errors retain recovery actions and the original saved presentation pins.

The [56-entry loading inventory](../../../../../docs/verification/cross-mode/p01/inventory.json), [implementation report](../../../../../docs/verification/cross-mode/p01/implementation.md) and [loading contract](../../../../../docs/presentation-loading.md) define the owners and regression requirements. Runtime-maintainer and release skills, production recipe evidence and copyable prompts were updated with this contract. Team map artwork and layout parity remain P03/P08-A work.

## Source and publication

| Identity | Value |
| --- | --- |
| Game source | `b7db0134d4ede3452dc90b5d3f7ffb1491a0579b` |
| Game tree | `7cd40e4ef8bf975e7eb2795cdd2669aa18811a57` |
| Source PR | [#55](https://github.com/mekhovov/revealline/pull/55) |
| Source qualification and freeze | [34960629043](https://github.com/mekhovov/revealline/actions/runs/34960629043) |
| Independent PR source gates | [34960633645](https://github.com/mekhovov/revealline/actions/runs/34960633645) |
| Publishing PR | [#58](https://github.com/mekhovov/revealline/pull/58) |
| Publishing revision | `74f289510617603c28768bb3f6bfd8e9f7a72cdd` |
| Publishing tree | `8d8173c2f14effcac2e63b8cec22848943d88110` |
| Publishing run / deployment | [34965929587](https://github.com/mekhovov/revealline/actions/runs/34965929587) / `6458234240` |

All six exact-source gates passed. Both hosted suites and the complete local suite passed **4,185 tests across 375 files**, without failures, cancellations, skips or TODOs. Production reproduction, committed readiness and the ordinary build passed. The publishing controller separately passed 36 Node and four Python checks, a clean-checkout verification, hosted preview, assembly and independent artifact reread.

The frozen source TAR matches all 4,382 Git files and their modes. Every one of the distribution's 654 manifest files was independently read and hashed. The original distribution contains 312,379,448 manifest bytes; its ZIP is 312,615,996 bytes, SHA-256 `1727711a87b914d88ea5769915b17907ac001965c23dc036a8865bfd5ac1c31d`. All ten release attachments match their verified original sizes and GitHub digests. Existing tags, released bytes, 61 historical catalogue entries and 13 archive admissions were preserved.

The released offline inventory is **608 files / 55,383,385 bytes**, build `8b7ab11efc3be749f519b50f4d4299dc2a203a61d4fd970bd3a62278bda7402b`. Its frozen version is `v0.57.0`, so the runtime save channel is `release-v0.57.0`. These differ from the ordinary local build's version spelling and generated offline identity; the checks use the actual released values.

## Evidence boundaries and retained corrections

The release attachments preserve original source logs, before/after identities, artifact inspection, browser observations and failed attempts. Earlier hosted candidates exposed test-fixture waits that counted callbacks or used inconsistent initial readiness allowances. Corrections use bounded elapsed waits around the same real work; runtime deadlines, original bytes and gameplay assertions remain intact. Each candidate's results remain separate; only the final source receives the successful qualification.

Local browser checks cover real delayed resources, cancellation and retry, installed originals, Studio uploads and bundle round trips, media operations, loading visibility, focus and responsive layouts. The initial failed interactions and corrected retests remain recorded. Source fixtures cover difficult stale, capacity, atomicity and error branches; these are not presented as physical-device observations.

The v0.57.0 full public audit verified all **2,373 files / 636,426,379 bytes**, including the complete current site and historical bridges, with no failures, retries or skipped files. A separate live API check confirmed the same main revision and successful deployment afterward. These results do not accept the displaced portrait controls; the corrected patch must pass its own browser checks.

The [complete HTTP audit](public-v057/public-audit-r4/completion.json) and [independent byte review](public-v057/public-audit-r4/parent-result-review.json) retain the actual publishing authorities and every streamed result. The [public browser report](public-v057/browser/public-offline-run/qualification.md) records boot feedback, real offline preparation, Stop/rejoin, all 608 verified files, resumed Solo capture, and both Team arenas. A fresh browser process using the retained profile opened through the installed service worker while a refusing proxy rejected new HTTP traffic. The Solo artwork pin survived resumed play. The three sampled localStorage values were identical before and after Team play; this is endpoint equality, not proof that no write-and-revert occurred. The read-only CDP observer disconnected before continued play, so the report retracts its earlier zero-storage-events claim and does not attribute later Team requests to that observer.

The original failed portrait screenshot is retained with the successful ordinary-build correction in the [visibility report](../../../../../docs/verification/cross-mode/p01/offline-progress-visibility.md). Corrected local checks cover Standard and Large/Plain/Reduced text at 390×844 and 844×390, with count and Stop visible together, real preparation, Stop/rejoin and cached verification. This evidence does not substitute for v0.57.1 exact-source and public qualification.

Public Team selection also exposed an interaction worth checking in P03: Enter on the arena select could start the previously selected run, and changing a hidden selection did not rebuild that run. Only the later explicit First Connection start counts as evidence for that arena. P01 does not claim this navigation issue resolved.

Inventory, source fixtures, actual browser interaction, modeled touch/controller input and physical hardware remain distinct evidence categories. No physical phone, real controller, Safari, OS installation, IndexedDB write audit or long-term retention qualification is claimed by this phase. Final corrective-release acceptance remains pending.
