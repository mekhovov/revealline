import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('independent frozen inspector binds compressed originals and rejects malformed archives', () => {
  const result = spawnSync(
    'python3',
    ['-B', '-m', 'unittest', 'test_distribution_archive.py', 'test_release_artifact.py'],
    {
      cwd: fileURLToPath(new URL('./utility/', import.meta.url)),
      encoding: 'utf8',
      timeout: 120_000,
      maxBuffer: 4 * 1024 * 1024,
    },
  );
  assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout);
});
