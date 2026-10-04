# Verified optional-worker source preparation

The optional-package worker now keeps its readable canonical source in
`optional-practice/worker-source.mjs`. The existing lexical projection prepares
the admitted `worker-template.mjs` after pinned Prettier formatting. Only spaces
and tabs outside lexical content change. No network requests, cache rules,
permissions, file ceilings or byte ceilings change.

This is an independent capacity prerequisite based on accepted main
`ade4bfc2dd2934668889bf622e87a48cf1b52c03`. The separate Library draft is not included.
Its initial source browser passes and failed application-fetch admission do not
qualify a worker-based download transport.

The template shrinks from **6,528 to 4,812 bytes**, recovering **1,716 bytes**.
The readable canonical file is byte-identical to the previous template. Independent
Acorn comparison preserves the entire normalized AST, all 1,360 tokens, all three
comments and all 179 line terminators. Four applicable existing lexical-projection
and worker-scope checks pass. Scoped lint and generator `--check` pass.
Full validation, source-bound two-build admission and actual admitted behavior
remain pending.

The 95 original Worlds input paths and 102 admitted member count are unchanged
by this preparation. The generated worker content and package revision will change
because the serialized function contains less whitespace. Licenses, physics,
recordings and application modules retain their bytes.

Edit the readable source, then run:

```sh
node scripts/refresh-optional-worker.mjs
node scripts/refresh-optional-worker.mjs --check
node scripts/qualify-fpv-worker-capacity.mjs
```

The generator check is included in `npm run validate`. The manual identity
qualifier intentionally binds this preparation to its historical baseline; a later
worker behavior change needs its own qualification and must not relabel this receipt.
