# Active Solo modal-query audit — 2026-10-17

The real application in the minimal host performed 10 whole-document
`querySelectorAll('dialog[open]')` calls per active frame without a controller and
12 with an assigned neutral standard controller. Each 60-frame observation kept
gameplay running and reported no application errors. Six singular
`querySelector('dialog[open]')` calls per frame remain unchanged. These are call
counts, not native selector timing or device-performance results.

The change caches only an observed empty dialog set. Queued `open` attribute
records and inserted/removed dialog subtrees invalidate that result before the
next lookup. The existing stack, focus lookup, ambiguous pre-existing-dialog
fallback, and no-observer polling behavior remain in place. Disabled controller
tracing now returns before resolving its modal host. Controller scope itself is
not cached, so actions can change the scope immediately.

The observer design uses synchronous [queued mutation retrieval](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/takeRecords)
and [child-list/subtree observation](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/observe#removed_descendants_when_using_subtree).
The focused tests cover initial discovery, queued opens/closes, inserted open
dialogs and subtrees, removals, pre-existing opens, unsupported observers,
destruction, and explicit/default trace hosts. The complete modal-navigation and
controller-confirm-trace test files now gate the Appearance package.

## Validation and limits

- Focused modal/trace checks: **11/11 passed**. The new empty-result and disabled
  trace assertions each fail against the immutable pre-change helper modules.
- Appearance policy checks: **8/8 passed**. Scoped lint, formatting, and diff
  checks passed.
- Complete modal/controller regression selection: **306/307 passed**, no skips.
  `actual Solo Settings restores Game menu when responsive layout hides its
toolbar opener` timed out waiting for focus to move from the hidden Settings
  opener to Game menu. The same focused failure occurred with both pre-change
  helper modules loaded through a verified override. It is retained as an
  unresolved pre-existing focus-restoration failure, not waived as a passing
  test. This host has no mutation observer, so the empty-result cache is inactive.
- No native-browser timing, physical-device qualification, or timing-gate credit
  is claimed. Existing first-eight and historical raster failures remain retained.

## Retained local evidence

Files are under `.cache/solo-followup/`; reports are immutable observations.

| File                                   | SHA-256                                                            |
| -------------------------------------- | ------------------------------------------------------------------ |
| `dialog-query-audit-v1.json`           | `d8761bdad11f4ed91acf7baae4edd3234c98f0392b6d85e843bf0ee107414d79` |
| `modal-cache-regressions-v1.tap`       | `29c3c967518b64e5b932f1d14d445853e775e651711274b8ea52c116437ae7d1` |
| `modal-cache-focused-v1.tap`           | `5a022327eb9829786d8739962bf2ad65878302399d95ca5885e54484c1e05610` |
| `modal-cache-appearance-policy-v1.tap` | `b6edb3974f77dc5e15af4619336d900f512e981e2ff55a2d1b73bcf4c5626a67` |
| `modal-cache-settings-current-v1.tap`  | `f55a1779320023f61a2f6ff01268fe03d62b5cbbb0202437353f986075c57b18` |
| `modal-cache-settings-before-v1.tap`   | `66919bd1479ec03e45c690a475ca8e68e8ea9b97dbd5619bf89969fd6f4473c4` |
| `modal-cache-old-loader-proof.json`    | `7d3268d41d895050586a729b056641bdb506260c3be08e9c27d39f1b70c75af3` |
