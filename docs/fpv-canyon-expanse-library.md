# Canyon Expanse: optional Library preview

The Library offers the original 8,192 × 8,192 m terrain study as a separate,
optional download. Six authored starting areas are available through the existing
regional flight menu. The description explicitly identifies the broad,
terrain-only landscape as an early study; detailed scenery and final art remain
unfinished. Existing Canyon, Railway and Urban entries are preserved.

## Immutable source and presentation

The row references the merged #1366 delivery at
`e561b41bb06d39775bf1bc5f9e078cabeeb84fef`:

- Identity `canyon-expanse-study`, revision `relief-r1`.
- Descriptor 329,372 bytes, SHA-256
  `d2c3dce6c39227e85a10256fb3d1082fec2a6c7a47f6347fd664e2840eb57003`.
- Total optional download 47,975,524 bytes, including the descriptor.
- Explicit sparse companion; all 1,024 terrain cells remain mandatory and all
  matching scenery cells declare empty scenery.

Canyon sediment presentation is assigned only after the exact identity and
descriptor hash verify. Unknown revisions retain plain presentation. The three
existing quality tiers share the same source and collision geometry; no budget,
source payload, physics, scoring or runtime schema changes are included.

## Verification

The `canyon-expanse` case in `verify-library-appearance.mjs` checks the actual
production presentation binding and sessions. Performance, Balanced and Quality
all retain 456,408 geometry bytes, zero texture bytes and the same geometry
digest. Unknown-pin fallback is plain, paused starts remain disarmed at zero
ticks, and disposal releases all owned geometry. The receipt is
`canyon-badlands/expanse-library-appearance.json`.

The immutable delivery separately passed all 2,051 verified responses and twelve
authored-start/climb/pause/disposal cases across both modes. Its source proof
contains 24 commanded routes and complete terrain/seam checks. Those receipts
are not substitutes for browser storage or installed-package acceptance.

The actual production downloader then fetched and verified all 2,051 responses
from the immutable GitHub HTTPS URL in one complete run. It transferred
47,975,524 bytes in 144.3 seconds using the bounded four-worker downloader on
main `23299aaca9b4a324c6c0876ae55874340cd137ee`. This is one command-line
network observation, not a promised browser/device download time. The receipt is
`canyon-badlands/expanse-remote-download.json`; browser storage remains untested
by that check.

## Release gates

Normal Library download/save/reload/first flight, all six menu starts and the
new exact packaged offline journey still require native acceptance. This entry
does not claim finished art, continuous whole-region flight or measured device
FPS. Existing smaller Canyon revisions remain useful, independently preserved
practice regions.
