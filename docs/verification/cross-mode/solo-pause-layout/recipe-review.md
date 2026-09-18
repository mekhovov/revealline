# Scoped Pause screen recipe review — v0.61.24 candidate

Status: adopted scoped Pause-only native observations and reproduced source/review successors; no phase/release acceptance.

Base source `2f1074a37ade9c731ea7be37a6e56e533b51d1ac`. The four-path Pause patch is `0017200a09fcd8b56828673f0647c4751d213aa1fac1b0edf874ea78c9f1d026`; its sole runtime postimage is `43ebeb2288a7e2e3e153fbfc3c7c84e719fe2fb62e694cbce01ad0fb6c228624` (19357 bytes). The complete ordered screens fingerprint changes from `4f9a3429dd418dc2376c6d2b871280fd8866e4a23f1f2acc30d4775ecb013e0d` to `18c153b6443e96b59dc3c1253eba9c011dbd3fad45341288cd0b3b2ec044dbb7`.

The generic ≤600px grid now excludes only Pause via `:where(:not([data-kind='pause']))`, preserving specificity. Existing Pause rules supply a single portrait column and a two-column short-landscape layout with full-width Resume/Main menu. Ready/Lost/Won retain the previous selector matching. No action handler, focus owner, simulation, control, typography token or artwork changes.

## Observed scope

Retained `root-native-layout-review.json` SHA256 `ed64c647190397231f799b7a80d319dc4b8b1ad06d71d1e9b650a779c687825c` is the exact parent-owned browser record. It covers the 280×800 Theme/Standard, Theme/Large and Plain/Large cases; portrait widths 600/601/680/681; 844×390 and 600×400 landscape; and 844×540 versus 844×541. The recorded keyboard Restart/Cancel, Mission brief/Back and Main menu/Continue routes preserve the examined state. Paused rotations retain focus and counters. The record contains inline screenshot observations only, with no exported screenshot hashes. The preview was the exact base plus four explicit text overrides, not a frozen release.

## Immutable production history

Do not update the review digest before retaining the source-stage successor. On the exact candidate, the unchanged generator first appends `field-kit@31` / `fpv@31`: seven active screen recipes become source-stage revision 16. After reviewing this record, update only the screens declaration and regenerate to append `field-kit@32` / `fpv@32`, with those seven recipes at scoped reviewed revision 17. The old revision-15 screen approvals and all older assets/themes remain unchanged. This is a shared screens fingerprint, so seven recipe records advance; it is not seven newly audited screens. Title landscape and portrait image selections remain at revision 3.

The portable bundle and compiled runtime/studio/manifest metadata must be regenerated through the existing checked pipeline. All 127 embedded payloads (4,007,816 bytes), the corresponding compiled asset files, and `theme.css` remain byte-identical. Do not regenerate fonts, sprites, title art, reveal art, audio or original media.

## Current-theme consumers

Generation advances the current FPV theme from 30 to 32. The two Team starter-picture bindings and live current-theme assertions advance with it. Picture IDs, revisions, bytes, dimensions and hashes remain exact; the strict lease matcher is unchanged. The current screen-input test also uses the newly reviewed fingerprint. Historical fixtures and immutable ledger prefixes remain unchanged.

## Retained checks

The [originals index](originals-index.json) binds the exact production receipts, independent review and 43 passing host cases on each of Node 20.19.5 and 22.22.2. These focused fixtures preceded the mechanical Team current-theme alignment above; final source qualification covers the integrated source. The original evidence bytes are retained in originals.zip.

## Remaining limits

Known 280px Large HUD score clipping and Mission Brief Done reading wrapping remain separate open items. Actual browser zoom, physical touch/controller, screen reader, audio/offline/lifecycle and native Lost/Won checks were not established. Existing host tests, source gates, reproduction/readiness, ordinary build, final committed-source and deployed public checks remain required. This declaration is not global screen acceptance, full P03/P05 completion or public release acceptance.
