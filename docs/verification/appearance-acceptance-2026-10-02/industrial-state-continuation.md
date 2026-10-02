# Industrial dialog and state continuation

This is a focused source/handler review begun at appearance HEAD `de86931e3`,
continued alongside the next main integration. It is not an all-screen browser
pass. The publication receipt must pin the final integrated source; earlier
screenshots retain their own source identity.

## Corrected in this continuation

- The in-game Reduced effects preference previously set `transition: none` before
  the equally specific common action transition rule. The later rule restored
  100 ms transitions when the operating system still allowed motion. The shared
  preference override now follows that recipe and covers the same buttons and
  menu links. The operating-system override covers those links too. Focus and
  selected/error/disabled state styling remain intact.
- Story loading, verification and unavailable-original messages now use the
  existing live localization adapter. The Close accessible name updates in place.
  Changing English/Ukrainian does not replace its focused node or the exact
  already-rendered reward picture.
- A story volume-preference save failure now uses the existing translated
  `gameplay:cinematicPreferenceCouldNotBeSaved` message instead of a hardcoded
  English prefix. Raw diagnostic detail remains attached to that translated
  message. This presentation change does not pause or dispose playback.
- The actual Creator earned-story journey exposed a navy backing on the image
  element itself after the surrounding frame had adopted the theme. A scoped
  themed `#earned-picture` background-color now uses `--iw-ink`; image pixels,
  source identity, sizing and contain-fit behavior remain unchanged.

## Named inventory and evidence boundary

| Surface/state | Checked here | Still open for this source |
| --- | --- | --- |
| Shared primary/secondary/selected controls with Reduced effects | CSS cascade defect corrected; the theme preference and OS preference cover the common transition recipe. Actual browser toggle changed all 28 inspected visible button/link controls from the normal recipe to transition `none` / `0s`; focus stayed on the preference checkbox. | Other runtime/creator surfaces, selected/error combinations and physical input remain sampled rather than exhaustive. |
| Story dialog: reading metadata → verifying original → unavailable original | Actual handler tests exercise delayed stages, language switches, live error state, focused Close and the same exact poster. | Rendered narrow/landscape text wrapping, error notice versus Close, contrast over earned media, physical input/screen reader. |
| Story dialog: preference storage failure while playing | Actual handler test covers the translated live error, retained focus and unchanged playback ownership. | Real browser denied-storage presentation and its readable error/controls combination. |
| Standard operation progress, error, detached, cancelled and ready | Existing operation handler suite passes with the story checks; obsolete leases stay fenced and numeric progress does not repeat phase announcements. Shared semantic paint inspected in source. | Rendered long EN/UK messages in Music Library, downloads and creator dialogs; keyboard recovery/cancellation journeys. |
| Earned picture/cinematic chrome | Actual Creator Start + Down completion played the earned video to its end; the retained desktop screenshot exposed the image-element letterbox mismatch, now corrected. Follow-up at 390×844 with Ukrainian, Large text and Reduced effects found body/image backing both `rgb(23,25,27)`, no overflow, video paused at time 0 without autoplay, and focus on Continue. Existing handlers retain the exact poster, retry and Next ownership. | Landscape, unavailable-media and remaining reward journeys. This is one Creator sample, not every reward journey. |
| Reward media, audio groups and cosmetic previews | Source inspection confirms shared native actions/status nodes and explicit Play ownership. No new visual result is claimed. | Loading, decoder/poster failure, unavailable asset, retry, selected track plus focus, disabled previous/next and narrow long-label layout. |
| Replay Theater invalid/missing media | Shared panel/action/status recipes inspected; no new replay behavior changed. | Actual invalid import/load/retry, unavailable appearance diagnostics, keyboard focus and empty-result screens. |
| Destructive confirmation dialogs | Shared danger, disabled and focus recipes inspected; existing semantic markup retained. | Actual restart/replace/leave decisions with selected/hover/focus combinations in EN/UK and supported input modes. |

The prior Demo screenshot's tight right edge was separately checked in the actual
browser: caption and parent content widths equaled their scroll widths, and normal
wrapping retained the full sentence. No clipping defect was reproduced and no
layout change was made for it.

The new reduced-effects browser receipt and its screenshot are
`../appearance-continuation-2026-10-02/reduced-effects-browser.json` and
`../appearance-continuation-2026-10-02/industrial-reduced-effects-desktop.png`.
The pre-correction earned-story capture is
`../appearance-continuation-2026-10-02/industrial-earned-story-desktop.png`.
The corrected narrow capture is
`../appearance-continuation-2026-10-02/industrial-earned-story-uk-large-mobile.png`.
These are desktop browser samples, not physical controller/touch evidence.

## Newly integrated authoring-library coverage

The main integration adds 18 `authoring/library/neon*/index.html` entrypoints.
The initial source audit found that all 18 lacked the shared synchronous theme
bootstrap, shared presentation stylesheet and auxiliary theme host. Their
inline page chrome retained navy/cyan styling independently of the selected
appearance. The first-paint inventory skipped the `library` directory, so its
earlier passing result did not cover these pages.

This continuation closes that integration gap for the 16 maintained playable
launchers and two generated galleries. Existing inline chrome lives in the
legacy CSS layer, shared first-paint resources precede it, and gallery cards use
the existing panel surface role. The Mosaic gallery's minimum card width is
bounded by available space. Original preview images, level colors, artwork and
launch handlers remain authored and unchanged.
`scripts/build-neon-artwork-gallery.mjs` and `scripts/build-neon-mosaic.mjs`
generate two of these pages. Both now expose deterministic HTML renderers used
by their CLI output. The focused test validates regenerated HTML against emitted
files, preserves the exact authored image references and includes all 18 pages
in first-paint order/local-dependency checks. Actual Neon Mosaic browser samples
confirmed the Industrial family, all 38 SVG previews loaded at natural width 720,
and scroll width equal to viewport width at 1280 and 390 pixels. At 390 pixels,
the first card spanned x=24..366 with width 342. Captures are
`../appearance-continuation-2026-10-02/industrial-neon-gallery-desktop.png` and
`../appearance-continuation-2026-10-02/industrial-neon-gallery-mobile.png`.
Other launcher/gallery variants, keyboard journeys and long localized copy
remain separate acceptance work; these samples do not qualify every library page.

## Focused verification

Node 20.19.5:

```sh
node --test game/test/story-dialog.test.mjs game/test/operation-status.test.mjs
node --test game/test/creator-player-menu.test.mjs game/test/creator-player-victory-story.test.mjs
node --test game/test/theme-bootstrap.test.mjs
```

**44 passed** across the three focused commands, including the two new
actual-handler regressions, 18 existing Creator menu/media ownership checks and
the eight first-paint/generator tests. DOM/media
boundaries are modeled by the existing fixtures; these are not browser screenshots
or physical accessibility evidence. Targeted ESLint and Prettier checks passed for
the edited CSS, runtime module and test. No new catalog message, schema, runtime
module, model, artwork or simulation behavior was introduced.

The shared SIM CSS projection must be regenerated by its owner after shared CSS
is frozen. No SIM source file was edited by this focused review.

The highest-value next browser checks are the immersive story loading/error
notice, reward-media pending/failure/retry controls, Replay Theater invalid-file
recovery and long Music Library/download progress messages. Whole-game acceptance
still requires the remaining named journeys and real input/device qualification.
