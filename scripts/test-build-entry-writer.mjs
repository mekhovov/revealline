import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { writeBuildEntry } from './build-entry-writer.mjs';

test('built bytes remain independent after source changes', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'build-entry-writer-'));
  try {
    const source = path.join(root, 'source'),
      target = path.join(root, 'target');
    const accepted = Buffer.from('accepted immutable asset');
    await fs.writeFile(source, accepted);
    await writeBuildEntry(source, target, accepted);
    await fs.writeFile(source, 'changed original');
    assert.deepEqual(await fs.readFile(target), accepted);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('generated or changed entries always retain prepared bytes', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'build-entry-writer-'));
  try {
    const source = path.join(root, 'source'),
      target = path.join(root, 'target');
    const accepted = Buffer.from('prepared');
    await writeBuildEntry(source, target, accepted);
    assert.deepEqual(await fs.readFile(target), accepted);
    await fs.writeFile(source, 'original');
    await writeBuildEntry(source, target, accepted);
    assert.deepEqual(await fs.readFile(target), accepted);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
