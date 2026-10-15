# Localization plan — 15 October 2026

Status: player-clarity and prevention batches implemented for review on `codex/localization-clarity-guards-20261015`. Final release qualification remains separate; see the [implementation receipt](localization-clarity-guards-2026-10-15.md).

Reviewed main: `4244ece94c25c9e5fb23391e62c3db269a6c999e`. Previous review: `fba236ef80bd0310ae3b9c33fd7c26b1529b245c` (13 October). Main was fetched in the isolated localization worktree. The closed historical localization source branch is preserved; the continuation branch is `codex/localization-plan-20261015`.

The final fetch advanced main from `da0b010820` through PRs #1340–#1342. Their regional package/scenery and delivery-record changes were reviewed separately; the canonical catalogs, shared localization runtime and known application-copy paths are unchanged by that delta.

## Implementation update — requested items 1 and 2

The user authorized **player clarity** (LOC-01/02) and **prevent recurrence** (the bounded LOC-03 checks and LOC-04 contributor workflow). Implementation began on main `55a9f55c742e4a9b78a3a79ff578f62ef819342c`; main was fetched again before qualification and the implementation was rebased onto `c72867c73ba18358e34b15ad8d2cd44d7bd4dcc9`. The original source review below remains historical context, not a claim that old gaps remain unchanged.

- **LOC-01 catalog batch implemented:** 200 Neon catalog entries translated, covering the original 128-entry review and 72 additional confirmed gaps. All 205 Neon entries now have Ukrainian text, with five existing translations retained. The route-coverage objective is also translated. Actual word-art inscriptions remain literal. Canonical mission data is unchanged. Exact built-in Neon gameplay projections are now registered, preserving all existing registry records; the real browser confirmed the translated title, objective and full briefing. Compact Large-text card/footer clipping is also corrected. Cumulative release acceptance remains pending.
- **LOC-02 source complete:** armed Skip and preparation/failure copy resolve official names lazily; custom names stay literal. Candidate phase statuses carry translation keys. Unknown exceptions stay in diagnostics, while known campaign mismatch and picture-storage recovery retain actionable localized guidance. The startup overlay and classic boot receiver get safe, live translated copy.
- **LOC-03 bounded implementation complete:** canonical namespace discovery, explicit maintained-source coverage, aliases/simple wrappers/finite registries, duplicate catalog detection, statically provable caller contracts, and an explicit-base new-copy gate. Dynamic cases remain unverified; existing debt is not silently certified. The new gate is separately invoked, not automatically enforced in every existing CI lane.
- **LOC-04 concise workflow complete:** [contributor recipe](localization-contributing.md). Richer machine-readable metadata and declarations remain optional follow-up work.
- **LOC-07 remains a release gate:** focused evidence and actual failures/blocked checks are recorded in the implementation receipt. Source completion is not visual, package, or release acceptance.
- **LOC-05/06 remain deferred:** bounded bilingual-table consolidation and generator/data separation were not part of this implementation request.

The release coordinator owns queue placement, cumulative acceptance, versions, publication and the independent Pages capacity decision. Do not merge this batch merely because its source is ready for review.

## Decision and historical source review

Keep the existing i18next runtime and its presentation bindings. Prioritize understandable Ukrainian gameplay instructions and recovery messages, add essential prevention checks alongside the fixes, then consolidate inline translation tables in bounded batches. No framework migration, version allocation, release metadata change, or translation-service adoption is proposed for the next batch.

| Area                   | Current result                                                                                                                                                                                | What remains                                                                                                         |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Shared localization    | Dedicated EN/UK JSON catalogs, nine namespaces, synchronous local runtime, live bindings and official-content display adapters are established.                                               | Adoption is inconsistent across maintained surfaces.                                                                 |
| Catalog expansion      | 13,651 English and 13,883 Ukrainian entries: +622 per language since the previous review (599 content, 14 interface, seven tools, two errors).                                                | Inventory counts do not prove translation quality or complete UI coverage.                                           |
| Team/Duel source       | New mission, objective, Studio, recovery and offline chapter copy is integrated; replacement headings resolve localized mission names and Ukrainian Neon Switchyards captions were corrected. | These scoped corrections do not complete the separate Neon catalog families below.                                   |
| Existing live bindings | Result-preparation and picture-status producers already defer translation correctly. Core focus/scroll and content-identity protections remain.                                               | Specific Skip/Journey and error paths still bypass the intended pattern.                                             |
| Packaging              | Packed catalog/content-registry generation is implemented. Current raw Git blob sizes are 1,265,063 and 356,931 bytes respectively; content has grown since the previous snapshot.            | No startup or transfer benchmark establishes a need for further splitting.                                           |
| Test policy            | Automated suites remain required under the October 4 policy restoration.                                                                                                                      | A required policy is not evidence of a passing run.                                                                  |
| Modernization tooling  | Existing key/placeholder/plural and generated-output checks remain useful. Content-source registration now includes multiplayer sources.                                                      | General scanner coverage, wrapper discovery, duplicate-key/caller checks and raw-copy enforcement remain incomplete. |

