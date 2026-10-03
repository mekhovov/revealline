# Classic Snake integration receipt

Inspected on 3 October 2026. Product commit:
`fafaaccb4c68e0a9cdd5e652e4c8f727daed54e4`.
Source tree: `eaf57e9d9306c03e7d79fa2e2bb7e9909c22729c`.
The subsequent receipt commit changes documentation only.

## Static and build checks

- `npm run lint`: passed on the committed product source.
- `npm run validate`: passed, including EN/UK localization, literal references
  and presentation metadata. The seven reported navigation warnings concern
  existing assembled-site paths outside the local game source; no Snake path was
  reported. Validation admits 2,690 collected files.
- Changed source and evidence files passed Prettier; `git diff --check` passed.
- `node scripts/inspect-default-build.mjs --out /private/tmp/classic-snake-default-build-fafaaccb4.json`:
  passed with both included inputs and all available committed sources verified.
  Node 22.22.2 was selected through mise. The checkout remained clean and frozen
  throughout inspection.

The retained [build report](default-build-fafaaccb4.json) is 537,811 bytes,
SHA-256 `e7ddcc35a3c9e3fef91ad7f15269f0f6cb897547d2544fe12ce57470eee4bddd`.
The main Pages profile payload, including its manifest, is **855,819,557 bytes**.
Its manifest is 413,291 bytes, SHA-256
`e37fbd7c748af4fb0bdda0c36c68969916fb3c6e201f8310c431be398b2e322f`.
The payload plus the inspector's 25 MB margin remains below the 950 MB Pages
budget. This completed inspection supersedes the earlier Capture-remix product
commit's ENOSPC/incomplete default-build attempt.

This is one candidate profile preparation in memory. It is not a reproducibility
comparison, immutable release freeze, complete assembled website, public asset
acceptance or production deployment. The report deliberately records
`publicEligible: false`, `promotable: false`, `completeHostedOutput: false` and
`publicationAssessment: "not-performed"`. PR 973 remains a draft.

## Browser observations

Bounded native browser interactions at `http://127.0.0.1:8779` confirmed:

- The user's original Solo Snake Journey URL redirects to the classic play page.
- The campaign hub exposes eight chapters, 48 classic layouts and mode links.
- Solo displays four visible starting cells, one humanoid, catch/length/score
  counters and a clear start action. A direction input starts automatic movement.
- Escape pauses the moving snake. Straight-line movement into the outer wall
  ends the round and explains the wall collision.
- Versus shows two initial boards with matched counters and targets; Team shows
  two distinct bodies on one board and describes its shared collision rule.
- English/Ukrainian selection translates the player-facing instructions,
  campaign names, selectors and counters.

The reviewed UI also fixes accidental body replacement during mode-label
rendering, asynchronous import replacement of a newer round, physical WASD under
Ukrainian input, pause from focused settings, exact terminal save timing and
locale/level URL synchronization. Terminal input bounds now save and show a
result immediately. Classic hub rendering no longer waits for the optional Sim
package; capture-host mode links preserve the explicit remix marker.

The final local demo remains at
`game/snake/play.html?mode=solo&lang=en&level=classic-snake-open-loop`.
The local screenshot `classic-snake-ready.png` is attached to this chat; it is a
ready board, not a fabricated completion screenshot.

## Scope of evidence

See [core observations](core-observations.md) for deterministic recorded-input
growth, win and exact replay evidence, and the
[catalogue observation](../../evidence/classic-snake-catalogue-observation.json)
for all 48 recipes and 192 core initializations.

Automated suites: **WAIVED_SKIPPED_NOT_PASSED**, following
`publishing/test-policy.json`. The new core/UI regression sources and modified
route expectations were authored but not executed. Browser observations and
direct production-model observations are reported separately from test suites.

Full human campaign balance, small-screen multiplayer, physical touch/keyboard
device coverage, offline installation acceptance, low-end performance and full
Team completion remain unqualified. Classic does not implement gamepad input or
a Studio GUI; existing Capture-remix Studio support remains available. Sim
continues to use the earlier separately documented flight implementation.
