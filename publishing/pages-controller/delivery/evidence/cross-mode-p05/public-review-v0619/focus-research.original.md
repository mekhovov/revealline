# Focus clearance review — 18 September 2026

Reviewed W3C primary guidance:
- https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html
- https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-enhanced.html

The minimum criterion concerns a focused component being entirely hidden. Its explanation distinguishes the component from an external focus indicator. The observed approximately 1.77-pixel clipping of the picker outline does not by itself establish a WCAG minimum failure. RevealLine retains its stricter reviewed requirement that the full focus outline be visible after rotation. Treat this as an explicit game quality-gate defect, not a fabricated blanket accessibility-conformance failure.

The proposed correction should measure the actual inner scrollport, including its border, while preserving text size, target size, selected file, unsaved metadata and focus. Verify both portrait-to-landscape and the return transition. Actual viewport results remain separate from physical touch/controller and assistive-technology certification.
