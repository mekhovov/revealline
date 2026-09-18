# v0.61.1 — Media controls and Preview focus

**Accepted on 18 September 2026 at 05:33 UTC for the scoped media-control correction and public delivery, with two UI findings still open.** Saved, authored and chosen-file previews restore their invoking control. Actual public keyboard play and every deployed byte passed. **P03, P05 and P18 remain incomplete.**

[Play v0.61.1](https://mekhovov.github.io/revealline/releases/v0.61.1/site/game/) · [Scoped acceptance](root-acceptance.json) · [Current plan and priorities](planning/progress-and-next.md) · [Frozen source verification](https://github.com/mekhovov/revealline/blob/a7a4e2d7090e2fe9d1843d88b63bc334b95bf61e/docs/verification/cross-mode/media-controls-v0611/README.md)

## Delivered and verified

The actual public keyboard journey reached Workshop → Pictures & stories → Open local media. At 390×844, saved Preview and authored Preview returned focus to their respective buttons. Enter opened the real file chooser; an owned 768×576 PNG, 46,655 bytes, was selected. The missing-description error returned focus to the chosen-file Preview action. After entering the description, Preview decoded the original file and again restored its opener. No image assignment, restore, deletion or music operation was performed; the existing two images and two revisions remained unchanged. [Original media observations](native-media-observation.json)

The measured document/dialog widths were 390/342 pixels in portrait and 844/796 pixels in short landscape, with no horizontal overflow. Closing the workshop restored Open local media focus. These width and return-focus passes do not establish that every focused field stayed visible: the picker and host-close findings below remain open. Screenshots were inspected inline only; no exported screenshot files or hashes are claimed.

At 1280×720, Start launched a fresh First Signal attempt. A genuine Down press/release completed a cut and earned **52.2%, 8,160 points, three lives and three stars at 0:09**. View picture → Results restored View picture focus; Try again directly started a fresh attempt without another launch prompt. Escape paused explicitly, with Resume focused. The ordinary `/game/` route resolved to the current v0.61.1 game. This is an introductory smoke test, not campaign-difficulty or replay-value qualification. [Original play observations](native-play-observation.json)

Both recorded source families passed **5,730 tests across 454 files**, all six gates and their production/build checks for source `a7a4e2d7090e2fe9d1843d88b63bc334b95bf61e`, tree `8f81812d56299c2819ec083d919d9085a36d223c`. The original qualification SHA-256 is `ce94e595f0aa579fa5f64df57795cf49a8bc1404e71c2e861d4900ccc3347fb1`. [Source PR #107](https://github.com/mekhovov/revealline/pull/107) · [Original qualification](source-qualification.json)

GitHub release `391216363` was published at 04:57:53 UTC with its nine original assets. [Publisher PR #120](https://github.com/mekhovov/revealline/pull/120) merged controller `c7770eda1dbdf6d241c11496d80faa28dbcb9b2b`, tree `eadfba82450df0eee820f265c405193bac5f4072`. [Pages run 35310328369](https://github.com/mekhovov/revealline/actions/runs/35310328369) succeeded with deployment `6518109203` and success status `18509395004`.

The complete public audit verified **2,947 files / 640,997,923 bytes**, including hashes and required content types, with **zero failures, retries or skips**. Every request/result row was reconciled. Fresh post-audit API originals confirmed Latest v0.61.1, the annotated tag, frozen source tree, nine original release assets and current deployment. All 81 previous catalog records remain exact, for 82 versions and 22 admitted archives. Archive22 retains v0.60.9 and v0.61.0. [HTTP report](http-report.json) · [Row reconciliation](public-row-review-main-r1.json) · [Fresh authorities](live-authorities.json)

## Open findings and limits

- **Focused picker visibility — P03/P05:** in portrait, the pinned status/Cancel/Close panel covers the keyboard-focused file picker. Rotation also leaves that field offscreen. Keep pending-operation controls available while making the active field and its label visible. [Original finding](native-picker-occlusion-finding.json)
- **Closing local connections — P03:** focus falls to the document. The explicit Back link remains keyboard-reachable, but the host must restore a useful focus target when it closes the connection. [Original observation](native-media-observation.json)
- The earlier Motion Lab rotation-focus issue, compact saving-warning overlap, Team Large-text propagation and actor-scale qualification remain tracked in the plan; this correction does not close them.
- No physical controller/touch, audible playlist, video/story, offline recovery, save isolation/migration or native-store acceptance is claimed. Preview success does not establish saving or restoring a custom assignment.

The HTTP report retains its earlier “browser acceptance pending” state. The later root acceptance closes only the stated public scope and retains the two UI findings. The original failed or pending observations, API bodies, helper histories, requests and logs have not been rewritten. [Evidence curation](CURATION.md) · [Exact original members](originals-index.json) · [Compressed originals](originals.zip)
