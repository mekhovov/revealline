# v0.61.3 — Enemy Workshop Return and public verification

**Accepted on 18 September 2026 at 09:28 UTC for the scoped source-workspace Return improvement and public runtime delivery.** The complete public byte audit and actual keyboard play, picture reward and Collection return passed. **P03, P05, P08 and P18 remain incomplete.**

[Play v0.61.3](https://mekhovov.github.io/revealline/releases/v0.61.3/site/game/) · [Scoped acceptance](root-public-acceptance.json) · [Current plan and priorities](planning/progress-and-next.md) · [Source PR #112](https://github.com/mekhovov/revealline/pull/112)

## Delivered and verified

The Enemy Workshop has a working Return route in the source workspace. Its separate actual keyboard observation reached that action and returned to the game. Closing the automatically opened catalog still leaves a forward-focus gap in this edition; the later startup-close correction is tracked separately. **Enemy Workshop is excluded from the public runtime package.** Its source-only observation is not evidence of a public Workshop route. [Original source-workspace observation](source-workspace-return.json)

At 1280×720, actual keyboard play followed Title → Start → cut → Pause → Mission brief → Back → explicit Resume. A real First Signal win earned **52.2%, 8,160 points, three lives and three stars at 0:09**. View picture displayed the complete image without the results panel, and Results restored focus to View picture. This observation belongs to the first successful deployment of the same immutable game. It is a smoke test, not a difficulty or replay-value assessment. [Original play observation](native-solo-first-deployment.json)

After the final deployment, a native reload retained visible v0.61.3 and Start focus. Keyboard navigation opened Collection and the earned First Signal picture, which retained 8,160 points, GOLD and 9.19 seconds. Escape restored the exact picture-card focus, then Collection focus on the title. Screenshots were inspected inline only; no exported screenshot files are claimed. [Final-deployment observation](native-final-deployment.json)

Both source families passed **5,808 tests across 459 files**, all six gates and required build/production checks for source `58ff1b1da3c5487412e168ce34539866ac2f4970`, tree `8fad1311f1403e9134a3b60af029e238bd7cc98e`. Original qualification SHA-256: `08b34f039cf051fb5568cf30c3f52836da91720fa44cde853100d2d5596d4a44`. [Original source qualification](source-qualification.json)

[Publisher PR #128](https://github.com/mekhovov/revealline/pull/128) first deployed from controller `100702d50a2ed8165a4c92f18b06727ea9f12783`. A separately qualified source merge advanced main while that deployment ran. The unchanged observer correctly refused the mismatch before downloading a receipt. Root explicitly deployed the same frozen v0.61.3 assets from current main `68f9ebdfe13ef7ac76a75e59204c1b972c5c8606`, tree `0c5b462119df8b753bc80006764106595d03b8ab`. [Preserved guard refusal](main-advance-refusal.json)

The final [Pages run 35328869979](https://github.com/mekhovov/revealline/actions/runs/35328869979), deployment `6521346394` and success status `18516905896` passed. The full public audit verified **2,997 files / 641,315,704 bytes**, including exact hashes and required content types, with **zero failures, retries or skips**. An independent local review reconciled every result and attempt row. Fresh post-audit authorities confirmed current main, deployment, Latest v0.61.3, its annotated tag/source tree and nine unchanged original release assets. [HTTP report](http-report.json) · [Row review](public-row-review.json) · [Independent review](peer-independent-public-review.json) · [Fresh authorities](live-authorities.json)

The publisher preserves all 83 previous catalog records, for 84 versions and 23 admitted archives. Archive23 separately retains v0.61.1 and v0.61.2. A proposed Archive24 for v0.61.3 has its own future retention gate; this report does not claim that archive is deployed or accepted.

## Remaining limits

- The Enemy startup-close focus correction, remaining whole keyboard/controller/touch journeys and host Close local connections focus restoration remain P03 work.
- Shared reading preferences, Team canvas Large-text propagation, compact saving-warning placement and Motion Lab's right-edge limitation retain their separate gates.
- The Solo picture journey passed; Team results still need an unobscured View picture reward action. This is separate P07 work.
- No physical controller/touch, audible soundtrack, offline recovery, complete custom-media restore, full campaign difficulty, native-store or whole-phase acceptance is claimed.

Earlier pending statements and failed attempts remain byte-exact. The later root record accepts only the scope above. [Evidence curation](CURATION.md) · [Exact original members](originals-index.json) · [Compressed originals](originals.zip)
