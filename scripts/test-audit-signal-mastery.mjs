import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createSignalCandidates } from '../game/content-design/signal-candidates.mjs';
import { compileContentProject, resolveMission } from '../game/content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../game/core/index.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../game/replay.mjs';

test('mastery audit preserves rejected trials and emits replay-verifiable prefixes of identified source routes', async () => {
  const root = new URL('../', import.meta.url);
  const report = JSON.parse(
    execFileSync(process.execPath, ['scripts/audit-signal-mastery.mjs'], {
      cwd: fileURLToPath(root),
      encoding: 'utf8',
      timeout: 60000,
    }),
  );
  assert.equal(report.format, 'SignalMasteryCoverageObservationV1');
  assert.equal(report.qualification, 'sampled-route-predicates-not-awards-or-human-validation');
  assert.equal(report.seed, 1);
  assert.equal(report.rows.length, 42);
  assert.equal(
    new Set(report.rows.map((row) => `${row.id}/${row.difficulty}/${row.turnPolicy}`)).size,
    42,
  );
  const fixtures = new Map();
  for (const input of report.inputs) {
    const bytes = await readFile(new URL(input.path, root));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), input.sha256);
    fixtures.set(input.path, JSON.parse(bytes));
  }
  const project = compileContentProject(createSignalCandidates());
  let verified = 0;
  for (const row of report.rows) {
    const manifest = resolveMission(project, row.id, { difficulty: row.difficulty });
    assert.equal(manifest.simulationIdentity, row.simulationIdentity);
    const evidence = row.evidence;
    if (!evidence) {
      assert.equal(row.outcomes['sampled-mastery'], undefined);
      assert.equal(
        Object.values(row.outcomes).reduce((sum, count) => sum + count, 0),
        12,
      );
      continue;
    }
    assert.equal(evidence.result, 'sampled-mastery');
    const fixture = fixtures.get(evidence.input);
    const set = fixture.sets ? fixture.sets[evidence.setIndex] : fixture;
    const original = set.rows.find(([id]) => id === row.id);
    assert(original);
    assert(evidence.segments.length > 0 && evidence.segments.length <= original[3].length);
    evidence.segments.forEach(([direction, ticks], index) => {
      assert.equal(direction, original[3][index][0]);
      assert(Number.isSafeInteger(ticks) && ticks > 0);
      if (index < evidence.segments.length - 1) assert.equal(ticks, original[3][index][1]);
      else assert(ticks <= original[3][index][1]);
    });
    const options = { seed: report.seed, classId: 'scout', turnPolicy: row.turnPolicy };
    const run = createRun(manifest.level, options);
    const recorder = createRecorder(manifest.level, options, 'mastery-audit-not-human-validation');
    for (const [direction, ticks] of evidence.segments)
      for (let tick = 0; tick < ticks; tick++) {
        assert.equal(run.status, 'running');
        recordInput(recorder, { direction });
        stepRun(run, { direction }, FIXED_DT);
        assert.equal(run.classic.livesLost, 0);
      }
    assert.equal(run.status, 'won');
    assert.equal(run.tick, evidence.clearTicks);
    assert.equal(authoritativeCheckpoint(run).hash, evidence.checkpoint);
    assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
    if (row.difficulty === 'standard' && row.turnPolicy === 'immediate') {
      assert.equal(evidence.checkpoint, original[2]);
      assert.equal(evidence.input, 'game/test/fixtures/signal-mastery-routes.json');
    }
    verified++;
  }
  assert.equal(verified, 42);
  assert.equal(report.rows.filter((row) => !row.evidence).length, 0);
  assert(report.rows.some((row) => row.outcomes['ordinary-clear-only'] > 0));
  assert(report.rows.some((row) => row.outcomes['life-lost'] > 0));
  assert(report.limitations.some((line) => line.includes('not an impossibility proof')));
  assert(report.limitations.some((line) => line.includes('No level, speed, quota')));
});
