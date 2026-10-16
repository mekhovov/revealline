# Team lock and rescue language continuity — 29 September 2026

Parent: `f09146837cfcc5191c89e54d7f9afea56b2ef8e9` (PR757).
Status: implemented source correction; production review and public release deferred.

## Player problem and correction

The Team board kept `LOCK` and `RESCUE` in English after the player selected
Ukrainian, while the details reader already used Ukrainian. Three compact message
templates now produce `ЦІЛЬ` and `РЯТУЄМО`, retaining the one-based player number,
validated floored rescue percentage and compact slowdown arrow. English output
remains exact. A legacy rescue role still shows its target without inventing a
percentage, and reserve recovery does not imply ongoing contact rescue.

Cue priorities, measured packing, minimum font sizes, warning geometry, input,
rescue timing and simulation remain unchanged. Repainting after a language change
uses the existing locale authority and preserves complete core checkpoints. This
is functional cue localization, not a new actor, animation, rule or artwork.

## Verification

```sh
node --test game/test/coop-cue-localization.test.mjs game/test/coop-actor-presentation.test.mjs game/test/coop-rescue-presentation.test.mjs game/test/coop-bonus-slow-cue.test.mjs game/test/coop-cue-group-layout.test.mjs game/test/coop-cue-overflow.test.mjs
node --test game/test/coop-actor-layout.test.mjs
```

The first complete six-file cohort passes **67/67**, zero failed/skipped/cancelled,
1,628.947625 ms, Node 22.22.2. The new file contributes nine cases. Existing Relay
Yard legal inputs reach both warning targets and both real contact rescues. Tests
compare EN → UK → EN draw commands, retained target/progress, 212/1152 CSS widths,
Large/Plain and reduced effects, paused warnings and unchanged complete state.
A schema-valid public pickup route retains the downward slowdown marker. Real
reserve recovery removes the contact-rescue label.

Independent source review then identified five stale English expectations inside
existing explicitly Ukrainian layout cases. Their initial complete file is
preserved as **24/29**, with five caption mismatches. Only those five expected
strings changed to `ЦІЛЬ 2`; English cases, counts, geometry, exclusion, cache and
font assertions remain intact. The corrected complete layout file passes
**29/29**, zero failed/skipped/cancelled, 732.366 ms. This is a separate cohort;
prior batch totals overlap and are not programme-wide completion counts.

`parent-label-red.tap.gz` preserves the seven valid pre-fix Ukrainian caption
failures. `stale-layout-expectations.tap.gz` preserves the five intentionally
changed-copy mismatches. Earlier fixture calibration is not product-failure proof.
The manifest records exact source, receipt and decoded-log hashes.

Scoped ESLint, Prettier, syntax and whitespace pass. The generated catalog equals
the existing authoritative generator; EN/UK each add exactly three keys and retain
every previous value. No content registry or production metadata is regenerated.
Independent review found no runtime blocker; the identified test updates are
included with all geometry assertions preserved.

## Limits and integration

The new tests establish cue identity, read-only behavior and modeled bounds.
Complete packing/cache/overflow claims depend on the adjacent layout cohorts;
finite 0.55-em Canvas widths are not native font or pixel evidence. Browser layout,
physical devices, full offline/performance and production/public acceptance remain
open. All accepted art, historical simulation formats and production pins remain
unchanged. Publisher reconciliation must merge these three message keys into its
current catalogs without replacing newer locale entries, and requalify the exact
combined renderer/source bindings before publication.
