# Test-DOM first-match candidate — qualified scoped proposal

This separate test-infrastructure proposal does not block or broaden v0.70. It
changes one helper, adds six semantic tests and updates the maintenance doc/prompt.
No shipped runtime, gameplay or browser behavior changes.

Scoped checks: six semantic cases pass on Node20.19.5 and Node22.22.2;
114 unchanged affected tests pass in one complete run on each runtime. The first
Node20 run had 23 absolute-URL virtual-loader setup failures, with 91 passes;
a corrected loader gives 114/114. Preserve that failed setup separately.
Lint, format and exact postimage/syntax validation are required. The actual
unchanged ten-clear/Next scenario on the final helper passes: one selected case,
ten deliberate filtered skips. It completed in 457,013ms; whole process 475,890ms.

Synthetic timings measure only repeated lookups in a 520-node test DOM and are
not browser, renderer or full-gate measurements. Concurrent workloads differ
between long host runs; do not present their elapsed time as controlled evidence.

Reproduction from repository root:

```sh
node .cache/p18-dom-lookup-b25-r3/verify-source.mjs
node --experimental-loader ./.cache/p18-dom-lookup-b25-r3/loader.mjs --test .cache/p18-dom-lookup-b25-r3/suite.test.mjs
node --experimental-loader ./.cache/p18-dom-lookup-b25-r3/loader.mjs --test .cache/p18-dom-lookup-b25-r3/existing.test.mjs
```

Full integrated source gates and release acceptance remain the coordinator's
responsibility. No physical-device or public-performance claim is made here.

To reproduce the composed ten-clear scenario, retain the separately sealed
`.cache/p03-journey-menu-return-b25-r3` packet with patch SHA-256
`8659be8d337c8040b77fe6857acccf46411bdde1753caf7ed865041cc5881013`:

```sh
node --experimental-loader ./.cache/p18-dom-lookup-b25-r3/continuation-loader.mjs --test --test-name-pattern='ten consecutive' .cache/p18-dom-lookup-b25-r3/continuation.test.mjs
```

The reproduction composes that exact runtime with this packet's exact helper.
Its gameplay test file and assertions are unchanged from the pinned base.
The separate caption proposal is not part of this particular performance check.
