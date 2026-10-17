import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { constants } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { canCloneBuildEntry, writeBuildEntry } from './build-entry-writer.mjs';

test('cloning is eligible only for known matching filesystem devices', () => {
  assert.equal(canCloneBuildEntry({ dev: 16777235 }, { dev: 16777235 }), true);
  assert.equal(canCloneBuildEntry({ dev: 16777235 }, { dev: 905969668 }), false);
  assert.equal(canCloneBuildEntry({ dev: 0 }, { dev: 0 }), true);
  for (const source of [undefined, {}, { dev: -1 }, { dev: NaN }, { dev: '7' }])
    assert.equal(canCloneBuildEntry(source, source), false);
  assert.equal(canCloneBuildEntry({ dev: 7 }, {}), false);
});

// Exercise the actual writer body against explicit filesystem boundaries. These
// are synthetic branch tests, not filesystem-speed or publication evidence.
async function writerBoundary({
  platform = 'darwin',
  sameDevice = true,
  regular = true,
  missing = false,
  parentFails = false,
  changed = false,
  cloneFails = false,
  corruptClone = false,
  writeFails = false,
} = {}) {
  const accepted = Buffer.from('accepted bytes'),
    calls = [];
  let target;
  const clone = async () => {
    calls.push('clone');
    if (cloneFails) throw Error('Clone unavailable');
    target = Buffer.from(corruptClone ? 'corrupt clone' : accepted);
  };
  const boundary = {
    lstat: async () => {
      if (missing) throw Error('Missing generated source');
      return { dev: 1, size: accepted.length, isFile: () => regular };
    },
    stat: async () => {
      if (parentFails) throw Error('Parent stat unavailable');
      return { dev: sameDevice ? 1 : 2 };
    },
    readFile: async (name) => {
      calls.push(`read:${name}`);
      return name === '/source' ? Buffer.from(changed ? 'changed source' : accepted) : target;
    },
    copyFile: async (_source, _target, flag) => {
      assert.equal(flag, constants.COPYFILE_FICLONE_FORCE);
      await clone();
    },
    writeFile: async (_name, bytes) => {
      calls.push('write');
      if (writeFails) throw Error('Destination write failed');
      target = Buffer.from(bytes);
    },
  };
  await runInNewContext(`(${writeBuildEntry.toString()})('/source', '/target', accepted)`, {
    Buffer,
    accepted,
    fs: boundary,
    process: { platform },
    dirname: path.dirname,
    resolve: path.resolve,
    constants,
    canCloneBuildEntry,
    runFile: async (command, args) => {
      assert.equal(command, '/bin/cp');
      assert.deepEqual(Array.from(args), ['-c', '/source', '/target']);
      await clone();
    },
  });
  assert.deepEqual(target, accepted);
  return calls;
}

test('cross-device entries bypass native copies and retain accepted bytes on both platforms', async () => {
  for (const platform of ['darwin', 'linux'])
    assert.deepEqual(await writerBoundary({ platform, sameDevice: false }), ['write']);
});

test('same-device exact clones are verified and need no fallback write', async () => {
  for (const platform of ['darwin', 'linux'])
    assert.deepEqual(await writerBoundary({ platform }), ['read:/source', 'clone', 'read:/target']);
});

test('failed or changed clones and unavailable source/device checks use exact fallback', async () => {
  for (const options of [
    { cloneFails: true },
    { corruptClone: true },
    { parentFails: true },
    { missing: true },
    { regular: false },
    { changed: true },
  ])
    assert.equal((await writerBoundary(options)).at(-1), 'write');
});

test('fallback write errors remain visible instead of reporting a successful build entry', async () => {
  await assert.rejects(
    writerBoundary({ sameDevice: false, writeFails: true }),
    /Destination write failed/,
  );
});

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
