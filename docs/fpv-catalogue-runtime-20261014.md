# Exact catalogue runtime lifecycle audit — 14 October 2026

All **41 authored courses across 20 exact packs passed in both flight modes: 82 cases**. This bounded audit exercises the shipped production runtime and pinned Rapier collision engine, without player stores, recordings or browser data changes.

## Exercised behavior

For every course/mode:

- Construct the production flight: spawn must be clear of solid geometry, status disarmed, tick zero, full health and zero throttle.
- Supply held full-axis input while disarmed: the entire snapshot must remain unchanged.
- Explicitly arm, then apply one neutral simulation tick: the runtime must advance exactly once.
- Pause and apply held input: the entire paused snapshot must remain unchanged.
- Reset: the snapshot must exactly equal its initial disarmed state.

Both modes are independently constructed. Acro-only skills, if present, use the production unscored-practice policy for self-level rather than bypassing validation. This models the fresh-attempt boundary of mode changes; it does not execute a browser change event.

## Exact identity and launch semantics

The audit uses unchanged extracted cloud source `25d086cbd580de5dc5b745ce088af283434df5ae`, the same [package](fpv-home-art-package-20261014.md) and [20 native-rendered packs](fpv-catalogue-render-20261014.md). Pack sizes/digests and compiled course counts were rechecked. The [full receipt](fpv-catalogue-runtime-20261014.json) retains each course/mode outcome, source and audit-script hashes, Node version and pinned collision backend.

The packaged i18next UMD dependency exports CommonJS when loaded under Node. The harness assigned that actual shipped export to its expected browser global before importing production modules. No physics/runtime implementation was mocked or replaced. Initial import failed before that Node compatibility adapter was added; it was a harness environment issue, not a course failure.

Exact `world-app.mjs` source inspection preserves the distinction between three intents:

1. **Catalogue Play:** resolves the installed project and exact pack SHA, then launches with `paused: true`. Readiness alone does not arm it.
2. **Deliberate mission Fly:** requests a direct start. After scene preparation, the host routes through its existing Arm action only while the launch is current, unpaused, nonpreview/nonrecovery, focus is retained and no intervening pause occurred.
3. **Flight mode change:** starts a fresh attempt with `paused: true`, including checkpoint and replay branches.

These are source-audited host contracts, not all-course browser click tests. Actual representative catalogue-disarmed and deliberate mission-start observations remain in the [native corrected-package receipt](fpv-corrected-package-20261014.md).

## Limits and next checks

One neutral tick is not mission completion, collision traversal, a controller test or a sustained physics/performance test. This audit does not prove all gates, moving subjects or demonstrations can be completed. It adds lifecycle evidence to the existing static render and storage transaction receipts without replacing those scopes.

Next: representative native flight through collision geometry, and bounded renderer measurements that separate callback CPU time from animation-frame cadence. Neither requires destructive quota pressure or a browser-wide restart.
