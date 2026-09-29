# Reveal Audit source-viewer input qualification

The first complete virtual-controller workflow passes **3/3**, and the final
native keyboard repeat passes at
`7b4a9f2e89bc209be9df9ff7fa2e1d0c7402570a`. This receipt qualifies the new in-app
PNG, Markdown and JSON viewer on `localhost:8997`. It supplements the earlier
[historical-audit reader receipt](reveal-audit-input-2026-09-29.md); that earlier
receipt retains its original source and browser-handoff limitations.

This work extends follow-up PR #808 on `codex/reveal-audit-input`. It does not
advance the coordinator-frozen PR #782 or establish a public release.

## Product contract

The original-source actions now open an owned modal in the existing review
document. Its finite manifest contains **23 pinned entries**: 21 historical PNGs,
the audit Markdown and its JSON records. It is not an arbitrary URL or local-file
browser. PNG loads use bounded byte/hash/dimension checks and full browser image
decoding. Text loads use bounded reads, exact pinned bytes and SHA-256, then strict
UTF-8 decoding into inert `pre` text. Markdown is shown as source text, not
rendered HTML; JSON is not imported or applied as a project.

PNG Fit contains the full image on both axes. Actual size exposes the native
pixels in a bounded two-axis pan region. Text wraps within its region, with Read
and explicit Start/End controls. Back or Confirm ends reading and restores Read;
another Back closes the modal and restores the exact source link. The existing
shared owner and Confirm lifecycle retain device ownership. No second pad poller,
synthetic input or application-handler shortcut was added.

Always-available modal Back can close a pending request. Retry is an explicit
action. Async responses cannot publish after the view is canceled, replaced or
retired by its lifecycle. There is no project Save, editing, import, approval or
export, and there are no OS download artifacts to validate for this product.

## Automated verification

The final overlapping focused cohort passes **124/124**, including **29 viewer
cases**, six metadata-drift cases and the production source-loading helper tests.
The cohort also exercises the existing audit, Atlas and shared input behavior.
The final command used Node **v20.19.5**, with zero failures or skipped cases and
stdout-only output:

```sh
node --test --test-reporter=dot game/test/reveal-audit-viewer.test.mjs game/test/reveal-audit-host.test.mjs game/test/authoring-reference.test.mjs game/test/authoring-input.test.mjs game/test/design-atlas-host.test.mjs scripts/test-production-panel.mjs
```

These modeled tests cover cancellation, errors, byte limits, altered metadata,
stale completions, cleanup and input ownership. They are not real-browser layout,
network-fault or image-pixel evidence. The separately repeated inventory check is
passes **2/2** and is not added to this total; the independent viewer-only 29-case
review and earlier 114/123-case cohorts also overlap and are not summed.
Full EN/UK localization passes **10,924 messages / 8,587 references**.

```sh
node --test --test-reporter=spec game/test/native-menu-inventory.test.mjs
```

The new test-only entry and registration pass scoped ESLint, Prettier, syntax and
diff checks. Their files stay outside the player distribution.

## Virtual-controller workflow

The entry is
`game/test/manual/authoring-controller.html?tool=revealAuditSourcesCurrent`, using
`reveal-audit-source-current-workflow.mjs`. Every application action uses the real
shared standard-pad path. DOM, decoded-image, Blob and source-file reads are
observers; the fixture does not call application handlers, force focus, synthesize
keys, inject network failures or write application storage. This short workflow
does not repeat the earlier long raster/procedural review journey.

The first fresh run on the committed runtime passes all three stages, with a
**1280 × 720** outer runner and **1248 × 547** inner frame. There was no failed
current-viewer fixture attempt before this pass:

| Stage    | Exact content and observed behavior                                                                                                                                                                                                                                                                                                                                                                                        |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PNG      | The first original's displayed Blob is exactly **3,172,117 bytes**, SHA-256 `e748ccee83cdb51fb9d385c626d6824d37eeef254f1684e27e54b12e42b35823`. Browser decoding completes at **1774 × 887**. Actual size renders those dimensions; both pan axes reach their ends and return to zero. Fit contains the same decoded image, without replacing its Blob. Back and explicit modal Close restore the original source control. |
| Markdown | The displayed inert text exactly equals the **31,687-byte / 312-line** authoritative UTF-8 source, SHA-256 `0fcc973c82f2c2d1fda02835cd4735595eb6aaef7b5de0da0e8500af9ccf0bd8`. Read Down/Up, Start/End, Back/Confirm, close and reopen preserve exact content and reset the reading position.                                                                                                                              |
| JSON     | The displayed inert text exactly equals the **75,088-byte / 1,990-line** source, SHA-256 `f0952cdfaae60d8bed364a9cf2293aa036fe802a9551b55743e863712ff09eda`. Parsed observational identity remains 56 owners, 21 rasters and 17 procedural entries. The same reader, edge controls, return and reopen checks pass.                                                                                                         |

Measured geometry:

| Surface         | Viewable region                       | Maximum / reached end                  | Returned start      |
| --------------- | ------------------------------------- | -------------------------------------- | ------------------- |
| Actual-size PNG | **1038 × 328 px**                     | X **736 / 736 px**, Y **559 / 559 px** | X0 / Y0             |
| Fitted PNG      | Image **652.390625 × 326.1953125 px** | Complete image fits the region         | Both axes contained |
| Markdown text   | Wrapped; X overflow **0**             | Y **13,440 / 13,440 px**               | 0                   |
| JSON text       | Wrapped; X overflow **0**             | Y **52,726 / 52,726 px**               | 0                   |

Text endpoints were reached using the product's accessible Start and End controls,
with four directional reader pulses per text stage. This proves those controls
reach the complete displayed source and that directional reading works; it does
not claim a manual read of every intervening line or thousands of D-pad steps.

The first PNG close observed **`ready`** before Back. Therefore it is a ready-view
close/reopen result, **not a controlled pending-network cancellation**. No real
error or missing-source fault was forced. Those cases remain modeled-test claims.

The same parent document, URL, history length, all **38 review articles** and
their disclosure states remained unchanged throughout. The observed **zero local
keys / zero session keys** remained unchanged. No download anchor was activated.
Prepared image Blob URLs are viewing resources, not exported files.

The exact visible controller result is saved as
`/private/tmp/reveal-source-viewer-controller-20260929.json`, SHA-256
`35c4861e4d704766150c96a8a3ce711dbf618a23aa16d992d9a62cca76b46d32`.
The parent's compact observation transcription is
`/private/tmp/reveal-source-viewer-browser-summary-20260929.json`; it embeds that
result and the native observations but is not a raw interaction archive. A final
PNG-view screenshot is `/private/tmp/reveal-source-viewer-final-20260929.png`.

## Native keyboard repeat

The parent reloaded the final committed source and used unbound native keys at
**1280 × 720**, without a pointer or accessibility-focus reset:

- Markdown reading reached **13,336 / 13,336 px** with End; Home restored zero.
  First Back restored Read, and second Back restored the exact Markdown link.
- JSON reading reached **52,622 / 52,622 px** with End; Home restored zero. The
  same two-step Back ownership and exact original link restoration passed.
- PNG Fit had zero overflow. Actual-size End reached X **736 / 736 px** and
  Y **455 / 455 px**; Home restored both axes to zero. Reader Back restored Read,
  Fit returned to zero overflow, and modal Back restored the exact PNG opener.
  A final screenshot repeat reopened that PNG; Escape again restored its exact
  original source control.

Different native and virtual heights produce different scroll maxima; those
measurements are separately attributed. Browser Retry and live locale changes
inside this new viewer were not exercised in this sequence; their modeled tests
are not promoted to browser acceptance. Earlier audit-page Retry/locale results
do not implicitly qualify the new modal.

After observation, the parent closed only the two owned browser tabs and stopped
the isolated `8997` server with Ctrl-C (expected exit 130). No viewport override
or export remained.

## Package and historical-source preservation

The final source closure at `7b4a9f2e` covers **65 resources / 41 modules / 109
edges**: 69 module imports, 26 HTML resources, one data-module, three literal URLs,
nine CSS references and one explicit audit fetch. It captures **70 source pins**.

The official default collector grows from **1,838 to 1,840 paths**, with **zero
test fixtures**. The two new modules total **20,896 raw bytes** and are admitted by
the existing Atlas folder inclusion. The build configuration and original-art
admission are unchanged. The existing production preview/model dependencies
were already included.

All audit tool files remain optional in the actual Solo, Versus and Team selectors,
and no audit path leaks into the **574-file** standalone company engine. The same
nine historical PNGs already included for other features remain optional; twelve
remain source-only. All **23 source descriptors** match their exact files. All
21 PNG byte/hash/IHDR pins and the immutable historical inputs remain unchanged.
That complete file-pin check is distinct from this browser's full decode of the
first PNG only.

Only the generated locale catalog changed among the preceding **835 edition
inputs / six compiler pins**. Fresh **14/14 sequential in-memory edition compiles**
pass using normal validation and final size guards. The largest DroneAid output
is **66,787,530 bytes**, leaving **321,334 bytes** below 64MiB.

The union of 70 source, 26 historical, 835 edition and six compiler rows contains
**888 unique paths**, all matching the committed Git blobs and disk bytes without
drift. Receipts:

- `/private/tmp/reveal-source-viewer-source-closure-final-20260929.json`
- `/private/tmp/reveal-source-viewer-package-boundary-final-20260929.json`
- `/private/tmp/reveal-source-viewer-original-recheck-final-20260929.json`
- `/private/tmp/reveal-source-viewer-compiler-capture-final-20260929.json`
- `/private/tmp/reveal-source-viewer-edition-package-final-20260929-full.json`
- `/private/tmp/reveal-source-viewer-final-attribution-20260929.json`, SHA-256
  `69b4ca040f4ab57bba1eb713b772c5b00e7f4a705ba58fb16ac9759ba240a6e5`

This batch does not claim browser traversal or full decoding of all 21 PNGs,
controlled real-network cancellation/error, complete Ukrainian viewer traversal,
200% zoom, forced-colors rendering, physical controllers, native webviews/devices,
installed-offline behavior or public deployment. No materialized release package
was produced by these checks, and the historical source records were not rewritten.