The prior reports are retained evidence, not an instruction to reopen or repeat merged PRs. Historical releases and integrated source branches must not be restored wholesale.

## Work-item definitions, value and acceptance

### LOC-01 — Finish confirmed Ukrainian prose gaps (P1)

**Work:** review and translate gameplay instructions and selection descriptions that still use English in the Ukrainian catalog. The audited `neonReference*` and `neonMosaic*` families contain 128 identical EN/UK values, including 46 values longer than 100 characters. This is a finding for those two families, not a count of every Neon message. Proper names and intentionally shared terms may remain unchanged.

**Why / benefit:** these paragraphs explain hazards, safe return surfaces and objectives. Translating them helps Ukrainian players understand how to play.

**Cost of deferral:** catalog structure can pass while important instructions remain English. The prior deliberate Neon deferral should be reconsidered for the next player-facing batch.

**Done when:** gameplay prose has accurate reviewed Ukrainian equivalents, placeholders remain compatible, and the affected selection/briefing surfaces are readable at compact and large text sizes. Preserve canonical content, identifiers and hashes.

### LOC-02 — Repair persistent messages and failure copy (P1)

**Work:** resolve official mission names at render time in affected Solo Skip, Journey and Library preparation/confirmation messages. Replace confirmed raw English failure instructions and raw player-facing exception messages with semantic localized messages; retain technical diagnostics separately. Use existing lazy producers, `contentText`, `library.presentation` and operation-status bindings.

Current source examples are the captured destination name at `game/app.mjs:6005`, eager Journey name at `:6127`, raw Library name at `:9136`, Skip failure at `:9197`, and startup error at `:13794`. These line references describe the reviewed main only.

**Why / benefit:** players receive consistent-language prompts and clear recovery actions during failures.

**Cost of deferral:** sentences can refresh while a name stays in the previous language; recovery copy remains difficult to understand.

**Done when:** EN↔UK changes repaint text only, with no restarted preparation, re-armed action, changed selection, focus/scroll movement, flight-state change or unsaved-data loss. Official names update; imported/custom names remain literal. Retain the already-correct result-preparation producers.

### LOC-03 — Make checks cover maintained interfaces (P1, bounded)

**Work:** derive namespace recognition from canonical catalogs; explicitly enumerate maintained source surfaces; recognize approved wrappers and finite key registries; detect duplicate JSON properties and missing interpolation arguments; reject newly introduced high-confidence owned display literals.

The existing seven-namespace registry-literal pattern omits `demo` and `controllerEditor`; direct literal translation calls and HTML markers still work. The computed controller-editor wrapper is not fully discoverable. Broad `library` exclusions and optional-surface omissions remain. The raw-copy audit is advisory; catalog placeholder parity does not establish correct call arguments.

**Why / benefit:** an agent gets an early, actionable failure instead of accidentally creating unvalidated copy.

**Cost of deferral:** new features continue increasing the cleanup backlog even when catalog checks succeed.

**Done when:** fixtures cover all nine namespaces, approved wrappers, maintained authoring/optional/classic-script surfaces, duplicate keys, missing arguments and Ukrainian plurals. Exempt authored data, diagnostic identifiers, legal text and historical evidence explicitly. Do not indiscriminately scan immutable release archives.

Start with the minimum safeguards needed by LOC-01/02. Do not hold small player fixes for a new general-purpose tooling platform.

### LOC-04 — Provide the current agent contract (small P1; richer metadata P2)

**Work:** publish one concise contributor recipe for catalog ownership, semantic keys, whole sentences, named placeholders, late-bound values, generated-file boundaries and precise checks. Keep historical checkpoints separate. Follow with machine-readable key/argument contracts, JavaScript-friendly declarations and translator context where useful.

**Why / benefit:** agents have one supported example and can fix diagnostic output without reconstructing project history.

**Cost of deferral:** nearby legacy examples continue to encourage incompatible translation patterns.

**Done when:** a new message can be added using one documented flow; invalid keys/arguments fail clearly. This plan refresh is not completion of that contributor guide.

### LOC-05 — Consolidate bilingual JavaScript tables (P2)

**Work:** move maintained interface translation data to dedicated catalogs while retaining helper APIs. Sequence authoring helpers/review screens, then FPV, then Overflight/Snake. Overflight's inline copy has expanded; its literal repair-amount replacement is a candidate for a named placeholder during migration.

**Why / benefit:** translation review and validation use one workflow. Most of this copy is already bilingual; the task improves consistency and maintainability.

**Cost of deferral:** parallel formats and manual substitution logic persist, making future changes and additional languages more expensive.

**Done when:** no hand-maintained bilingual tables remain in the migrated surface, behavior and live state are preserved, and optional packages include their required catalog subset locally without network loading or dependence on the entire main-game catalog.

### LOC-06 — Separate translation data from generators (P3)

**Work:** move remaining company/curriculum phrase maps to dedicated data files. Derive duplicated static fallback copy from canonical catalogs where feasible, while preserving readable startup/recovery HTML.

**Why / benefit:** editorial changes become reviewable without editing generation logic.

