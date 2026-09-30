# Creator Guide: current reading and return qualification

Runtime and fixture: `a6ac18d51cbc7a35a65d19f8286b1650e87fc57d`, based on integrated main `3c31d242e460291de46fd1569d28fef60e62c714`. Route: `/authoring/community/index.html` (the directory route serves the same document). Browser origin: `http://localhost:8998`. This report qualifies Guide navigation and reading, not Community accounts, catalog publication or the workflows described by its prose.

## Change and contract

The previous Sections implementation could target an outbound/download link, or an unfocusable heading that lost focus on the next neutral controller frame. Seven explicit section readers now give both Sections and Contents stable, inactive Read destinations. Enter starts bounded reading; Back or Confirm restores the exact Read entry. Existing shared navigation, Confirm and foreground ownership remain unchanged. Whole-page reading remains available. Live reader names resolve the selected locale directly, and terminal cleanup releases the local listeners/observers while BFCache restoration retains the owner.

Direct entry now returns to the real Content Studio parent. A valid same-origin referring page still takes precedence. There is no Creator Guide entry in the current Workshop registry, so this batch does not invent a Workshop route. All ten direct Markdown destinations, two example download links and rich localized link slots remain intact.

The Guide has no Save, import, validation, project export or approval operation. Its two example links are real static downloads, left unactivated in this batch. Content Studio may create its initial local checkpoint on ordinary startup; that destination behavior must not be described as storage-free Guide reading.

## Automated source evidence

`node --test game/test/creator-guide-host.test.mjs game/test/community-creator-guide.test.mjs game/test/authoring-reference.test.mjs game/test/authoring-input.test.mjs`: **35/35 passed**, zero skipped. These comprise 16 actual-Guide host cases, one existing Two Crossings domain/import/export case, four reference cases and fourteen shared-input cases. The independent 17-case review overlaps this cohort and is not an additional total.

The host cases cover safe section destinations, first native Enter, controller neutral focus, consumed Back, reader ownership, hidden/blur/BFCache/terminal lifecycle, live EN/UK labels and valid/direct return destinations. The existing sample test exercises production pack validation and legal modeled completion; it is not a browser download/install result.

Scoped ESLint, Prettier and `git diff --check` pass. Full localization passes **11,825 messages / 8,812 references**, with no catalog or translation changes. Current integrated main contains 18 editions while the inherited inventory listed 14: the first inventory run was **1/2**, exposing that separate documentation drift. Inventory reconciliation `825c5adf1` records the four actual source mappings without extending the old 14-edition acceptance claims; its final inventory run passes **2/2**, zero skipped.

## First complete virtual-controller run

`game/test/manual/authoring-controller.html?tool=creatorGuideCurrent` passed **4/4 stages on its first complete run**, through standard gamepad pulses and the existing input owner. No production handlers, focus setters or storage writes were invoked by the fixture.

1. All seven Sections and Contents choices retain exact inactive Read controls; canceled Sections restores its prior control. No raw document or example download is activated.
2. Every section reaches its observed bounds and returns to zero. At the actual 1,248 × 547 inner viewport, Try/Picture/Campaign scroll through **72/110/216 px** respectively. The other four have no overflow, so their successful reading entry/exit is not a scrolling claim. Whole-page reading reaches **3,286 px**, returns to zero and restores its opener with both Back and Confirm.
3. A canceled language draft changes neither content nor preference. Real UK/EN choices update all seven headings, reader accessible names and Sections labels, then restore English. An initially absent `revealline.locale.v1` becomes an explicit English preference; no other local or session value changes during Guide-only stages.
4. The real return link opens Content Studio; its existing guide disclosure and link reopen a fresh Guide with inactive readers, English and the exact Studio referrer. The prior one head/one revision retain their complete stored record values and no new rows appear during this virtual run. That existing checkpoint was created by ordinary Studio startup during the earlier native return check. No draft is erased to manufacture an unchanged-storage result.

The runner was 1,280 × 720. Its actual visible result is `/private/tmp/creator-guide-controller-20260930.json` (12,260 bytes, SHA-256 `380cc91c85b9f09e67b12a8958ca1ca72e6d211853fc93db38f5f6e178b444e2`). This is a browser-rendered virtual controller, not a physical gamepad.

## Native keyboard evidence

Unindexed native keys, without pointer focus reset, open Sections, enter reading and restore exact section openers. At the observed **390 × 844** viewport, all seven sections were traversed with Down/End, Home and Escape. Automatic/Try/Picture/Campaign/Recovery reach **164/143/365/656/137 px**; Meaning and Documentation have no overflow. No horizontal page overflow was observed. Contents → Meaning focuses its Read control without following an outbound link. A final committed-source Campaign repeat reaches 656 px, returns to zero and restores its Read entry.

