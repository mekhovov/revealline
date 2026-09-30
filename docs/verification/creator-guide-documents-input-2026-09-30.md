# Creator Guide document readers — September 30, 2026

## Source and integration

Runtime was qualified at `8b5f4a9b1bf0e00b9ed6a7c5ead12d0a6c8f471f` and then rebased without conflicts onto latest main `4d9d70237506e51a877e5df3f4e6b6b91e20bb76`. Releases concurrently updated parent PR #815 to `593ad3157ff4aba110d40251a652c57faa0d5281`; a lease rejected our competing parent update, and the document follow-up was restacked onto that accepted parent as `928bbfd31ea72e632baf216855638c25d2f1dfb6`. The complete runtime tree is identical to the prior local rebase `22293cd7c`; relative to original `8b5f4a9b1`, only main's unrelated `game/test/field-kit-flow.test.mjs` differs. Do not restore an older #815 head.

Ten direct Markdown links now open in an owned modal on `/authoring/community/index.html`. Each file has a bounded byte count and SHA-256 pin, strict UTF-8 decoding and literal text rendering. Embedded Markdown links and examples are inert. Read, Start, End, Retry and Back use the existing authoring input owner. Reader Back returns to Read; modal Back restores the exact source link. Generations, abort signals and foreground/lifecycle checks prevent stale publication. No shared router, Confirm lifecycle, historical document or sample JSON was changed.

Two real label defects were corrected during qualification: replacing a localized title's owned text node prevented subsequent locale updates; a Read accessible name created before source selection omitted the title on first open. Both producers are refreshed when opening a document and retain live locale updates.

## Automated evidence

- New viewer cohort: **31/31**, including all ten exact manifest pins, literal rendering, two-step Back, initial/reopened names, lifecycle/ownership, late fetch and digest, Retry, invalid bytes/UTF-8/hash/redirect, queued close and held Confirm protection.
- Viewer plus existing Guide/reference/input/domain/inventory: **68/68**.
- Final same-tree integration cohort including current field-kit-flow: **87/87**, zero skipped. These totals overlap; do not add them.
- ESLint, Prettier and diff checks pass for the changed source/tests. Full localization passes **11,830 messages / 8,813 references** across EN/UK.

## Current browser controller workflow

The final fresh `creatorGuideDocumentsCurrent` journey passes **3/3** at an observed 1280 × 720 runner with a 1248 × 547 iframe. It opens all ten exact sources (128,748 bytes total), verifies inert text, preserves the Guide URL/history and source links, and restores every opener. Representative first/largest documents reach **1,976px / 6,886px** through End, with directional reading separately exercised and Start returning to zero. This is not a claim that every line was read by directional steps.

Real UK/EN/UK choices update title, status, Read name and preserve original document bytes. The sampled one local-storage key (explicit locale) and zero session keys remain bounded to the expected contract. The initial language was Ukrainian after a prior failed attempt; the later native journey restores English.

Two earlier complete attempts ended at 2/3: the first had a fixture-only expectation that omitted localized number grouping; the second exposed the real first-open Read-name defect. The final fresh run passes after the fixture and production corrections. No production guard was weakened. Timed failure/cancellation is automated-host evidence, not fault-injected browser evidence.

Visible final result: `/tmp/creator-guide-documents-controller-20260930.json`, SHA-256 `230f065d65fa277b6e9213db5381ad5b25c1a35c41be2e1e4abf635cbb76a77c`.

## Native keyboard and actual downloads

CUA unindexed native keys, with no pointer focus reset, traverse all ten document readers at observed **390 × 844**. Each reaches End, returns Home and exits through both Back targets. Maximum observed scroll is **19,561px** for Delivery; no horizontal document overflow was observed. One early key sequence preceded Ready for the fifth document; after inspecting Ready, Tab resumes the reader without a pointer. Subsequent opens explicitly wait for Ready. This is a qualified journey with that timing correction, not an uninterrupted scripted first pass. UI labels were Ukrainian while document text retained its source language; the native language control then restored English.

Native observations are a compact transcription, not a raw interaction archive: `/tmp/creator-guide-documents-native-20260930.json`, SHA `e6c1a8d03059e3fc1c742363804f0f5a10d5183479c16c3a916946e20843f52d`. Screenshot `/tmp/creator-guide-documents-native-20260930.png`, SHA `fce1e091a5031384121d1e58d18768836e1272b1efa3278bb6940726b4be3810`.

