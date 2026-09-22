# v0.83.0 public acceptance

This folder records the bounded public acceptance of RevealLine v0.83.0 after
Pages deployment run
[`35775874062`](https://github.com/mekhovov/revealline/actions/runs/35775874062).
The frozen game source is
`01b189f6427601a15cbb3eb1563b5f82eabbafa3`; the Pages selector/controller is
`e0f99c9642355aa3daf62ce3e551675b8c9d2e14`.

## Accepted result

- The public root resolves to v0.83.0 and the visible build reports that version
  and source revision.
- The authenticated production Pages artifact contains 3,809 files and
  613,866,928 bytes. A separate public HTTP readback verified 135 affected files
  and 258,792,093 bytes, including all 103 current Journey pictures. The complete
  inventory is an assembled-artifact receipt, not a claim that all 3,809 files
  were downloaded again over HTTP.
- The default public catalogues expose 91 Solo missions, 91 Versus missions and
  12 Team missions. Explicit Legacy routes remain available.
- Solo completed **First return** at 34.3%, 8,160 points and three lives, then
  continued directly to **Choose your share**. A new owned capture survived a
  root reload and explicit Continue restored the paused flight.
- Versus completed the same mission with Player 1 and advanced both boards to
  **Choose your share**.
- Team completed **Twin landings** at 60.7% and advanced directly to
  **Stepping exchange** while keeping results visible during artwork checking.
- A real 10.2 MiB Legacy chapter was downloaded, verified, launched as
  **Orchard Crossing**, left safely, and returned to the retained Journey flight.
- The corrected Playground route launched **First Signal** in practice mode and
  awarded no campaign progress.
- Bounded browser viewport checks covered 390×844 portrait and 844×390 short
  landscape without hiding the complete Team/Playground arena or critical HUD.
- The immutable GitHub release contains exactly nine pinned assets.

## Evidence

- `browser-acceptance.json` — public Solo, Versus, Team, Legacy, persistence,
  Playground and responsive browser observations.
- `default-journey-public.json` — release/root pins plus all current-default
  original-picture and affected-runtime byte checks.
- `expected-inventory.json` — exact 3,809-file production artifact inventory.
- `distribution-receipt.json` — immutable release distribution verification.
- `release-assets.json` — the nine GitHub release assets and their digests.

## Boundaries

This closes the scoped browser release; it does not establish physical touch or
controller certification, a fresh exhaustive 546-configuration campaign run,
complete cold-offline readiness for network-backed pictures, later-campaign
endings, or human balance approval. Responsive checks used browser viewports and
keyboard input. Those gates remain in the delivery plan.

v0.82.1 remains playable in
[Archive 51](https://mekhovov.github.io/revealline-archive-51/releases/v0.82.1/site/game/).
