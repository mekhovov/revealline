# Team HUD wrapping and live departure labels — 2026-09-29

Source-only verification of the Team readability follow-up on base `0a9be382d03bf7288fc20942f9938ce96563264f`, which integrates main `64c8b9d81604984363666abadae236d9f2f76f7f`. The later docs-only main update was not yet merged into this evidence source. Public release, frozen-source qualification and Pages verification remain pending.

The Team handheld stylesheet now sizes its HUD and controls from their actual content. Short layouts retain 132px direction pads (44px direction cells), give action labels more width, and keep the entire 2:1 board. Two compact Ukrainian labels were shortened; full downed/free-rescue and crawling text remains in the accessible DOM. Departure-confirm labels now resolve the active locale when displayed and when the locale changes.

## Browser evidence

These are actual native browser keyboard/click interactions against the local source server, including real downing, recovery, Pause and cancelling departure. They are not physical-touch or controller certification. The paired PNG/JSON captures are unmodified. `departure-live-uk-after.txt` records the Ukrainian dialog and focused Stay action; `departure-cancel-focus-after.txt` records return to Change setup with the attempt still paused.

No intentional browser zoom override was applied; 200% zoom was not qualified here. Historical geometry captures did not record DPR or visual-viewport scale. The separate [final scale sample](final-browser-scale.json) reports DPR 1 and visual-viewport scale 1 at 568×320 for the final departure check only; it must not be retroactively assigned to earlier captures.

All measurements below are CSS pixels from the paired raw JSON. Message entries show visible height / bottom edge. The retained failure is the downed state **before the final compact-copy correction**, not a pristine main screenshot.

| Capture                                                                                  | Viewport | HUD height | Complete board | Controls bottom | Message height / bottom |
| ---------------------------------------------------------------------------------------- | -------- | ---------: | -------------- | --------------: | ----------------------: |
| [Relay, downed UK Large, before compact-copy fix](relay-downed-before-568-uk-large.json) | 568×320  |     123.19 | 212×106        |          338.18 |           0.00 / 342.18 |
| [Relay, downed UK Large, final](relay-downed-568-uk-large.json)                          | 568×320  |      50.30 | 212×106        |          268.14 |          45.00 / 320.00 |
| [Relay, downed EN Large, final](relay-downed-568-en-large.json)                          | 568×320  |      50.30 | 212×106        |          266.34 |          45.00 / 320.00 |
| [Relay, recovery UK Large](relay-recovery-568-uk-large.json)                             | 568×320  |      50.30 | 212×106        |          268.14 |          45.00 / 320.00 |
| [Relay, UK Large portrait](relay-390-uk-large.json)                                      | 390×844  |      96.59 | 370×185        |          648.19 |          90.00 / 428.59 |
| [Relay, UK Large landscape](relay-844-uk-large.json)                                     | 844×390  |      44.00 | 488×244        |          311.99 |          45.00 / 390.00 |
| [Relay, UK Large handheld](relay-1280-uk-large.json)                                     | 1280×800 |      78.89 | 924×462        |          552.91 |          46.80 / 792.00 |
| [First Connection, EN Standard, both pads](connection-both-568-en-standard.json)         | 568×320  |      44.00 | 212×106        |          265.25 |          17.50 / 320.00 |

The failed state pushed controls below 320px and gave the message no visible height. Final short-landscape captures retain both pads and a 45px message band; longer Ukrainian messages have 68px scroll height, so not every sentence is visible simultaneously. The board remains 212×106px at 568×320: complete geometry is preserved, but this is still a small display. Direction rectangles measure 44×44px in the 568px captures and 52×52px in the larger captures. The earlier English `minButton` helper could produce null/infinity from an empty filter; these statements use the raw element rectangles instead.

## Focused checks and retained failures

- `final-host-cohort.tap`: 99/99 pass, zero skipped or cancelled, run **before** the isolated departure-caption fix. It is not a rerun of that final source.
- `departure-locale-after.tap`: 6/6 pass **after** the departure-caption fix.
- `departure-existing-guards.tap`: 20/20 pass **after** that fix. These suites overlap and were run at different checkpoints; the numbers are **not 125 unique tests**.
- Scoped lint, formatting and native syntax checks passed as witnessed by the coordinating publisher. Their full command logs are not retained in this packet; this is a reported command result, not archived-log evidence.
- [CSS isolation](css-isolation.json): all 169 non-Team selectors retain the same ordered declarations and enclosing media context, normalizing whitespace only. This is a static isolation check, not proof of browser layout.
- [Catalogue verification](catalog-verification.json): regenerated catalogue matches the current locale source; only the two intended UK interface values changed and the content registry is unchanged. Full i18n content extraction was unavailable because this sparse checkout lacks the unrelated `original-fpv-pressure` source pack.

[evidence.tar.gz](evidence.tar.gz) preserves every available non-image log/proof from the review directory, including the initial failures. The first host run includes a stale Support-teaching fixture and missing sparse-checkout Viewport imports. The old-gate diagnostic is historical evidence only. The corrected fixture rehearses actual public core inputs, proves that a moving enemy is slowed on the winning tick, and retains terminal-state assertions. The isolated Viewport rerun passes 12/12 after its existing dependencies are available. The departure-locale regression fails before the fix and passes afterward. No failed run is relabelled as a pass.

## Evidence boundaries

Only curated final images and the explicit before-down failure image are copied; intermediate screenshots are omitted. The archive retains raw text/JSON diagnostics, including intermediate geometry. Presentation metadata is a fingerprint record, not a new production-art approval. No full build, hardware qualification, exhaustive mission playthrough, 200% zoom claim or public-release acceptance is established by this folder. Source and artifact hashes are in [manifest.json](manifest.json); that manifest deliberately does not hash itself.