Both static JSON anchors were reached and activated through native keyboard and separate terminal virtual-pad cases. Initial activation-only checks exposed no new OS files; actual files were captured on repeat with the browser download-event observer. We therefore separate activation evidence from download completion. No files were fabricated by fetching source, and no application import handler or file input was invoked programmatically.

Four actual browser downloads under the user's Downloads directory passed production validation:

| Input            | Native file                        | Virtual-pad file                   | Exact bytes |
| ---------------- | ---------------------------------- | ---------------------------------- | ----------- |
| Legacy expansion | `two-crossings.expansion (1).json` | `two-crossings.expansion (2).json` | 6,275 each  |
| Studio project   | `example-project.json`             | `example-project (1).json`         | 2,649 each  |

Expansion SHA is `701e53e5e1e344b5a4f4ff879f1a9a3530d6542e478ad13ebe77426636d23093`; Project SHA is `c1c51cd83ce3a20aa1d7030951442ac60de2aa33d523ea2586b7968531e10e5a`. Both expansions pass production install/import/export round-trip and four modeled documented Down routes each (two levels × two steering policies, tick 414, three lives). Both projects recompile, reopen canonically and resolve all six Solo/Versus difficulty manifests. These are artifact/domain checks, not controller-operated browser installation, persisted target-store recovery or physical gameplay.

Receipt `/tmp/creator-guide-documents-downloads-20260930.json` (42,642 bytes), SHA `151411d5af95c8f3a96775785e471c9f36508b7243bca20ad991787a5dd3c4b3`, pins 64 production sources/226 import edges. Five native-boundary sources are separately recorded. Its first scanner run rejected the computed platform bridge; the corrected scanner recognizes only the exact generated iOS bridge expression, proves that branch is not active in this Node validation and continues rejecting other computed imports. This does not claim native support.

## Package and acceptance boundaries

The package capture has **82 Git/disk-exact paths**, **56 resources / 30 modules / 93 edges**, no unresolved references. The actual collector contains **2,411 paths**, no fixtures. All **29 Guide files / 276,317 bytes**, including the two new modules (9,334 and 2,777 bytes), ten direct documents and two samples, are admitted under existing optional Workshop rules outside Solo/Versus/Team startup. This is source collection/classification, not a generated offline catalogue, materialized build or edition compile. Markdown destinations are not recursively admitted; linked navigation destinations are checked for admission without claiming their whole runtime graph.

Original capture `/tmp/creator-guide-documents-package-capture-20260930.json`, SHA `5b2474dab7fa831c5374139b3f65c4d0cd66256bd7f57e6692ed82ed661bc1c0`; original attribution SHA `ddf2d27df5aef56970bba3f2ef7f92c6d874a12d58d164dcfbbf2e0243dc3cd9`. Preserve original generated evidence and its source cutoff after rebasing.

The Guide remains read-only: no project Save, import, validation UI, approval or editable project export. Its two downloads are unchanged bundled examples. Physical controllers, native builds, installed offline, network faults in a browser, broader translated documentation and target-store sample installation remain open. Historical 14-edition compiles do not cover the current 18 editions.

Public repair #816 is served at HTTP source revision `451b82dc13` with the restored export. However, this session's IAB default route still displayed the old missing-export boot error after the game's Reload action; publisher was notified of that retained-client discrepancy. No cache, service-worker registration or saved progress was cleared. HTTP source presence is not this client's published browser acceptance.

## Delivery audit cutoff

The read-only 05:05:37–05:06:40 UTC scan found 268 registered worktrees, 266 existing, 54 source-dirty roots and 58 excluded dependency-only roots. 51 dirty status lists matched the preceding Radio scan; status equality is not byte equality. Clean exact-remote #817/#818/#819 and later clean Levels #820 are separately owned. Active Actor, Demo, Pause, Playlist, company/offline and Guide writes need their owners' final checkpoints. Historical UX/Team anomalies and screened recovery refs are preservation, not new runtime intake. Do not call the repository globally clean while these owners are still editing.

Audit `/tmp/local-delivery-owner-exceptions-20260930.json`, SHA `8fd6ecd673c7920bd1488a2a4889013a1a8a7a59f3f3a108cc1b6fd5e9d595a2`. Retain the timestamp and source receipt. No broad snapshots, private-media intake, other-owner Git mutations or historical deployment occurred. Releases remains the sole integrator/publisher; the follow-up requires a compatible milestone-57 intake and is not whole-plan acceptance.
