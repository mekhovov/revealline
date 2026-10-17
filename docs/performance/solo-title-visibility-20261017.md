# Title visibility updates — 17 October 2026

The title companion now changes its canvas's `hidden` property only when visibility changes. Closed-title callbacks and unchanged reduced-effects artwork no longer repeat the same DOM assignment. Its animation, exact borrowed artwork, missing-image behavior, approximately 30 Hz drawing limit and lifecycle remain unchanged.

The prior actual-module model observed 1,000 hidden updates producing 1,000 property assignments, zero image lookups and zero paints. The extended existing lifecycle test now verifies one initial assignment, single visible/closed/missing/restored transitions, no repeated static assignments, and unchanged drawing. This establishes removed operations; it does not measure native layout cost, energy use or explain the iPhone slowdown.

The complete `title-character`, `body-backing`, `enemy-body-motion` and `enemy-surface-sampling` test files pass **18/18** (0.340 seconds), with scoped lint and formatting clean. Raw TAP: 4,392 bytes, SHA-256 `e792d90057a6fe9c21217fe3bb126880d686f13069e5e6d60bd3bc1656872762`. Prior operation-count receipt: 1,794 bytes, SHA-256 `7caa5286d594cbd66a39ea0167a01fbfdd8039dad46d43ec3cc946b4644aff6e`. Both remain in `.cache/solo-followup/title-demo-hidden-audit/`.

A separate ownership inspection found no closed Demo clock or hidden Demo painting overlapping ordinary Solo. Open hidden spectator transport deliberately continues on its existing bounded timer and is covered by existing background-playback tests; this change leaves that behavior intact. No native browser run or prior qualification result is reassigned to this source.
