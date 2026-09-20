# Complete visual-theme catalogue boundary

This is a P04/P05 foundation candidate, not a shipped theme selector or a completed two-collection benchmark. `game/presentation/visual-theme-catalogue.mjs` validates declared compatibility and exact presentation references. It does not fetch assets, verify their bytes, approve artwork, change preferences, modify existing attempt pins, or start a game.

## Identities and outcomes

`createVisualThemeCatalogue(source, { previous })` owns a bounded JSON snapshot. Catalogue and entry revisions are explicit positive integers. Updating an existing catalogue requires its previously validated owner, a higher catalogue revision, and every historical entry unchanged. Changed compatibility, labels or presentation references require a new entry revision. There is no highest-revision lookup.

Every coverage row names an edition, content theme, mode, authored owner and exact level revision/hash. Solo and Versus use the existing accepted `baseCampaignKey`; Team uses its accepted pack ID, revision and SHA-256. Modes cannot borrow the other owner's schema. Keep numeric Team revisions and string legacy revisions exact, including accepted legacy whitespace. Do not reconstruct identities from display names, filenames or a level ID alone.

The host adapter must obtain these fields from accepted content, and compute `level.sha256` over the canonical authored level before difficulty/seed/runtime transformations. Team's pack hash likewise identifies its canonical accepted pack. This module checks the supplied identity declaration; it does not authenticate content or replace existing content validators. Those host adapters remain to be implemented and qualified.

`resolve(null, context)` explicitly selects campaign style. An exact entry reference returns one of:

- `compatible`: this catalogue declares the exact content/mode combination. Assets still need preparation and review.
- `unsupported`: the selected revision exists but does not cover this content. Offer a deliberate **Play with campaign style** choice; do not automatically launch or substitute artwork.
- `unavailable`: the requested revision is absent. Keep the old attempt/results and offer recovery; never replace it with a newer entry.

## Presentation checks

Each entry pins the compiler source, theme, optional collection and exact compiled-manifest SHA-256. After the existing asset loader verifies the manifest bytes and validates the complete compiled document, construct its declaration with `source`, `theme`, `collection`, `sha256` and the actual resolved slot IDs. Call `verifyPresentationIdentity(match, declaration, requiredSlots)` using a match from that same catalogue owner.

`requiredSlots` must come from the authoritative mode/scene registry, including dependency roles. It must not come from the candidate's own assertion of completeness. Missing slots, wrong hashes, substituted revisions and matches from another catalogue fail visibly. A passing identity check is not proof of decoded images, correct geometry, accessibility, art quality, offline availability or playability.

## Integration work still required

Keep existing picture/story v1/v2 readers and historical saves unchanged. Complete-presentation pins and staged attempt hosts need their own versioned integration. The current page host owns one shared accepted snapshot and retires old resources on replacement; do not mutate that host to switch a retained attempt's theme.

Before exposing Settings choices, qualify First Signal, First Connection and Relay Yard with both a complete FPV collection and a genuinely different Ukrainian ornamental collection. Include alternate originals and actors, real Solo/Versus/Team previews, required-role coverage, staged failure/cancellation, Retry retention, backup restoration and campaign-specific offline dependencies. A palette-only change does not satisfy this benchmark.

Maintainer prompt: “Use accepted authored identities and exact theme/collection/compiler revisions. Reject ID-only, wrong-mode and stale-content matches. Preserve historical catalogue entries and picture/story readers. Verify bytes and decoded assets through the existing loader, then compare its declaration against authoritative required slots. Keep unsupported content, unavailable revisions and broken assets distinct. Do not expose a theme selector or claim production coverage until both benchmark collections pass their real game journeys.”

## Verification scope

The focused tests cover all three mode declarations, exact content mismatches, absent revisions, explicit campaign style, required slots, immutable history, caller mutation, hostile JSON and legacy identity text. They exercise the pure boundary with synthetic declarations; they do not certify shipped assets or any complete game journey. Integration, six release gates, versioning and public verification remain separate.
