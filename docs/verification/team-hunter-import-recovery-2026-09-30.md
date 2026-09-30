# Team Hunter import recovery

This independently mergeable recovery extracts the Hunter tuning guard and its
two original regression files from closed PR #757, exact source
`541d7fcde298ccddffe3f683698bf890212db766`, onto main
`6c6771d7fc3e05db3656f730cd429e9f197d8ec1`.

Accepted Team v6/v7 imports allow Hunters but forbid encounter overrides. Current
tuning added an encounter object, so a valid imported campaign failed at Start.
The guard leaves those editions' native Hunter attack timing/speed intact while
preserving tuning for older editions. The newer published vector arithmetic,
recorded-recipe compatibility fallback and frozen v1/v2/v3 adapters are unchanged.
No level schema, saved data, generated production, compiled asset or budget changes.

## Bounded verification

- Before the fix, the selected real-import v6/standard case failed with
  `Invalid tuned Team level`; 14 unmatched cases were skipped.
- After the fix, both recovered regression files passed all 25 cases with no
  skips or failures. They cover import/start, native warned Hunter attacks,
  older complete-output goldens, frozen adapter bytes/dispatch, strict schema
  rejection and exact saved-checkpoint reconstruction.
- Changed-file lint, formatting and whitespace checks passed.

These are Node regression fixtures, not browser, physical-controller or complete
public-player acceptance. Full suites remain `WAIVED_SKIPPED_NOT_PASSED`.

The remaining #757 cue layout, overflow, localization, support-teaching and
responsive-HUD work is not included or declared recovered by this change.
Original donor history and all unrelated current-main changes remain preserved.
