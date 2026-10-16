# Default runtime capacity repair

Committed production preparation for `0854912633e7c6a6e49741cdb2f8abae675178ef`, candidate `v0.150.0`, reported **1,349 core files / 67,182,475 bytes**. This exceeds the unchanged **67,108,864-byte** limit by **73,611 bytes**.

The original repair measured 279,653 bytes saved across twenty additional distribution hosts. Its approximate core-margin estimate was incorrect because seven of those hosts were outside the default core. The earlier mutable-source finding of 67,327,209 bytes and its estimated 61 KB margin are superseded by the exact committed failure above.

The revised explicit allowlist contains **83 core-reachable runtime modules**: fourteen previously selected core modules, including `game/app.mjs`, plus **69 additional UI, presentation and media/storage modules**. Seven non-core hosts were removed: the Couch launcher, relay-rescue host, cooperative view, installed-chapter host, Studio host, still-media panel and still-story panel. No gameplay implementation, recipe, byte-pinned artwork catalogue or package limit changed.

Selection uses the production `selectOfflineCore` graph over collected build paths, retaining actual JavaScript, HTML and CSS bytes while omitting JSON/binary leaf content and applying optional-package exclusions. This is a conservative reachability check: omitted leaf edges can hide candidates but cannot manufacture an import path. The graph proves each added module is retained before its saving is counted. The receipt records each module, its source hash, size reduction and retaining owner.

Direct invocation of the production projection on all selected modules measured **281,852 additional core bytes saved** against the failed committed baseline. The resulting estimate is **66,900,623 bytes**, leaving **208,241 bytes** below the core cap. The exact final inventory still requires committed-source production preparation; these figures do not claim that the final build passed. Full per-file evidence is in [default-ui-host-capacity.json](default-ui-host-capacity.json).

The existing Company whitespace projector verifies the complete AST, exact lexical tokens, exact comments and every line terminator before accepting an emitted copy. Source-mapped modules remain byte-exact. Canonical repository files, artwork metadata, gameplay recipes and historical records retain their original bytes. This change affects only explicitly named distribution copies.

Scoped ESLint, Prettier and whitespace checks passed. The expanded regression source checks the explicit module boundary, unchanged canonical input buffers, unchanged gameplay/artwork/unreviewed/non-core modules, multilingual literals, comments, automatic semicolon insertion, line endings and source-map exclusions. It was authored but **not run**, preserving the automated-suite waiver. Direct production projection executed its mandatory syntax/token/comment/newline guards on all 83 actual modules.

Company already applies the same projector to its engine closure, so its separate capacity blocker is not resolved by this change. Optional-package limits and public-release qualification remain independent.
