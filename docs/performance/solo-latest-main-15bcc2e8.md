# Latest-main integration and release checks — 17 October

Merge `32abd322afd8243e4537ce4784e2f78ee45ecbec` incorporates freshly fetched
main `15bcc2e8532156dcea63fccb509e1091352ce677`. Its tree is
`8c6910b2dfb366c494f9baa6c09b526aef2501a3`. Published source and artifact
identities remain unchanged; the separate FPV checkout is untouched.

This merge changes no Solo application, UI, core, content or presentation file.
The shared build helper gains a Main Pages-only canonical locale projection;
ordinary complete releases return before that projection and retain every
original. Optional FPV changes receive their own complete regressions rather
than being counted as part of the unchanged 105-file Appearance gate.

On the clean frozen merge, full lint passes in 15.114 seconds and complete
content/localization/generated validation passes in 151.210 seconds. Each
command has a 300-second deadline and 4 MiB output limit. Full formatting fails
in 26.058 seconds on the same nine files, all byte-identical to the newly
integrated main. The worktree and source remain clean and unchanged throughout;
the failed formatting result is retained.

The six complete changed FPV test files pass **161/161**, with no failure, skip
or cancellation, in 27.647 seconds under a separate 300-second/4 MiB bound.
Five complete shared tests pass **40/40**: offline finalization, Appearance
policy, source identity, optional/core tools boundaries and Snake evidence.
These verify preservation of ordinary release bytes and the specific merged
boundaries. They do not qualify browser timing.

The only changed helper in the prospective Retry/Next frozen tool lists is
`scripts/game-cli.mjs` (94,310 bytes, SHA-256
`384c26bde0dc3e300f651e7a43c9d5f6d3c70eb28e0e07763f7cb51d94929cb5`).
Only those two new declarations are refreshed. Historical declarations,
actual adb/8b package identities and browser rows remain fixed. The current
offline and Cocoa direct inputs are unchanged; their exact observer source
still records the inherited helper. No old package is rebuilt or relabeled.

The next push includes the final startup and resource-accounting runtime,
the reviewed intermediate adb correctness/Retry/Next/offline observations,
and one bounded macOS codec control. Native results are still pending. The
new 105-file producer must yield its own successful exact-source package
before final-runtime qualification can begin. Physical iPhone 17 Pro Safari
and Steam Deck OLED qualification remains separate.

## Retained checks

Full checks are in
`.cache/solo-followup/bounded-final-checks-20261017T060350Z-32abd322/`.
The 10,756-byte `receipt.json` has SHA-256
`7d0fd1b03ce75fa46f9e2a7dae99e57d4f1e8d7f420e96e308eed405acf27f77`.
It retains exact source, every command, all logs and all nine main comparisons.

Merge regressions are in `.cache/solo-followup/main-15bcc-review/`:

| File                                |  Bytes | SHA-256                                                            |
| ----------------------------------- | -----: | ------------------------------------------------------------------ |
| `fpv-changed-complete.tap`          | 39,558 | `584969966fa38e8bc25564144c6bc52f311978562204c9bb6cd28cf7d61b0d37` |
| `fpv-changed-complete.receipt.json` |    789 | `f2067cafc47d92de5c1549cc1ffc3a7af99e1ac014850e8380cb3a9d76e0a1f6` |
| `shared-controls.tap`               |  9,300 | `ed0a68fb8511ff9747ab4739757b08fc69bd38c901be61ee0ef702dc4b32c427` |
| `review-receipt.json`               |  3,070 | `596436b9abef1ada71ff9916ee03b39d1d6618bcdf596eb564624bcf1130a0fc` |
