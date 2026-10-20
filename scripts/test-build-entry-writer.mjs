import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { constants } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { canCloneBuildEntry, writeBuildEntry, writeBuildEntries } from './build-entry-writer.mjs';

test('expanded builds bound concurrent writes to four and create each parent only once', async () => {
  const entries = Array.from({ length: 11 }, (_, index) => ({
    name: `game/group-${index % 2}/${index}.mjs`,
    bytes: Buffer.from(`accepted ${index}`),
  }));
  const directories = [],
    written = [],
    releases = [];
  let active = 0,
    maximum = 0;
  const pending = writeBuildEntries('/source', '/staging', entries, {
    stat: async () => ({ dev: 1 }),
    mkdir: async (directory, options) => {
      assert.deepEqual(options, { recursive: true });
      directories.push(directory);
    },
    writeEntry: async (source, target, bytes, options) => {
      assert.deepEqual(options, { tryClone: true });
      active++;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => releases.push(resolve));
      written.push({ source, target, bytes });
      active--;
    },
  });
  for (let i = 0; i < 3; i++) {
    await new Promise(setImmediate);
    assert.equal(releases.length, Math.min(4, entries.length - i * 4));
    releases.splice(0).forEach((release) => release());
  }
  await pending;
  assert.equal(maximum, 4);
  assert.equal(active, 0);
  assert.deepEqual(directories.sort(), ['/staging/game/group-0', '/staging/game/group-1']);
  assert.deepEqual(
    written.sort((a, b) => a.source.localeCompare(b.source)),
    entries
      .map((entry) => ({
        source: path.join('/source', entry.name),
        target: path.join('/staging', entry.name),
        bytes: entry.bytes,
      }))
      .sort((a, b) => a.source.localeCompare(b.source)),
  );
});

test('expanded build failure stops scheduling and settles owned writes before staging cleanup', async () => {
  const entries = Array.from({ length: 12 }, (_, index) => ({
    name: `game/${index}`,
    bytes: Buffer.from('accepted'),
  }));
  const operations = [];
  const failure = new Error('Share disconnected');
  let settled = false;
  const pending = writeBuildEntries('/source', '/staging', entries, {
    stat: async () => ({ dev: 1 }),
    mkdir: async () => {},
    writeEntry: async (_source, target) =>
      new Promise((resolve, reject) => operations.push({ target, resolve, reject })),
  });
  const outcome = pending.then(
    () => {
      settled = true;
      return null;
    },
    (error) => {
      settled = true;
      return error;
    },
  );
  await new Promise(setImmediate);
  assert.equal(operations.length, 4);
  operations[0].reject(failure);
  await new Promise(setImmediate);
  assert.equal(settled, false, 'other writes still own the staging directory');
  assert.equal(operations.length, 4, 'no new writes start after failure');
  operations.slice(1).forEach((operation) => operation.resolve());
  assert.equal(await outcome, failure);
  assert.equal(operations.length, 4);
});

test('parent creation failure settles peers and empty builds schedule nothing', async () => {
  let writes = 0;
  const failure = new Error('Cannot create parent');
  await assert.rejects(
    writeBuildEntries('/source', '/staging', [{ name: 'game/a', bytes: Buffer.from('a') }], {
      stat: async () => ({ dev: 1 }),
      mkdir: async () => {
        throw failure;
      },
      writeEntry: async () => {
        writes++;
      },
    }),
    (error) => error === failure,
  );
  await writeBuildEntries('/source', '/staging', [], {
    stat: async () => {
      throw new Error('Unexpected device probe');
    },
    mkdir: async () => {
      throw new Error('Unexpected directory');
    },
    writeEntry: async () => {
      writes++;
    },
  });
  assert.equal(writes, 0);
});

test('cross-volume batch probes devices once and vetoes every impossible clone', async () => {
  const probes = [],
    writes = [];
  const entries = Array.from({ length: 24 }, (_, i) => ({
    name: `game/${i}`,
    bytes: Buffer.from(`accepted ${i}`),
  }));
  await writeBuildEntries('/source', '/staging', entries, {
    stat: async (name) => {
      probes.push(name);
      return { dev: name === '/source' ? 1 : 2 };
    },
    mkdir: async () => {},
    writeEntry: async (source, target, bytes, options) => {
      writes.push({ source, target, bytes, options });
    },
  });
  assert.deepEqual(probes.sort(), ['/source', '/staging']);
  assert.equal(writes.length, entries.length);
  for (const write of writes) assert.deepEqual(write.options, { tryClone: false });
  assert.deepEqual(
    writes.map((write) => write.bytes.toString()).sort(),
    entries.map((entry) => entry.bytes.toString()).sort(),
  );
});

test('unknown device metadata only vetoes cloning and settles both probes before writing', async () => {
  let release,
    writes = 0;
  const destination = new Promise((resolve) => {
    release = resolve;
  });
  const pending = writeBuildEntries(
    '/source',
    '/staging',
    [{ name: 'game/a', bytes: Buffer.from('accepted') }],
    {
      stat: async (name) => {
        if (name === '/source') throw new Error('Unavailable device metadata');
        return destination;
      },
      mkdir: async () => {},
      writeEntry: async (_source, _target, _bytes, options) => {
        assert.deepEqual(options, { tryClone: false });
        writes++;
      },
    },
  );
  await new Promise(setImmediate);
  assert.equal(writes, 0);
  release({ dev: 2 });
  await pending;
  assert.equal(writes, 1);
});

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
  tryClone = true,
  onProbe = () => {},
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
      onProbe();
      if (missing) throw Error('Missing generated source');
      return { dev: 1, size: accepted.length, isFile: () => regular };
    },
    stat: async () => {
      onProbe();
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
  await runInNewContext(
    `(${writeBuildEntry.toString()})('/source', '/target', accepted, { tryClone })`,
    {
      Buffer,
      accepted,
      tryClone,
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
    },
  );
  assert.deepEqual(target, accepted);
  return calls;
}

test('cross-device entries bypass native copies and retain accepted bytes on both platforms', async () => {
  for (const platform of ['darwin', 'linux'])
    assert.deepEqual(await writerBoundary({ platform, sameDevice: false }), ['write']);
});

test('explicit clone veto writes accepted bytes without any metadata probes', async () => {
  let probes = 0;
  assert.deepEqual(
    await writerBoundary({
      tryClone: false,
      onProbe: () => {
        probes++;
      },
    }),
    ['write'],
  );
  assert.equal(probes, 0);
  await assert.rejects(
    writerBoundary({ tryClone: false, writeFails: true }),
    /Destination write failed/,
  );
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