**Cost of deferral:** duplication and maintenance cost remain; this alone is not evidence of a current player failure.

**Done when:** canonical campaign records, save/replay identities and required generated outputs are preserved. Prove output/identity parity before accepting a mechanical migration. Do not blank fallback UI or translate canonical data before hashing.

### LOC-07 — Qualify each source batch and its cumulative result (release gate)

**Work:** run catalog extraction/key/placeholder/generated-output checks and focused tests for actual changes. On the final cumulative head, verify live switching, custom-name preservation, Ukrainian glyphs/wrapping, compact and large text, static/offline builds and native staging. Include pending/error/retry states in Library, Results, Replay, gameplay and authoring; record affected UI/Screens/Audio provenance only where changed.

**Why / benefit:** valid translation files alone do not prove readable UI, preserved state or packaged catalog availability.

**Cost of deferral:** mixed-language states, clipped instructions or missing offline resources can escape source checks.

**Done when:** evidence pins the exact source and distinguishes passed, failed, inconclusive and skipped checks. A checker timeout is a tooling issue until diagnosed, not a product failure or a pass. Historical Back/Replay findings require reproduction before being called current defects. Physical-device, external fresh-install, listening and pre-existing recovery work retain separate ownership/authorization.

## Delivery batches and coordinator boundaries

| Batch                                  | Contents                                                                                                                              | Exit / handoff                                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| A — player clarity                     | LOC-01 and LOC-02, with a short LOC-04 recipe and the affected LOC-03 checks. Use separate small PRs where source ownership overlaps. | Focused catalog/behavior evidence; coordinator accepts the cumulative source for release qualification. |
| B — prevent recurrence and consolidate | Finish LOC-03, then LOC-05 one surface at a time; add useful LOC-04 metadata.                                                         | Each surface independently reviewable and package-compatible.                                           |
| C — structural cleanup                 | LOC-06 and any remaining justified metadata work.                                                                                     | Exact output/identity preservation and affected packaging evidence.                                     |
| Every source batch                     | LOC-07 proportional checks, plus cumulative checks before release.                                                                    | Only the release coordinator assigns versions, integrates release batches and publishes.                |

The implementation update above records current source progress. These batch boundaries do not imply release acceptance; continue with LOC-07, then LOC-05 only when separately prioritized.

The October 13 observation of zero open PRs is obsolete. The October 15 snapshot includes coordinator-owned FPV quality/Urban/Canyon/Tropical work: #1310, #1316, #1320, #1333, #1328, #1335, #1338 and #1339; separate Snake public-verification work is queued as #1343. Leave their branches and release artifacts frozen. Re-read **🔥 Releases** before source changes and coordinate the next base/sequence there. A draft or queued check is not an available branch to adopt.

Current FPV delivery records also list localized graphics-timeout/retry wording as in progress. Reconcile that separately owned change before proposing an overlapping recovery-copy fix; do not count it as completed or duplicate it in LOC-02.

Before implementing each batch, fetch current main, reconcile only confirmed remaining gaps in an isolated worktree, and fetch again before qualification. Preserve the primary checkout and staged, untracked and ignored work, along with the minimum free-space reserve of 1,275,068,416 bytes. Do not install dependencies, download large assets, clean worktrees or delete history as part of this plan update.

## Evidence and limits

Reviewed source: [main 4244ece94c](https://github.com/mekhovov/revealline/commit/4244ece94c25c9e5fb23391e62c3db269a6c999e).

- [Team/Duel delivery status](team-duel-expansion-status.md) and [follow-up verification](team-duel-expansion-followup-2026-10-14.md) record catalog checks and 48 sampled mission observations across EN/UK and layout settings. Those are scoped receipts, not every combination or a cumulative acceptance of this main.
- [Overflight integration review](qualification/overflight/riy-sorties-20261014/integration-review.md) records scoped navigation/state checks.
- [Overflight offline review](qualification/overflight/worlds-20261014/offline-native-review.md) records short server-stopped launches at runtime `a539ccde4` / build `dece9da68`, not this reviewed main. Sound was off; final cumulative package/publication and separately deferred device/recovery/listening acceptance remain distinct.
- [Neon reference README](../authoring/library/neon-reference-pack/README.md) retains its explicit Ukrainian deferral. Current catalog inspection confirms long English prose in the audited Ukrainian families.
- [Test policy](../publishing/test-policy.json) requires automated suites. Historical waiver receipts do not describe current policy.
- [Saved-place package qualification](fpv-saved-places-package-qualification.md) covers one exact non-public package and a cached journey with its own origin unavailable. It does not establish all-network offline, physical-device or general localization acceptance.

The original plan refresh performed source inventory and history review only, with documentation formatting and Git diff checks. Catalog generation, automated product suites, browser/live-switch, glyph/layout, static/offline and native-staging qualification were not run for that documentation-only change. The linked implementation receipt records the new implementation batch and supersedes this historical verification status.

Framework replacement, translation-service adoption, broad key renaming and further catalog partitioning remain deferred. Reconsider them only against a demonstrated unmet requirement or measured bottleneck.
