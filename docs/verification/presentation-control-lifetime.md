# Presentation control lifetime candidate

Prepared from main `0684ddbfe978e95f2b6ddcd02b4f9e0f70a4190d` on the isolated `codex/presentation-control-lifetime` branch. This is a source candidate for later integration; it does not advance P18 or change the accepted public release.

The presentation host previously kept every decorated control in an append-only cleanup array until the application ended. A removed control therefore kept its presentation attributes and remained referenced by that application. Repeated dynamic UI replacement could accumulate detached controls. This concrete ownership problem has not been connected to the separate roughly 21-hour Archive12 renderer RSS observation; no browser memory, garbage-collection or performance claim follows from these tests.

`game/presentation/host.mjs` now owns attributes in a per-control map. On a child-removal notification it visits only removed element subtrees, restores values that are still its own, and deletes those controls' ownership entries. It checks final containment before release: moves and removal/reinsertion within the application keep their existing lease, including another screen's later attribute changes. While an attribute is still owned, a changed control role or later matching selector updates its decoration while preserving the first restore value. A later reattachment after actual release receives a fresh baseline. Each removal record is considered, including a descendant moved out of an already removed subtree before observer delivery. Ordinary HUD leaf removal does not scan the page or all owned controls.

Application cleanup uses the same release path, disconnects observation and is idempotent. A successful snapshot replacement clears the old application before a new application is decorated; an old cleanup or observer callback cannot reclaim its former controls. Existing handlers, checkbox state, source assets, schemas and runtime versions remain unchanged.

## Focused verification

Node 22.22.2, serialized execution:

```sh
node --test --test-concurrency=1 game/test/presentation-ui.test.mjs game/test/presentation-page.test.mjs
node --test --test-concurrency=1 --test-name-pattern='CSS cleanup|failed replacement' game/test/presentation-host.test.mjs
node node_modules/eslint/bin/eslint.js game/presentation/host.mjs game/test/presentation-ui.test.mjs --max-warnings 0
node node_modules/prettier/bin/prettier.cjs --check game/presentation/host.mjs game/test/presentation-ui.test.mjs
```

The initial regression run against the unchanged host passed the existing case and failed all five new lifecycle cases. The corrected final UI/page run passes 14/14; the two selected existing host cleanup/replacement cases pass 2/2. Scoped lint, formatting and diff checks pass. The final tests additionally check two decorated attributes on one removed input and a stale callback after application replacement. Independent review caught an overbroad skip in the first candidate: it also prevented owned role changes. Two further regressions fail that candidate (6 passed, 2 failed) and pass the correction: repeated Play/Retry and checkbox/switch moves, external changes, overlapping Retry/Close selectors, and restoration of the original baseline.

The assertions inspect restored/preserved DOM attributes before disposal, fresh attachment baselines, native control state, and later cleanup behavior. They do not inspect private map counts or depend on nondeterministic garbage collection. The existing mock MutationObserver receives explicit DOM mutation records; native observer scheduling and long-idle browser memory remain unmeasured. Full source gates, builds, browser journeys and release actions were not run.

The accompanying [original verification record](presentation-control-lifetime/evidence.json) retains the baseline failures and passing focused outputs as exact UTF-8 log bodies with byte lengths and SHA-256 hashes. Initial baseline and later strengthened test snapshots are identified separately; earlier output is not relabeled as a run of the final test file.

## Maintenance prompt

> Maintain presentation ownership in `game/presentation/host.mjs` when menus replace or move controls. Restore only attributes whose current value is still owned, retain the first original value through owned role changes, and release detached controls after the actual removal batch. Preserve live moves, reinsertion, external attribute changes, handlers and input state. Avoid rescanning all live controls on ordinary HUD updates. Extend the existing observable lifecycle regressions and retain a failing baseline plus exact final source/log pins. Do not infer browser memory improvement from mocked observer tests. Keep this source candidate separate from release acceptance and qualify the eventual composed source through the normal release gates.

The removal-batch cases follow the [DOM Standard's mutation observer behavior](https://dom.spec.whatwg.org/#mutation-observers): descendant mutations can still be delivered after a subtree is removed. The final-containment rule and focused lifecycle tests are this implementation's application of that behavior.