Earlier at 1,280 × 720, reader Back followed by page Back opened Content Studio; native Tab opened its real guide disclosure/link and returned to the directory Guide route. Studio visibly reported `my-journey`, saved locally at checkpoint 1. Native checks did not validate every Studio operation or execute a native full Ukrainian reading journey.

The compact native rows record bottom positions and exact exit openers; their null `regionY` denotes no active reader, not a measured Home position. The explicit Campaign Home=0 observation was read separately from its DOM region.

Compact observation transcription: `/private/tmp/creator-guide-native-observations-20260930.json` (SHA-256 `bd49c6c8ebaaa06c8660156aeb41a76721aabee012a1a743278e7d1b41177f22`), not a raw interaction archive. Final phone screenshot: `/private/tmp/creator-guide-final-20260930.png` (SHA-256 `941d3f73d83ae6933a200433f7d94e5c39deab16dabdec0ebb313e455177e4ae`). Owned tabs/server are stopped; viewport override is reset. Origin 8998 retains its explicit locale and Studio checkpoint.

## Source and package boundary

No admission change is needed. At `a6ac18d51`, the actual default collector contains **2,409 paths**, zero test fixtures. All **27 Guide paths / 261,926 raw bytes** are optional Workshop content in Solo, Versus and Team, outside startup. The literal Guide closure resolves **40 resources / 26 modules / 63 edges**. All ten immediate documents and both JSON downloads are admitted. **68 captured paths match Git and disk**, with zero drift.

Receipt: `/private/tmp/creator-guide-package-attribution-20260930.json` (47,640 bytes, SHA-256 `bacc422f028ae226b78cddb983c4725b5c854cf0e923b7bc4461fd4eabcd938e`). Its scanner follows literal runtime dependencies and explicit direct documents; tool navigation destinations are checked for membership without claiming their complete runtime closures. Five links inside retained documents point to repository-only material. Dormant shared source-picker declarations do not require sample-media retrieval for this file-input-free Guide. This is not recursive offline documentation acceptance.

No materialized package or edition compilation was run. At the initial check, integrated default and 18-edition budgets were failing under publisher ownership; historical 14-edition receipts cannot qualify this base. The publisher subsequently fixed the default mandatory-cache budget in #814, with successful protected Pages run 36668093653 at `3dbf92d39f0e254d8925cd44e806866a0cf71cd6`. Its Company edition candidate run 36668093670 remains failed. This Guide branch does not alter either budget or remove any Demo/DroneAid resource.

## Public baseline and remaining gates

During this batch, public `/game/` and `/game/?edition=droneaid` reported **0.142.4@5a41f92c1d94c49ffd6879d2804bbe70421304a3**, including merged #808's exact viewer/source descriptor bytes. Both rendered correct titles/modes and native Settings → Back restored their Settings opener. Default first launch reported a stylesheet failure; Retry succeeded and sampled CSS returned HTTP 200. Screenshots: `/private/tmp/native-public-default-20260930.png` and `/private/tmp/native-public-droneaid-20260930.png`. This narrow smoke result is not acceptance of v0.150.0 or of this new Guide source. Both public landings also contain the separately owned FPV simulator and Flight practice actions.

A later repeat against newly deployed `3dbf92d3` passes DroneAid landing/keyboard Settings/Back, but **default `/game/` fails boot and Retry** with `The requested module './mission-library/handoff.mjs' does not provide an export named 'readMissionLibraryReady'`. Independent HTTP200 reads confirm the served `game/app.mjs` imports that name and `game/mission-library/handoff.mjs` lacks it; the same mismatch exists on this branch's integrated main base. App: 491,638 bytes, SHA-256 `be64dd328c3dbc374cee34d941ff0d4ae019a192e1d134c1b8cb1e97a7156149`; handoff: 9,502 bytes, SHA-256 `805804aa02f8072053bc2adc5413c6adf359dff39682e70f7557ae3ff217d683`. This is distinct from the earlier stylesheet retry. Current default public acceptance is **failed**, and the exact integrated Demo/Solo handoff regression was sent to Releases. Screenshots: `/private/tmp/native-public-droneaid-3dbf92d3-20260930.png`, `/private/tmp/native-public-default-3dbf92d3-failure-20260930.png`. No production cache or saved data was cleared.

Raw Markdown reading/return, actual example download bytes and their browser import/install journeys, full Ukrainian reading, physical controllers, native device builds, installed offline, active forced colors, true 200% zoom and mobile performance remain open. The next bounded follow-up should address the ten direct documentation handoffs and the two actual example artifacts, preserving the read-only Guide contract. The overall native-menu plan remains incomplete.
