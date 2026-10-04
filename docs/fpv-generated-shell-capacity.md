# Generated shell source capacity

The generated shared-mode-shell section of `flight-fullscreen.mjs` now uses the
existing verified lexical projection after pinned Prettier formatting. The
readable canonical `game/ui/mode-play-shell.mjs` is unchanged. This recovers
3,562 source bytes without changing licenses, assets, proofs, package limits or
file counts. It provides room for the separate optional-world Library draft;
that feature is not part of this change.

**Current checkpoint:** source `761fa13aa7c8a4601fd4c1368b375544722ed4fb` normally
integrates main `0a587fb2ea2ed7dbb15f2f0b8b74cabb0fef2ae6`, including the published
course picker and exact imported-world example lookup. Source identity and scoped
checks pass. Full validation, all-three package admission and actual admitted
player shell verification remain pending; this document does not claim a release
or live deployment.

The [manual identity receipt](evidence/fpv-generated-shell-source-capacity.json)
compares all 95 original World source inputs with that exact main commit. Only
`flight-fullscreen.mjs` changes, from 26,481 to 22,919 bytes (SHA-256
`ed48db6bde6cc14aae093301df945769bb82c3e50af80f07420474ef7946a01e`).
The original input total is 16,768,626 bytes, leaving **8,590 bytes** beneath the
unchanged 16-MiB ceiling. Applying the independent 6,684-byte discovery draft
would leave 1,906 bytes; that is a projection, not an admission result.

The generated section alone changes from 16,954 to 13,392 bytes. Its surrounding
fullscreen code, shared CSS, canonical shell SHA
`751be3729b5a702525d629844eb59661673e9bc2a27b5589df7047ea9badab1d`,
and policy bytes are exact. The **whole module's** normalized syntax tree, 5,259
tokens, 22 comments and 733 line terminators remain identical. The projection is
idempotent and reproduces the checked-in generated section. No recording or
physics input changes.

Existing shell, fullscreen and lexical-projection tests pass **38/38**. Scoped
ESLint, syntax, generator `--check` and whitespace checks also pass. No new unit
coverage was added. These checks establish source equivalence, not hardware
performance or an observed browser pass.

Reproduce the source audit without building a package:

```sh
node scripts/refresh-fpv-play-shell.mjs --check
node scripts/qualify-fpv-shell-source-capacity.mjs \
  0a587fb2ea2ed7dbb15f2f0b8b74cabb0fef2ae6 \
  authoring/fpv-worlds/course-editor/evidence/source-inventory-optional-fpv-worlds.json \
  /tmp/fpv-shell-new-receipt.json
node --test game/test/mode-play-shell.test.mjs game/test/fullscreen.test.mjs \
  scripts/test-edition-code-indentation.mjs
```

The retained inventory supplies only the known input paths; the audit rebinds
every original input to the named baseline Git commit. It does not relabel an
older admitted package as current main.
