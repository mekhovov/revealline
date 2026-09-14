import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { writePresentation } from '../../scripts/write-presentation.mjs';

function fixture(value) {
  const bytes = Buffer.from(value);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const file = `assets/${sha256}.png`;
  return new Map([
    [file, bytes],
    [
      'manifest.json',
      Buffer.from(
        JSON.stringify({
          format: 'revealline-presentation-build.v1',
          files: [{ path: file, bytes: bytes.length, sha256 }],
        }),
      ),
    ],
  ]);
}

test('compiler adoption replaces its complete owned tree and detects stale bytes', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rl-presentation-output-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const out = path.join(root, 'compiled'),
    a = fixture('first'),
    b = fixture('second');
  await writePresentation(a, out);
  await writePresentation(a, out, { check: true });
  await assert.rejects(writePresentation(b, out, { check: true }), /Stale/);
  await writePresentation(b, out);
  await writePresentation(b, out, { check: true });
  assert.deepEqual(await fs.readdir(path.join(out, 'assets')), [[...b.keys()][0].slice(7)]);
  assert.deepEqual(await fs.readdir(root), ['compiled']);
});

test('unknown, modified or linked output cannot be discarded by regeneration', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rl-presentation-guard-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const out = path.join(root, 'compiled'),
    a = fixture('first'),
    b = fixture('second');
  await writePresentation(a, out);
  const note = path.join(out, 'my-notes.txt');
  await fs.writeFile(note, 'retain me');
  await assert.rejects(writePresentation(b, out), /Unmanaged/);
  assert.equal(await fs.readFile(note, 'utf8'), 'retain me');
  await fs.unlink(note);
  const file = path.join(out, [...a.keys()][0]);
  await fs.writeFile(file, 'manual edit');
  await assert.rejects(writePresentation(b, out), /does not match/);
  assert.equal(await fs.readFile(file, 'utf8'), 'manual edit');
  const link = path.join(root, 'linked');
  await fs.symlink(out, link, 'dir');
  await assert.rejects(writePresentation(b, link), /real directory/);
});
