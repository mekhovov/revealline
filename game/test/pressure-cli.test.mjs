import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createStarterProject } from '../content-design/starter.mjs';
import {
  inspectPressureDifficulty,
  withPressureDifficulty,
} from '../content-design/pressure-candidates.mjs';

const cli = new URL('../../scripts/compile-content-project.mjs', import.meta.url);
const source = createStarterProject();
const run = (...args) =>
  spawnSync(process.execPath, [cli.pathname, '-', ...args], {
    input: JSON.stringify(source),
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
  });
test('CLI pressure audit and explicit candidate export use the same owned compiler', () => {
  for (const [flag, expected] of [
    ['--pressure', inspectPressureDifficulty(source)],
    ['--pressure-candidate', withPressureDifficulty(source)],
  ]) {
    const result = run(flag);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), expected);
  }
});
test('CLI refuses ambiguous or falsely filtered whole-project pressure output', () => {
  for (const extra of [
    ['--mode', 'solo'],
    ['--check'],
    ['--difficulty', 'expert'],
    ['--pressure-candidate'],
    ['--mission', 'nearby-shore'],
    ['--pressure'],
  ]) {
    const result = run('--pressure', ...extra);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
  }
});
