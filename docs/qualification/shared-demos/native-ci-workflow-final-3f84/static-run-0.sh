set -euo pipefail
test "$(git rev-parse HEAD)" = "$SOLO_CAPTURE_HEAD_SHA"
test -z "$(git status --porcelain --untracked-files=no)"
mkdir -p .cache
mkdir .cache/solo-native-verification
# The collector itself has a 15-minute total and 60-second worker budget.
# Retain at most 4 MiB plus an overflow sentinel; any truncation fails.
set +e
timeout --signal=TERM --kill-after=10s 16m node scripts/capture-solo-native-candidates.mjs 2>&1 | head -c 4194305 > .cache/solo-native-verification/scan.log
statuses=("${PIPESTATUS[@]}")
set -e
test "$(wc -c < .cache/solo-native-verification/scan.log)" -le 4194304
test "${statuses[0]}" -eq 0
test "${statuses[1]}" -eq 0
node --input-type=module <<'NODE'
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
assert.equal(process.version, `v${process.env.NATIVE_DEMO_NODE}`);
assert.equal(process.platform, 'linux');
assert.equal(process.arch, 'x64');
const path = '.cache/solo-native-candidates/report.json';
assert((await stat(path)).size <= 8 * 1024 ** 2);
const report = JSON.parse(await readFile(path, 'utf8'));
assert.equal(report.mode, 'scan-only');
assert.equal(report.complete, true);
assert.equal(report.scanComplete, true);
assert.equal(report.sourceStable, true);
assert.equal(report.existingCoveragePassed, true);
assert.equal(report.sourceBefore.revision, process.env.SOLO_CAPTURE_HEAD_SHA);
assert.deepEqual(report.sourceAfter, report.sourceBefore);
assert.equal(report.sources.length, report.requiredSources);
assert(report.requiredSources > 0 && report.requiredEntries.length > 0);
assert(report.sources.every(source => source.strictUsable && !source.candidate));
assert.deepEqual(report.missingEntries, []);
assert.deepEqual(report.unusableSources, []);
assert.deepEqual(report.unusableEntries, []);
assert.deepEqual(report.artifacts, []);
assert.equal(report.automaticallyAdmitted, false);
NODE
