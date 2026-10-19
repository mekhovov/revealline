# Shared appearance controls and SIM package capacity — 19 October 2026

The generated flight shell contained an embedded copy of
`game/ui/enemy-appearance-controls.mjs` even though the canonical module and its
three dependencies were already admitted by all three optional-practice
packages. The projection generator now imports that existing module instead.
The normal regeneration produces the committed shell byte for byte.

This removes **7,416 bytes** from `flight-fullscreen.mjs` (298,948 → 291,532)
without raising a limit, changing admission, removing content, compressing
source text or modifying physics. Each control still owns its state,
subscriptions, asynchronous generation and disposal. Sharing the module's
single element-ID sequence also prevents duplicate accessible IDs when the
projected settings controls and standalone SIM controls are both mounted.

Isolated commit `ea0b1f31522f0ea91f4bfdf56fc385f2d157a4bd` passes **70/70**
focused checks, independent source review, scoped lint/formatting and generator
reproducibility checks. The two new regressions fail against its parent. They
check both consumers together, independent selection/disposal, EN/UK labels,
unique IDs and descriptions, canonical direct imports and all three package
plus native import closures. The new test is registered in `practice:test`.

Comparing every original-input hash/size against the clean `7d92d2fd10` baseline
and replacing only the generated shell gives these exact input totals:

| Package | Original input bytes | Academy input headroom |
| --- | ---: | ---: |
| Civilian Flight | 4,949,349 | — |
| Academy | 13,295,025 | 8,783 |
| World | 19,785,268 | — |

These are the isolated extraction totals, **before** the 2,966-byte course
provenance prerequisite, 23-byte workbench lifecycle fix and upcoming reference
consumer integration. The final combined source still requires exact runtime,
source, bundled/offline and native package qualification. No new runtime module
or package file slot is added by this extraction.

Evidence: `/private/tmp/fpv-shared-appearance-after.tap` (SHA-256
`ed8d93a8196a9626138577291f9da0dc8d1612f5aecd5c8d9ec8e350d93b7b1f`),
the retained failing `/private/tmp/fpv-shared-appearance-before.tap`, and
`/private/tmp/fpv-shared-appearance-input-capacity.json`.

This closes the capacity design investigation. Combined qualification and
release remain in the [current completion plan](fpv-current-completion-plan.md).
