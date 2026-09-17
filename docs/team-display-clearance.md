# Team display clearance and live shell

The v0.60.1 P05 correction is integrated on accepted main `587f4e75cc9dde7ae0db7ffac34320761b94588c`, preserving the exact reviewed runtime/CSS candidate originally based on `170508f11dd41204b7e24917a823f21701c15961`. It is separate from frozen v0.60.0 and preserves Team simulation, replay, checkpoint and input semantics. Scoped actual-browser F1–F4 checks pass; final composed-source qualification and public release remain outstanding. Full P05 is incomplete.

## Observed defects and verified correction

| Case | Before | Final candidate observation |
| --- | --- | --- |
| F1: focused Text size, 844×390 Plain/Large paused Options | Control bottom 383.9921875; overlay bottom 378; ring clipped | Keyboard Theme→Plain and Large→Standard→Large retained focus; control y250.4921875–295.9921875 inside overlay y12–378 with ring clearance; no automatic Resume |
| F2: 390×844 Plain/Large, both touch pads | Both pads ended 855.515625, below viewport 844 | Both pads ended 799.515625; complete 362×181 canvas; Pause bottom 536.484375; no arena/control overlap |
| F3: 844×390 Theme/Large, Touch Auto-hidden | Canvas 296×148 ended 365.890625; Pause ended 429.890625, below viewport 390 | Same-size canvas ended 309.890625; Pause ended 373.890625; live header hidden; Escape paused the clock |
| F4: 1280×720 Theme/Large, Touch Auto-hidden | Earlier breakpoint correction left 956×478 canvas ending 695.890625 and Pause ending 759.890625, below viewport 720 | Same-size canvas ended 639.890625; Pause ended 703.890625; Escape restored the header and Resume focus at 0:06 |

These final observations bind unchanged runtime SHA-256 `9792a0818a6fc2e171de196387f51678685cc9919afd3d1a036cf3988475ebc5` and final CSS `541f5998966bd783ec36187130fc7b3b7782399dadb010de642345619929b662`. Root entered through the unchanged Viewport lab and actual Couch→Team link, chose Relay Yard, then used Start→Escape→Options with native keyboard selection and separate Back/explicit Resume actions. At 844×390 Plain/Large with both pads and Reduced on/off, the complete 440×220 canvas and Pause (bottom 378) fit; all eight directional targets stayed 44×44 and Support/Boost stayed 68×62.03125. Portrait pads were 179×206.03125, and landscape pads were 140×206.03125.

## Implementation contracts

- Shared display changes preserve the currently focused action in open, paused Team Options. After applying shared state, intersect the actual scroller's inner viewport with the page viewport and allow 8 px for the 7 px focus ring.
- Reveal only a clipped current action with nearest, immediate scrolling. Do not refocus, replay input or Resume. Abandon the reveal if focus, attempt, menu, display revision or foreground ownership changes during layout/style reads.
- Keep initial display application early and disposal unchanged. Do not introduce a pending focus callback or observer.
- Hide the masthead only while `.playing` and `#coop-overlay[hidden]` match, independently of screen size and input device. Pause already exposes the Solo/Versus exits and original tools. Paused and result overlays restore the header; the lobby leaves `.playing`.
- Keep responsive touch gutters and arena sizing. Do not add separate breakpoint fixes for the same redundant live header, shrink text or targets, crop the canvas, or change DOM/menu ownership.
- Preserve the keyboard Escape pause path, either player's mapped controller Pause, visible Pause action and canvas focus after explicit Resume. A header's decorative or duplicate navigation cannot become the only route to an essential action.

The static action review traced original Team mode exits and tools through the Pause overlay, keyboard/gamepad pause handlers, visible Pause button and canvas focus. It found no new action-reachability blocker in the shared Team host. That review does not replace physical-controller or complete input-journey acceptance.

## Evidence and boundaries

The [retained qualification evidence](verification/cross-mode/p05-team-clearance/README.md) includes the final native originals under `native-final/`: `binding.json`, `root-observations.md` and `request-byte-review.json`. The byte review records **702 requests, 251 distinct exact bodies**, with the two pinned overrides and exact source. Earlier F1/F2 and F3/F4 originals remain separately retained; the earlier desktop failure and intermediate breakpoint approach are not rewritten as successful results.

Root sent no movement commands in this final layout session and paused at 0:33. The first batched keyboard cleanup failed readback (preferences remained Plain/Large/Show both); that attempt remains recorded as failed. A separate real Team lobby then restored Theme/Standard, Reduced=false and per-visit Touch Auto through displayed native controls. Both tabs and the local server were closed. The portrait screenshot was inspected inline but clipped by the parent lab's scroll stage; measured child geometry established the stated layout. No exported screenshot artifact is claimed.

The runtime module and 17-case regression file remain byte-identical to the earlier complete **164-test passes on Node 20.19.5 and 22.22.2**, with 161 unchanged inputs per run at 1024 MiB V8 old-space. Both pre-fix selector/ring discriminators failed on the original source. Earlier setup/input and artificial heap-cap failures remain retained. Those runtime cohorts bind the earlier CSS; they are not relabeled as final CSS layout tests. Final CSS received formatting/static scope review followed by the actual browser observations above. No runtime suite was rerun merely for this CSS/documentation successor.

Fresh v0.60.1 composition verification passed the five complete affected files on Node 20.19.5 and 22.22.2: **164/164 checks each**, zero failures or skips, all 161 runtime inputs unchanged. JavaScript syntax and explicit formatting passed. [Original logs and source bindings](verification/cross-mode/p05-team-clearance/composed-local/README.md) retain two pre-runtime fixture setup failures and the separate guide/evidence update made while these tests ran. Runtime, CSS, tests and synchronized version fields were unchanged. These local results do not replace final committed-source qualification.

Outstanding acceptance:

1. Review and integrate the exact combined source; run the required final source/release qualification and verify the public deployment.
2. Recheck full input journeys, terminal results, win/rescue and all advertised Team modes in the qualification matrix. The final layout session did not exercise those outcomes.
3. Test 200% zoom, safe areas and physical phone/finger/controllers separately. Responsive desktop iframe observations do not certify these devices or interactions.
4. Preserve a usable scroll route on smaller or magnified layouts without shrinking readable text or hit targets. Keep Theme/Plain, Standard/Large and Reduced preferences independent of gameplay authority.

The scoped F1–F4 browser pass does **not** close P05, certify accessibility or approve a public release.

## Supporting guidance

[W3C Focus Not Obscured guidance](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) distinguishes minimum partial visibility from stronger goals and discusses scroll padding. RevealLine requires the entire current action and its ring to remain visible; the original partial clip alone does not establish an AA violation. [Xbox navigation guidance](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/112) supports predictable focus and logical navigation. These sources inform the correction; they do not establish certification.
