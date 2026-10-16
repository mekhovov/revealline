import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('frozen verifier rejects stale optional HTML descriptors and pack pins', () => {
  const result = spawnSync('python3', ['-B', '-m', 'unittest', 'test_verify_frozen_offline.py'], {
    cwd: fileURLToPath(new URL('./utility/', import.meta.url)),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout);
});
