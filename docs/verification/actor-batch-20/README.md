# Complete ordinary Guide language updates — batch 20

Parent: `7147ed7556168b73cf9cbfd2b802f0d0b5847582` (PR761).
Status: implemented source correction; production review and public release deferred.

## Player problem and correction

Ordinary Field Guide entries mixed English and Ukrainian after selecting Ukrainian.
Relay Sentinel retained English advice, every catalogue practice appended English
movement/Pause/Retry instructions, and ordinary rows kept English Spot/Risk/Try
prefixes. The same problem followed the player into the active practice hint.

Three new interface messages per locale now carry the Sentinel explanation and
common practice suffix. The core-open phrase uses the existing translated state
name. Ordinary rows reuse the existing localized encounter labels. Existing
localized-text callbacks refresh the same nodes; no new navigation or state owner
is introduced. English meanings remain unchanged. Simulation, scenario creation,
artwork and historical identities are unchanged.

## Evidence

```sh
node --test game/test/enemy-guide.test.mjs game/test/enemy-guide-panel.test.mjs game/test/enemy-guide-host.test.mjs
```

**45/45 passed**, zero failed/skipped/cancelled, 13,343.629958 ms, Node 22.22.2.
These are three complete files, not the whole suite. The model test checks Sentinel
and all seven catalogue instruction suffixes in Ukrainian, plus exact retained
English text. The actual application host enters the Guide from a real unfinished
cut, changes language on the selected Sentinel lesson, launches practice, changes
language while the child is active, and returns. It retains topic/appearance,
existing text nodes, focus, child URL/window, handoff bytes, the complete paused
parent checkpoint and player-profile write count.

`parent-locale-red.tap.gz` preserves both failures against the parent text: 0/2,
with the actual mixed-language rows recorded. The first corrected-source run
passed the model test but exposed a mistaken test ID (`action` instead of the
existing `try` node). `intermediate-fixture-red.tap.gz` preserves that 1/2 result;
it is a fixture correction, not an additional product defect. Final tests retain
all behavior assertions. Decoded log hashes are recorded in the manifest.

Scoped ESLint, Prettier, syntax and whitespace checks pass. The catalog check
verifies EN/UK message placeholders, exactly three added interface keys per
locale, unchanged existing entries and content registry, and exact deterministic
generated-bundle bytes. An independent reviewer reconstructed that bundle in
memory and found no source blocker. Catalog regeneration deliberately uses the
existing catalog-only generator, without rewriting unrelated content metadata.

## Limits and remaining work

Host DOM, Canvas and iframe messaging boundaries are modeled. These checks are
not native browser layouts, physical-device or comprehensive localization
qualification. The scenario's stored identity/name remains unchanged; this patch
localizes player guidance, not authored content. It does not complete the deferred
full Ukrainian translation, approve artwork or qualify a public release.

The prior Sentry route cohort remains separately pinned in batch19. Production
review, publisher integration, source/provenance/build and public play remain
open. Continue A/B/C work with C2's human benchmark last. No version, approval,
release, tag or publishing mutation is introduced here.
