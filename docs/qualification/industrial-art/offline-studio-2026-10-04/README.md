# Offline controls and Studio review — 4 October 2026

This continues the [implementation register](../../../unified-industrial-plan.md) and the [local recovery review](../local-recovery-2026-10-04/README.md). The source baseline is `5ee824303b4d7a6b3658295a3e7b035e1eef3595` in PR #1005. All CI checks for that prior head passed. Those results establish the baseline; they do not validate the changes described below. The next committed source identity, build receipts and browser evidence must be attached separately.

## Reproduced baseline

An isolated loopback server staged the existing Academy and Worlds production ZIPs without changing their pinned runtime, launcher or worker bytes. Runtime download requests were delayed by 100 ms per file to make cancellation observable. Both archives declared the baseline commit and tree `a4a45cf21ca4a2d1cac9f916173f266d9507917c`; every manifest file was checked for its pinned length and SHA-256 before staging.

| Package                  | Archive SHA-256                                                    | Runtime revision                                                   |
| ------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Academy / `civilian-fpv` | `0f7fbac007e43d24dae4c02f15e77199fcd129add78a44d894e17db6fdbc6245` | `61722901506d203b1ef4c7cdd74d37646f10641c71fb2937745c8be916e08994` |
| Worlds / `fpv-worlds`    | `54c70c18bb55496096ac3608503d9661540ff0d8e6adc7d695771a363320ab87` | `7404d34e4a9df4d11378aabe25a198f6c1aea60860c5038ec23cad047d734bd7` |

The Academy path was Settings → Expert options → Flight guide → Workshop & offline → Prepare. The progress panel appeared under `body`, outside the open native dialog's top layer. Hit-testing the visible Cancel position returned the dialog rather than the button. A large `z-index` could not make the underlying button interactive.

Worlds exposed runtime preparation and persistent-storage requests but no runtime removal action in its own pack-management surface. The separate launcher could remove runtime files, but users staying inside Worlds had no corresponding control.

The baseline browser page was closed and the isolated server and staging directory were removed after observation. These are local reproduction results, not a complete prepare/remove/reinstall qualification or public publication.

## Implementation

- **Shared download ownership:** `optional-practice/install-context.mjs` accepts an explicit `progressParent`, otherwise resolves the focused open dialog at the moment preparation starts. Default progress and Cancel belong to that dialog; a nonmodal launcher retains the body-level panel. The panel reports initial verification immediately, focuses a minimum 44 px Cancel button and releases its listeners when the operation ends. Closing its dialog aborts preparation. Cleanup restores the previous focus only when the operation still owns focus and the target remains usable. Custom `onProgress` callers retain their own UI and cancellation ownership.
- **Academy lifecycle:** the native host passes its actual document and invoking dialog, and aborts pending preparation when the host is disposed. This uses the existing installer and does not arm, resume or change flight physics.
- **Worlds offload:** the native pack-management surface gains localized runtime removal, progress and explanation. The shared controls binder serializes button intent and owns cancellation on page exit/disposal. It delegates to the existing scope-specific installer/remover; installed world packs and flight-record stores are not opened or deleted by this action.
- **Launcher repair:** EN/UK instructions explicitly require removing the damaged offline copy before downloading it again. An available-release check preserves a known repair condition instead of overwriting it with a generic available/error status. The removal action remains visible.
- **Review motion policy:** the industrial art review combines its local checkbox with shared Reduced effects and the system motion preference. It observes cross-tab and restored-page changes without writing preferences. A localized explanation identifies why motion remains reduced.
- **Studio specimen sizing:** actor previews use four separately pooled backing canvases for 16, 24, 32 and 112 px specimens. Their CSS and backing dimensions agree; cards wrap on narrow panels instead of shrinking the labeled specimens. Partial admission, owner replacement, collapse and disposal retain the existing lease and stale-result protections.

No gameplay rules, package identities, cache formats, installation receipt formats or package limits change. The decoded-artwork accounting remains narrower than whole-page/GPU memory measurement.

## Verification status

Relevant regressions were **authored but not run**, in accordance with the explicit automated-suite waiver:

- `game/test/optional-offline-lifecycle.test.mjs`: modal ownership, Cancel/focus cleanup, owner close, successful completion without focus theft, custom progress and closed-owner refusal.
- `game/test/optional-installation.test.mjs`: persistent repair instructions and removal visibility in EN/UK, with available and unavailable release metadata.
- `game/test/fpv-flight-ui.test.mjs`: native Academy modal ownership and disposal during verification.
- `game/test/fpv-offline-controls.test.mjs`: Worlds control serialization, runtime-only removal, unavailable workers, disposal, cancellation and retryable failure.
- `game/test/industrial-review-motion.test.mjs`: shared/system preferences, local restriction, cross-tab updates, restoration and subscription disposal.
- `game/test/asset-studio-actor-animation.test.mjs`: fixed-size wrapping specimens and their revised bounded canvas lifecycle.

