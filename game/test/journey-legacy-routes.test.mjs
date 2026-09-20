import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

test('legacy opening checkpoints remain exact while Arcade fixtures retain the same legal routes', async () => {
  const { stdout } = await promisify(execFile)(
    process.execPath,
    [fileURLToPath(new URL('../../scripts/qualify-journey-arcade-routes.mjs', import.meta.url))],
    { timeout: 120000, maxBuffer: 1024 * 1024 },
  );
  assert.deepEqual(JSON.parse(stdout), {
    verified: 60,
    legacyPolicy: 'journey-v1',
    policy: 'journey-arcade-v2',
    updated: false,
  });
});
