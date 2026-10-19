set -euo pipefail
test "$(git rev-parse HEAD)" = "$SOLO_CAPTURE_HEAD_SHA"
test -z "$(git status --porcelain --untracked-files=no)"
mkdir -p .cache
set +e
timeout --signal=TERM --kill-after=10s 330s node scripts/qualify-survival-native.mjs --out=.cache/survival-native-qualification.json --timeout-ms=300000 2>&1 | head -c 262145 > .cache/survival-native-qualification.log
statuses=("${PIPESTATUS[@]}")
set -e
test "$(wc -c < .cache/survival-native-qualification.log)" -le 262144
test "${statuses[0]}" -eq 0
test "${statuses[1]}" -eq 0
test "$(git rev-parse HEAD)" = "$SOLO_CAPTURE_HEAD_SHA"
test -z "$(git status --porcelain --untracked-files=no)"
node --input-type=module <<'NODE'
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { survivalDemoInventory } from './game/demo-modes/survival-catalog.mjs';
const path = '.cache/survival-native-qualification.json';
assert((await stat(path)).size <= 256 * 1024);
const report = JSON.parse(await readFile(path, 'utf8'));
assert.equal(report.format, 'SurvivalNativeQualificationV1');
assert.equal(report.complete, true);
assert.equal(report.head, process.env.SOLO_CAPTURE_HEAD_SHA);
assert.equal(report.environment.node, `v${process.env.NATIVE_DEMO_NODE}`);
assert.equal(report.environment.platform, 'linux');
assert.equal(report.environment.arch, 'x64');
const ids = survivalDemoInventory().map(entry => entry.id);
assert(ids.length > 0);
assert.deepEqual(report.checks.map(entry => entry.id), ids);
assert.deepEqual(report.counts, { required: ids.length, checked: ids.length, verified: ids.length });
assert(report.checks.every(entry => entry.verified && ['won', 'lost'].includes(entry.outcome) && entry.progress.kills > 0 && entry.progress.xpCollected > 0 && entry.progress.upgrades > 0));
NODE
