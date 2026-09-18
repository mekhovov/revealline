# Studio guide interaction review

Reviewed 2026-09-18 for the guide feature on source 61cf9c14.

The [W3C disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) uses Enter and Space to toggle the focused disclosure. The Studio keeps the native details/summary interaction; its Close/Escape additions do not replace those keys. Escape-to-close is the application contract, not a requirement claimed from this pattern.

[MDN KeyboardEvent.repeat](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/repeat) distinguishes automatically repeated keydown events from a fresh press. The implementation must keep a held guide-close action from reaching unrelated operation cancellation; a separate fresh Escape retains existing Studio behavior. Unit and actual-host event fixtures model this boundary. Native repeat, long-reader focus, input methods and screen-reader behavior still need the current release browser checks.

These sources inform the design. They do not certify Studio accessibility, physical hardware, browser event behavior or release readiness.
