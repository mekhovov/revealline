import assert from 'node:assert/strict';
import test from 'node:test';
import { runTusResumeAcceptance } from '../scripts/tus-resume-acceptance.mjs';

test('production browser tus client resumes exact bytes after a dropped PATCH response', async () => {
  const result = await runTusResumeAcceptance();
  assert.equal(result.passed, true);
  assert.equal(result.bytesMatch, true);
  assert.equal(result.network.submissionCreates, 1);
  assert.equal(result.network.uploadCreates, 1);
  assert.deepEqual(result.network.headOffsets, [17]);
  assert.deepEqual(result.network.patchOffsets, [0, 17, 65]);
  assert.equal(result.resumedProgress[0], 17);
  assert.equal(result.resumedProgress.at(-1), result.payloadBytes);
});
