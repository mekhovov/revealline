import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

test('Signal pacing audit authenticates all fourteen routes and separates observations from human claims', async () => {
  const root = new URL('../', import.meta.url);
  const report = JSON.parse(
    execFileSync(process.execPath, ['scripts/audit-signal-pacing.mjs'], {
      cwd: fileURLToPath(root),
      encoding: 'utf8',
      timeout: 30000,
    }),
  );
  assert.equal(report.format, 'SignalPacingObservationV1');
  assert.equal(report.evidence, 'deterministic-omniscient-fixtures-not-human-playtesting');
  assert.equal(report.rows.length, 14);
  assert.equal(new Set(report.rows.map((row) => row.id)).size, 7);
  for (const input of report.inputs) {
    const bytes = await readFile(new URL(input.path, root));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), input.sha256);
  }
  for (const row of report.rows) {
    assert.equal(row.lowRiskCleanup, 'not-assessed');
    assert(row.exposedTicks > 0 && row.exposedTicks <= row.clearTicks);
    assert.equal(
      row.belowAuthoredDurationHypothesis,
      row.clearSeconds < row.authoredDurationHypothesisSeconds[0],
    );
    assert.match(row.simulationIdentity, /^[a-f0-9]{16}$/u);
    assert.match(row.checkpoint, /^[a-f0-9]{16}$/u);
    if (row.fullMaterialNeutralization) {
      assert.equal(
        row.ticksAfterFullMaterialNeutralization,
        row.clearTicks - row.fullMaterialNeutralization.tick,
      );
      assert(row.fullMaterialNeutralization.coverage > 0);
    } else assert.equal(row.ticksAfterFullMaterialNeutralization, null);
  }
  const soft = report.rows.filter((row) => row.id === 'soft-crossing');
  assert.equal(
    soft[0].fullMaterialNeutralization,
    null,
    'Ordinary clear is not full material mastery.',
  );
  assert.equal(soft[1].ticksAfterFullMaterialNeutralization, 1032);
  assert.equal(soft[1].closuresAfterFullMaterialNeutralization, 1);
  assert(report.limitations.some((line) => line.includes('meaningful enemy')));
});
