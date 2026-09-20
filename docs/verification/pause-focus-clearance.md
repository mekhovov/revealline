# Pause menu focus clearance

Adopted scope from original P03 source `9ee58177d11b2e7e0e3df6b4394e12503f67242f`. Its broader P03 ledger does not exist on the release branch, so retain only the related section here. Source-author observations below are separate from release-branch qualification.

### Short-screen pause focus clearance

The v0.69.0 public reviewer reported a clipped Main menu outline with Large/Plain
text at844×390. Reproduced locally: button bottom389px in390px viewport; the
generic short-screen reader's `height:100%` kept the pause card at320px while
wrapped actions overflowed it. Pause now owns its intrinsic height, cannot shrink,
uses safe centering and a scrollport with12px focus padding. Font sizes, button
targets, input handlers, gameplay and persistence are unchanged.

Native fresh-origin tab23 loaded the changed stylesheet (the older8780 tab retained
cached CSS even after ordinary reload). At844×390, keyboard-focused Main menu
bottom363px leaves27px clearance. At568×320, reverse traversal reaches Resume
top77px below overlay top48px; forward traversal reaches Main menu bottom263px
inside overlay bottom290px. At390×844, Main menu bottom594px is visible and
document width390px confirms no horizontal overflow. Large/Plain retained during
all three checks; existing saved sessions were not overwritten. These are desktop
browser viewport checks, not physical touch or assistive-technology validation.

Four complete pause-layout/text-size/controller-practice/controller-reading files
pass71/71, zero failures/skips,9.417seconds on Node20.19.5. The two new CSS checks
are explicitly structural guardrails, not simulated browser-layout evidence.


References: [MDN safe alignment](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/align-items) and [W3C focus visibility](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html). Final release-source checks and public acceptance remain required.

## Stacked correction preparation

The isolated `codex/pause-clearance-v0692` branch adopts the exact CSS/test correction on top of the v0.69.1 recovery candidate and subsequent card-contract fix. The two complete structural tests pass independently on Node20.19.5; changed CSS/test formatting passes. They do not prove rendered layout. Version0.69.2 is reserved for this correction; no existing tag was found when reserved. The branch still requires native integrated review, final source qualification after v0.69.1 integration, original immutable publication and public acceptance.

## Narrow-landscape HUD follow-up

At 568×320 with Large/Plain text, pausing compressed the arena panel to 153px, causing the score to extend beyond the viewport. The pause-only responsive rule now lets the underlying panel use the available page width. Running board geometry and selected font sizes stay unchanged. The native evidence records 568px document width after correction and the same 568px arena / 376px HUD widths during active flight.

Maintainer prompt: “Check Pause and explicit Resume at 568×320 with Large/Plain text. Measure the document, score and arena after layout settles; Tab to both ends of the pause commands. Do not conceal overflow or shrink the selected font to make the measurement pass. Record native browser evidence separately from structural tests and physical-device acceptance.”

Reference: [W3C focus-not-obscured guidance](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html).
