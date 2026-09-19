# v0.61.0 — Solo result continuation

**Accepted on 18 September 2026 at 04:07 UTC for the scoped ordinary-Solo result, Retry, Next and cancellation correction.** Retry preserves the accepted picture and starts a fresh attempt directly. Next keeps the previous picture and result usable while preparing the destination, then starts that mission directly. **Full P03, P05, P07, P08 and P18 acceptance remains open.**

[Play v0.61.0](https://mekhovov.github.io/revealline/releases/v0.61.0/site/game/) · [Scoped acceptance](root-acceptance.json) · [Current plan and priorities](planning/progress-and-next.md) · [Source contract](https://github.com/mekhovov/revealline/blob/fc2c7af6b22c703cc3bb2c081579878b7510f667/docs/solo-result-continuation.md)

## Delivered and verified

The actual public keyboard journey was Home → Missions → Base game → First Signal → Deploy. The opaque field had a 45% target and three lives. A legitimate failed cut reduced lives to two and showed recovery; the next cut earned a 50.0% win, 7,820 points and two stars at 0:34. View picture → Results retained that result. Try again started a fresh attempt at 0:00, 0% and three lives without an intermediate briefing. The next legitimate win earned 52.2%, 8,160 points and three stars at 0:09, with the same picture visibly shown.

Next then started Relay Orchard directly, with its 58% target and one required relay. Pause → Mission brief → Escape returned to the same paused clock and restored the Mission brief opener. These observations qualify the ordinary Solo route; saved Continue retains its separate exact saved-edition contract. [Original browser observations](browser-observations.json)

The 390×844 portrait check showed the complete arena and an earned 52.2% win, 8,160 points and three stars at 0:07. Another tab owned saving, so the result correctly reported a session-only picture; durable progression is not claimed for that journey. Next, View picture, Try again and Main menu remained visible. At 844×390, View picture → Results preserved the result and restored focus. Activating Next and then Escape cancelled real pending preparation: the original picture, result and focused Next action remained. A later fresh Next visibly showed preparation status and Cancel beside the previous picture, then started Relay Orchard directly. Both measured viewport widths had no horizontal document overflow. Screenshots were inspected inline only; no exported screenshot files or hashes are claimed.

The public `/game/` route opened v0.61.0. The Release explorer showed current v0.61.0 and the retained v0.60.9 route in Archive22; Browser Back returned to the v0.61.0 Home screen. The 81-version count comes from the independently verified catalog, not a browser heading count.

Both recorded source families passed **5,707 tests across 454 files**, all six source gates, production and build checks for frozen source `fc2c7af6b22c703cc3bb2c081579878b7510f667`, tree `bf11a670ac53a31d58b79540650229160bacd486`. Its qualification SHA-256 is `c8f3f40e34ed7e26bcfda123423ddc59e2bf01044d0ade69f9da04b6b895e191`. [Source PR #102](https://github.com/mekhovov/revealline/pull/102) · [Retained source qualification](source-originals/source-qualification.json)

GitHub release `391186371` was published at 03:38:14 UTC with all nine original assets. [Publisher PR #117](https://github.com/mekhovov/revealline/pull/117) merged controller `b2295577461a5792baa37a1ef4c2f9dbdbc75ae9`, tree `a899feeed8812f33ea422893fa1008aef09cf48f`. [Pages run 35304941339](https://github.com/mekhovov/revealline/actions/runs/35304941339) succeeded, creating deployment `6517187019` and successful status `18507272724`.

The full public audit verified **2,922 files / 640,615,971 bytes**, including hashes and required content types, with **zero failures, retries or skips**. Every result and request row was reconciled. Fresh post-audit API originals confirmed the deployment, Latest v0.61.0, annotated tag, source tree and original release assets. All 80 prior catalog entries remain preserved, for 81 public versions and 22 admitted archives. [HTTP report](tools/runs/complete-1/report.json) · [Row reconciliation](public-row-review-complete-1.json) · [Fresh authorities](after-http-authorities-main-1/result.json)

## Remaining limits

- The session-only saving warning overlaps the compact short-landscape HUD/menu. Its full text is readable in Pause, but its placement needs a P05 correction.
- These are ordinary browser keyboard and viewport observations, not physical touch, controller, assistive-technology or complete cross-mode acceptance.
- No new audible listening, offline, network-failure, slow-decoder fault injection or story-playback acceptance is claimed. The tested base-picture assignments offered no story action.
- First Signal is introductory content. The recorded wins and loss do not establish fair campaign difficulty or subjective replay value.
- The failed cut, null image-source lookup, initial wrong-tab viewport attempt and successful pending-Next cancellation remain in the original observations. The image-source lookup does not establish a DOM media-pin assertion; visible same-picture continuity and exact-source safeguards are separate evidence.

The earlier HTTP report correctly says browser acceptance was not yet complete when it ran. The later root acceptance and native observations close this scoped public gate without rewriting that original. Pre-deployment states, helper histories, logs, diffs and original receipts remain preserved. [Evidence curation](CURATION.md)
