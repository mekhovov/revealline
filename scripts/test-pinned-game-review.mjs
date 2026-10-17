import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

test('pinned Git review serves exact source and observer bytes within localhost bounds', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const result = spawnSync(
    'python3',
    ['-B', '-m', 'unittest', 'discover', '-s', 'scripts', '-p', 'test_pinned_game_review.py'],
    { cwd: root, encoding: 'utf8', timeout: 120_000, maxBuffer: 4 * 1024 * 1024 },
  );
  assert.ifError(result.error);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stderr, /Ran \d+ tests[\s\S]*\nOK\s*$/);
});
