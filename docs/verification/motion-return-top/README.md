# Motion Lab top return — native correction check

Problem: Return to Workshop existed only after the long Motion Lab controls;
the native baseline needed 47 Tab presses from body.

Change: add one navigation link before the study header. Reuse the existing
`data-workshop-return` initializer and return-target stylesheet. Keep the footer
links. No new input handling, state writes, navigation authority or gameplay code.

Preview source: `508a638f556b80817f4c872b9950d7de7b207b17` plus exactly the
insertion in `change.json`. The follow-up branch predates an unrelated footer
fallback fix; the preview deliberately preserves every frozen-source byte outside
this insertion. All 674 responses / 377 distinct paths were byte/hash verified;
only `authoring/motion-lab/index.html` was overridden. This evidence qualifies
this composed local preview, not a later integrated or public release.

Native check, 2026-09-20, localhost:18804:

1. Top return was present in the initial loading screen, before the disabled study.
2. One native Tab focused `motion-workshop-return`. Ready state was observed at
   this point; no artificially slow request or failed-module condition was tested.
3. Target was exactly `game/?journey=authored&workshop=motion-lab`.
4. Enter returned to Workshop with `shell-motion-lab` focused. Escape left Home
   open and focused `shell-workshop`; no flight started.
5. Re-entered through that card and checked the same first-Tab target on a phone
   portrait viewport. Temporary viewport override was reset after checks.

| Observed CSS viewport | Return rectangle (x, y, width, height) |
| --- | --- |
| 1280 × 720 | 177, 35, 163.66, 44 |
| 390 × 844 | 14, 20, 163.66, 44 |
| 938 × 433 | 170, 10, 163.61, 43.99 |

The short-landscape override requested 844 × 390 but the browser reported the
938 × 433 CSS viewport above. Do not label it as an exact 844 × 390 certification.
The focused link remained visible. No physical phone, touch or controller was used.

This follows [Xbox XAG 112](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/112),
reviewed 2026-09-20: predictable focus, consistent navigation and an easy return
to a previous/main screen. The one-Tab design is this project’s implementation
choice, not a quoted numeric requirement from that guidance.
