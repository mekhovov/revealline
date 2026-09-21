# Fullscreen request ownership

This is a held handheld correction after PR209, not a public release or device certification.

The shared fullscreen control previously submitted a new request for every activation while the browser's earlier request was pending. A failed request left a denial tooltip even after a successful retry. A settled request also updated the old control after its owner detached.

The control now allows one pending transition. It keeps focus and browser fullscreen events working, ignores late UI writes after teardown, and clears a prior denial only after an accepted request. An explicit later action can exit or retry. There is no automatic fullscreen retry and no change to simulation or saves.

## Evidence

- Original runtime at `7f68890f4242b125c1b073c3f28c8101d3ff41f6`: five existing cases pass and all four new regressions fail. The baseline test additions were subsequently formatted without semantic changes.
- Corrected complete fullscreen test file: **9/9**, no skips, on Node20.19.5 and22.22.2.
- Scoped ESLint and Prettier pass. Exact source and final transcript hashes are in `source-proof.json`.
- These are finite browser API/promise tests. Final composed-source qualification, browser interaction and physical iPhone/Steam Deck checks remain open.

## Browser contract and research

[MDN Fullscreen API](https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API) documents asynchronous request/exit promises, actual fullscreen-state events and the capability flag. This motivates preserving the ordinary fitted browser layout through rejection instead of treating fullscreen as required for play.

[WebKit safe-area guidance](https://webkit.org/blog/7929/designing-websites-for-iphone-x/) supports accounting for screen cutouts when positioning controls. [WebKit Safari26 guidance](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/) describes Home Screen web-app behavior. Neither establishes a universal iPhone document-fullscreen guarantee. Capability detection and ordinary Safari testing remain mandatory.

[Steam device recommendations](https://partner.steamgames.com/doc/steamhardware/recommendations) require broader controller access and correct mixed-input behavior; these small component tests do not certify that journey.

Maintenance prompt: “Hold the browser fullscreen request, activate again, then resolve or reject it. Verify only one browser request, truthful state, an explicit working retry/exit, no stolen focus, and no updates after teardown. Check the same game without fullscreen and record actual Safari/standalone behavior separately.”
