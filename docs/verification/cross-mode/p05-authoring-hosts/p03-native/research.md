# Research for the supporting-tool correction

Reviewed 17 September 2026.

- [MDN pageshow](https://developer.mozilla.org/en-US/docs/Web/API/Window/pageshow_event): history navigation and background presentation can both emit pageshow; that event alone does not prove foreground visibility or BFCache acceptance. Preserve explicit foreground focus ownership and inspect restored form values in the actual browser.
- [W3C Resize Text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html): text enlargement should preserve content and operation. Verify actual enlarged text and clipping independently from resizing the game arena or emulating a phone.

Application: retain the shared read-only preference authority, verify Back/Forward selector consistency, and keep loading feedback/actions usable at the enlarged setting. These references inform tests; they are not an accessibility certification.
