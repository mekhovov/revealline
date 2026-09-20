# Chapters in Couch Versus

This P06 feature lets both players download and play compatible optional chapters from the Versus lobby, paused race or results. Choose **Chapters**, filter the shared browser, then **Download & play** or **Play**. The first compatible mission starts when both boards have the same verified picture. A paused race asks **Stay** or **Replace & play** before replacing its attempt and series. Ready boards and completed results do not need a second Start action.

Race setup still selects among shipped and checked installed missions. This is a bounded integration of the existing embedded optional catalogue and installed packs, not completion of the community → campaign → missions browser. External-original download cards, integrated shipped-content discovery, campaign order and offline campaign readiness remain later P06 work. Installed external chapters retain their existing authenticated read path; this feature does not grant a new external download authority. Team's browser is separate unfinished work.

## Retaining the current race

The visible attempt, both picture objects, checkpoints, results and series score remain authoritative while download and picture preparation run. **Cancel**, **Back**, **Stay**, a newer navigation action, or loss of foreground authority cannot start the prepared race. A download that already committed remains installed and is available on the next deliberate Play; cancellation does not claim to undo durable installation.

Leaving the foreground releases the pending operation's controls and status immediately, even if an image decoder has not settled. The browser remains open, and no focus is reclaimed. A stale completion cannot replace those controls or the retained race. Idle lifecycle cancellation must not invalidate unrelated accepted work.

Back returns to the actual Chapters opener. If a close callback already opened a newer screen or moved focus, that newer destination owns focus. Abandoning Play by moving focus produces a terminal cancellation message, not an apparently completed “Preparing…” status.

A touch activation may leave focus on Back. Capture the attempt first and, when Play is not focused, let the open catalogue receive initial focus with checks before and after the focus callback. Play is already disabled during preparation, so attempting to focus that disabled button is insufficient. The nested decision then returns to the catalogue, and Stay can re-enable and focus the exact Play action. This follows the browser's [dialog focus restoration contract](https://html.spec.whatwg.org/multipage/interactive-elements.html#close-the-dialog); actual browser and physical-device observations remain required.

## Ownership and installation

`game/couch/couch-catalogue.mjs` composes the existing optional-chapters panel. It captures the race, attempt generation, recipe, series, pictures, shell scope and activation before any download. Focus and lifecycle changes retire that activation. The host in `couch.mjs` owns preparation and adoption; the catalogue cannot directly rewrite a match.

`game/couch/couch-chapter-install.mjs` acquires the existing exact-channel profile writer lease only for an installation. It inspects through that same writable host, prepares and commits its own mutation, then releases the lease after work settles. Read-only library inspection uses an independent owner. Host-branded snapshots are never transferred between these owners. Already installed identical content is reused without downloading; a conflicting pack with the same ID is refused visibly. Capacity, byte authentication, decoder limits and lock contention remain enforced by the existing contracts.

Preparation uses a new `createCouchInstalledChapters` reader. Its `expectedPack` guard verifies the complete selected installed object, not only its ID. Refreshing this candidate cannot clear the current reader's accepted image. Confirm the selected picture and commit the entire new round, recipe, backdrop and series state before retiring old media owners. Revalidate accepted ownership after cleanup or DOM callbacks, close the catalogue, and consume the start authority once. The authored theme for the selected pack is used; complete global-theme retention is not implemented here.

Only explicit installation may write the installed-pack store. Solo saves, progress, earned originals and settings are not modified. Opening, filtering, cancellation and navigation are read-only. Shared-panel defaults preserve Solo copy and navigation; Versus supplies its own heading, Back label and “race” terminology and omits the unsupported Manage destination.

If the browser denies storage access while the catalogue is constructed, show Chapters as unavailable with the failure reason and keep shipped maps playable. Optional installation cannot become a new requirement for starting the existing game.

## Qualification

Run the installer, shared-panel, mounted Couch catalogue, catalogue reentry and existing installed-picture/continuation tests on the final source. Hold actual authenticated chapter bytes and image decoding to exercise failed downloads, late commits, foreground loss, navigation, Stay, results and one-action start. Check object identity, checkpoints, pictures, scores and storage writes, not only captions. The finite DOM, input, IndexedDB, Locks and image boundaries are modeled evidence.

Before release, inspect the actual browser at desktop, 1280×800, portrait and short-landscape sizes, including Large/Plain text. Exercise keyboard and modeled controller Back/Confirm, two-player pause, replacement, cancellation, exact opener return, and the same decoded picture on both boards. Verify shared palettes and 44-pixel controls in the replacement dialog. Record physical touch/controller checks separately. Complete the source gates, production build and published URL/source/byte verification through the existing release owner. Source tests alone do not accept P06 or a public release.

## Maintenance prompt

> Extend Chapters inside Couch Versus using the existing shared panel, installer and staged reader. Capture the exact activation and current race before asynchronous work. Keep the current pictures, checkpoints, results and series until the candidate is fully verified. Use the real profile writer lease for installation and never transfer a branded snapshot between hosts. Prove one Download & play action, identical installed reuse without network, conflicting-ID refusal, writer contention, committed-install cancellation, held decoder cancellation, paused Stay/Replace, results preservation, focus reentry and no Solo save/progress writes. Retain immediate status and 44-pixel controls, shared appearance and explicit input ownership. Report modeled, browser, physical-device and public-release evidence separately, and keep the remaining full-catalogue scope explicit.
