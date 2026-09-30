# Field Guide edition capabilities — batch 18

Parent: `9fa28512476bcef326113b8f73adf2ec40be272c` (PR761).
Status: implemented source correction; production review and public release deferred.

## Player problem and correction

Some source/compiled editions provide custom themes instead of the four canonical
Guide appearances. Opening or changing a role could dereference an absent palette.
Older role/impact practice also attempted a generic child route, although edition
boot admits only a named mission from its own validated catalogue.

The Guide now checks illustration and practice capabilities separately. Only an
available canonical theme or the current compiled FPV role supplies an illustration.
Missing artwork/palette keeps readable guidance with a localized explanation;
it does not request unrelated bodies or reuse the prior role. Edition hosts
explicitly disable the older catalogue lesson route before preparation, parent
suspension or handoff writes. The four supported current-mission encounters still
use the exact edition adapter. Ordinary hosts retain their canonical catalogue,
including after restoring an FPV-only pack. This adds no arbitrary edition import.

A source review also caught readiness changes while the page was hidden: the first
patch could leave the canvas hidden when the selected compiled image became ready.
The existing visibility/pageshow handler now reconciles availability before
repainting, without another loop or changing the held cosmetic clock.

## Evidence and reproduction

```sh
node --test game/test/enemy-guide.test.mjs game/test/enemy-guide-panel.test.mjs game/test/enemy-guide-host.test.mjs game/test/enemy-guide-edition.test.mjs game/test/enemy-guide-edition-host.test.mjs game/test/encounter-guide.test.mjs game/test/edition-controller-practice.test.mjs
```

**73/73 pass**, zero failed/skipped/cancelled, 13441.78825 ms, Node 22.22.2.
These are seven complete files, not a whole-suite claim. New coverage contains
five panel checks and two actual source/compiled application-host checks. It uses
a non-null modeled canvas, exact edition admission, both locales, direct disabled
activation, supported current-mission launch/return and retained checkpoint,
class/seed, temporary handoff and profile bytes. Existing tests retain ordinary
practice, restored-pack canonical themes, actual child simulation parity, input,
return focus and no-awards assertions. Counts overlap previous Guide cohorts.

Preserved failures:

- `parent-panel-red.tap.gz`: four failures before runtime edits on the parent,
  covering the missing palette and incorrectly enabled unsupported actions.
- `parent-host-red.tap.gz`: both source and compiled edition Guide opens fail with
  the actual missing-palette TypeError on the parent.
- `intermediate-visibility-red.tap.gz`: one failure against the first correction,
  proving background readiness retained a hidden canvas. This is **not** a parent
  baseline failure. The final visibility correction passes it.

The three failing logs are gzip-preserved byte-for-byte (use `gzip -dc` to read).
Their decoded hashes are recorded; original TAP formatting is not rewritten.

Scoped ESLint and Prettier pass for all four runtime/test paths. Source syntax,
locale/bundle formatting and whitespace pass. `catalog-check.txt` verifies the
four EN/UK strings in the actual generated bundle and deterministic complete
catalogue serialization. Independent read-only source review found no blocker in
capability gating, palette/lease ownership, visibility restoration or launch
isolation. No existing runtime assertion is removed or weakened.

The separate Team continuation in PR757 is now
`29f899e23ac556dd623a02df401adbea151fc087`, with 54/54 composed Hunter import/
Start/Help cases. Its source, receipt and counts are separate from this cohort.

## Limits and remaining work

The checks use finite DOM/Canvas/controller/storage boundaries. They do not
establish native pixels, browser layout, physical-device control, cultural/art
quality, full offline support or full-suite qualification. Production review,
whole-roster adoption, integrated build/provenance, immutable release and public
play remain deferred/open; the original production history is unchanged. The
new honest unavailable state is not support for older catalogue practice inside
editions. Adding that route later needs explicit admitted content and recovery.

This bounded source continuation stays in PR761 without a version bump or new
release. A/B/C work remains the priority; C2's formal human benchmark stays last.
