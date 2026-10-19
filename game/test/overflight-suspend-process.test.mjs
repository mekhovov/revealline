import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
const execute = promisify(execFile);
const helper = fileURLToPath(new URL('./helpers/survival-suspend-process.mjs', import.meta.url));
const invoke = (file, ...args) =>
  execute(process.execPath, [helper, file, ...args], { timeout: 30000, maxBuffer: 1024 * 1024 });

test('separate processes restore production bytes and settle each interrupted result exactly once', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'survival-reopen-'));
  try {
    const seed = path.join(directory, 'seed.json');
    await invoke(seed, 'seed');
    for (const after of ['journal', 'records', 'mastery']) {
      const file = path.join(directory, `${after}.json`);
      await copyFile(seed, file);
      await invoke(file, 'interrupt', after);
      const interrupted = JSON.parse(await readFile(file, 'utf8'));
      assert.equal(interrupted.summary.phase, 'finishing');
      await invoke(file, 'recover');
      const recovered = JSON.parse(await readFile(file, 'utf8'));
      assert.deepEqual(recovered.summary, {
        phase: 'consumed',
        recordsPrevious: null,
        masteryPrevious: null,
      });
      const values = new Map(recovered.values);
      assert.equal(Object.keys(values.get('overflight-survivor-records.v1').entries).length, 1);
      assert.equal(Object.keys(values.get('overflight-world-mastery.v1').entries).length, 1);
      assert.equal(
        values.get('overflight-survivor-records.v1.receipt.v1').id,
        values.get('overflight-world-mastery.v1.receipt.v1').id,
      );
      await invoke(file, 'consumed');
      const final = JSON.parse(await readFile(file, 'utf8'));
      assert.deepEqual(
        final.values,
        recovered.values,
        'a fourth fresh process must not rewrite already-owned results',
      );
      assert.deepEqual(final.summary, { phase: 'consumed', refused: true });
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
