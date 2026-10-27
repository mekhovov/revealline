# Native touch export readback after the retained WebKit failure

The exact `a6eacee2f` game observations remain failed or inconclusive. This prospective observer correction does not reclassify them or change their source, recipes, input gates, native input, replay checks or deadlines.

Run `39017369097`, tooling `69639b30d`, completed all twelve observations. Chromium dpad, stick and swipe each retained all 24 meaningful trusted direction changes and passing strict native replay, with no interruption and clean owner closure. Their input latency gates were respectively fail/fail/inconclusive, inconclusive/fail/inconclusive, and fail/fail/fail. Swipe p95 bounds were `(50,57]`, `(50,53.6]` and `(50,54.7]` ms against `B=16.7` ms and the unchanged `2B` gate. These measurements precede the later touch-layout runtime change.

All three WebKit dpad observations retained 24 meaningful trusted directions but failed public replay export. Their independent foreground cadence was unstable, so application input-latency qualification is unobserved. The first click log reached `performing click action`; the later partial-export attempt shows the already-open replay modal intercepting a second menu click. The exact game handler populates the public textarea and opens that modal before requesting the ordinary Blob download.

[Playwright 1.62.1's pointer action](https://github.com/microsoft/playwright/blob/v1.62.1/packages/playwright-core/src/server/dom.ts) awaits native dispatch and hit-target cleanup before logging action completion; scheduled-navigation waiting follows that log. Therefore the retained log does not distinguish a native mouse acknowledgement stall from hit-target cleanup. A blanket `noWaitAfter` change is not supported. The observer's second menu click through the open modal is a separate demonstrated readback defect. No game export defect or physical-device cause has been established.

The failure cleanup now reads an already-open public replay dialog directly, only while the attempt remains paused. Text must be nonempty JSON with an object root and stay within the existing 32 MiB replay bound. If the dialog is absent, the existing public export-control path is used. Readback records its source and remains partial evidence; the original error and failed status survive even if the separately closed native replay verifier accepts the bytes. The verifier checks the recording’s embedded checkpoint and definition; partial public text alone does not establish equality to an independently observed live checkpoint. The primary export path and native replay authority are unchanged.

The optional five-second internal cadence observation now follows accepted public Start and the first retained active paint, before touch input. This accommodates owned preparation that obtains its quiet callbacks after hiding the animated title. The unchanged external foreground `settled120` observation remains the input gate's cadence authority. The optional internal wait cannot replace it or create a latency pass. This prospective change has no native observation yet.

The two historical release contracts use one independently verified Git witness for the changed observer reference at actual dispatch `69639b30d985ffa723a4d0c11756b632fc2da5c1`, tree `d022c57efa75dbe7b7aeeca00a1950f61426595b`. The observer was 22,315 bytes, SHA-256 `de83cce174f1491acb2619746fe0161f197068a69dc736e522dca069874f0e9d`, blob `ac6c2187d0248a327ce915b36f2f5e32c9aab33a`. Both retained declarations/workflows are unchanged. Their presence in this later source is not a claim that the earlier cancelled setup run executed at `69639b30d`. New releases must freeze the current tools independently.

Verification: the complete three-file group passed 16/16 before the change; the first changed run passed 18/20 with only the two historical observer-byte comparisons failing. That red result is retained. After the immutable witness adaptation, all 22 controls pass, including invalid/changed phase, empty/malformed/oversized text, absent-dialog fallback, no modal click-through, preserved failure, post-Start ordering and altered witness/reference rejection. No local browser ran.

Compact retained receipts:

- `.cache/solo-followup/c41-successors/touch-before-observer-change.tap`
- `.cache/solo-followup/c41-successors/touch-after-observer-change-v1.tap`
- `.cache/solo-followup/c41-successors/touch-after-observer-change-v2.tap`
- `.cache/solo-followup/c41-successors/webkit-export-source-binding.json`
- `.cache/solo-followup/c41-successors/touch-chromium-swipe-retained/receipt.json`: artifact `12095928938`, 372,420 bytes, SHA-256 `22172486085d7fedea57ba7f0c700c81d8ac2e15526f75d96ce4547d10a614af`; all 45 members passed CRC/hash/readback.
- `.cache/solo-followup/c41-successors/touch-webkit-dpad-retained/receipt.json`: artifact `12096030962`, 334,890 bytes, SHA-256 `8c5cb72141ba6d595531c79e446bafb8e8f5c49787c453dbc92642b3fc183114`; all 42 members passed CRC/hash/readback.