Repository ESLint, formatting, native formatting, localization/content validation and generated-source checks passed. Explicit authoring and optional-practice formatting checks also passed. Independent source review found no confirmed blocker in the control, motion-policy and Studio specimen changes. Committed-source builds are recorded separately; no baseline CI result substitutes for the new head.

## Browser qualification

Observed in the Codex in-app browser at 830×1316 CSS px, EN, on isolated loopback port 8792. The [package receipt](package-builds.json) binds both double-builds to implementation commit `e74542650523e7d5d297aaf59abd813d8001fa32`, tree `bd7641b5102e2ca4df3adbb6168e6a35be2de833`. Committed input blobs, reproducibility, ZIP CRC/membership and production package admission passed. Frozen packages were served from memory because disk writes intermittently failed with ENOSPC. Runtime bytes were not patched; publication metadata URLs were local staging fixtures.

Initial Academy registration reported “Failed to access storage”; Studio initially reported “Internal error.” Neither counted as a pass. After storage became available, both runtime flows and the saved Studio workspace reopened normally. No site data or workspace was cleared or replaced. Review installations were removed through their own controls and temporary tabs closed. Flight engines remained disarmed/paused.

Studio used the existing saved `enemy.bouncer` image through Load current actor, without staging or saving a descriptor. At 320×740 CSS px its four canvases were exactly 48×144, 56×144, 64×144 and 144×144 in both backing and CSS pixels; inset artwork remains 16/24/32/112 px. All cards stayed within the 320 px page. Collapse zeroed all four backings; reopening and Check and preview restored their dimensions.

| Scenario                                     | Acceptance                                                                                                                        | Status / evidence                                                                                                                                                                                                                                                                |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Academy cold preparation inside Flight guide | Progress and Cancel share the active top layer; pointer and keyboard can cancel; controls become usable again                     | Observed: Enter cancelled; Cancel belonged to help-dialog, focused, 135.38×44 px, hit-test BUTTON. [After](industrial-academy-modal-after.png).                                                                                                                                  |
| Academy close during download, then reopen   | Closing the owning dialog cancels its operation; a fresh preparation succeeds without an obsolete receipt or stale panel          | Observed: Back to flight closed its owner; reopen showed Cancelled, then preparation reached ready.                                                                                                                                                                              |
| Academy prepare → remove → reinstall         | Normal UI reports ready only after verification; removal clears the owned runtime copy; reinstall verifies again                  | Observed: ready → removed → ready, then final cleanup removal. Network-disconnected startup remains pending.                                                                                                                                                                     |
| Worlds prepare → remove → reinstall          | Native controls remain reachable and serialized; installed worlds and flight records survive runtime removal                      | Observed: pointer Cancel, 140.99×44 px, ready → removed → ready and final removal. [Cancel](industrial-worlds-modal-after.png), [removed](industrial-worlds-offload-success.png). Populated record/world retention remains pending; the isolated origin had no imported content. |
| Damaged runtime / launcher repair            | Both locales keep repair instructions and Remove visible; removal followed by a fresh download recovers                           | Pending                                                                                                                                                                                                                                                                          |
| Retained tab after offload                   | Status/fetch does not recreate a removed cache; a read-only inspection cannot claim ready for missing bytes                       | Pending                                                                                                                                                                                                                                                                          |
| Industrial review reduced motion             | Shared and OS reductions apply with the local checkbox off; no settings are overwritten; restore catches missed changes           | Shared preference observed in the normal Snake settings UI: review notice updated across tabs; local On/Off did not relax it. Original Off restored. OS and missed-restore observation remain pending.                                                                           |
| Studio at narrow and enlarged-text widths    | Four specimen cards wrap without horizontal clipping or label-size shrinkage; collapse/reopen and owner replacement remain usable | Observed at 320 px: exact dimensions, no horizontal overflow, collapse to 0×0 and explicit preview reopen. [Image](industrial-studio-320.png). Enlarged text and owner replacement remain pending.                                                                               |

Physical phones, simultaneous touch/gamepads, audible sample quality, low-end frame rate, peak memory, completed mission routes and artistic approval remain separate qualification work. This continuation does not promote the art sample or campaigns to a public release.

[Shared Reduced effects notice](shared-reduced-effects.png) · [baseline covered Cancel](academy-modal-before.png). No disconnected-network simulation, populated-record retention, damaged-cache injection or OS preference change was performed.
