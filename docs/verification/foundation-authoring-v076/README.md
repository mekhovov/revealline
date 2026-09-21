# Foundation authoring example — scoped source and browser verification

Runtime source: `734318d645c4f5eb7108a5303111834c8cb2a949` (v0.76 candidate). The new generator/verifier and guide are isolated follow-up work, not part of that frozen source and not a public release. No simulation or player-shell files changed in this delivery.

## Passed

- Generator validates and prepares pack v6; an in-memory installed-library export/import preserves exact serialized data. Node 20.19.5 and 22.22.2 produce identical 5,270-byte pack files. Repeating generation refuses replacement and preserves the existing bytes.
- Legal fixed-tick direction commands win the starter in both Immediate and Grid + buffer on both Node versions: tick 978, three lives, 24.0764% coverage. The scripts do not mutate internal state to manufacture results.
- Fresh local browser origin `localhost:18806`: keyboard navigation reaches the native file picker; the generated chapter installs, Play selects First bridge, Escape dismisses the remaining parent Settings dialog and Start launches. One released Left command continues movement and closes a cut: 1.2%, 290 points, three lives, then the visible “Line secured” stop message. No browser win is claimed.
- Export installed packs produces an actual 3,605-byte `xonix-pack-library.v1` file. Its parsed `packs` value exactly equals the generated pack. The file download event timed out, but the actual downloaded bytes were found and inspected; a notification alone was not accepted as transfer evidence.
- A second fresh origin `localhost:18807` imports those exact downloaded library bytes through the normal file chooser. Island connections 1.0.0 appears; keyboard Play then Escape reaches First bridge with a 20% target, three lives and 0:00. No browser console errors were reported there.
- All 728 successful HTTP responses, covering 363 distinct paths across both origins, match the exact source bytes and SHA-256 in `source-inventory.json`. No HTTP overrides or injected browser storage/game state were used. Development boot metadata is separate from a production build.

## Remaining and limits

The parent Settings dialog still covers Ready after Library’s Play action. A future navigation correction should close the enclosing menu intentionally and focus Start mission without starting simulation. Returning from an ordinary Close should still restore the invoking control. This follows the logical-workflow exception in [W3C modal-dialog focus guidance](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/), inspected on 2026-09-20; it is a recommendation, not a claimed fix.

Procedural art and music recipes deliberately avoid embedded media. There is no image-decoding, original-image transfer, audible MP3, offline, mobile, physical-controller, performance, difficulty or enjoyment certification. This isolated example does not close P04 or P17 and does not replace the full release gates. Both browser tabs and their local servers were temporary; the preserved public upgrade profile was untouched.

## Retained files

`foundation-example.json` is the generated pack. `native-export.json` is the real browser download. `routes-node*.json` retain source-route results. `checks.json` records scope and commands’ outcomes. Compressed request logs and their inventory bind the preview to the source. `pins.json` hashes these retained evidence files; inspect them separately from the evolving scripts.
