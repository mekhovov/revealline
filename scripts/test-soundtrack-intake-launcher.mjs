import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  findArchiveRoot,
  launchMusicIntake,
  splitLauncherArguments,
} from '../intake/add-music.mjs';

async function temporary(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'soundtrack-launcher-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

async function fakeArchive(t) {
  const root = await temporary(t);
  await mkdir(path.join(root, 'intake'));
  await writeFile(path.join(root, 'intake', 'add-music.mjs'), '');
  return root;
}

test('launcher removes its archive location before forwarding intake arguments', () => {
  assert.deepEqual(
    splitLauncherArguments(['/music', '--archive-root', '/archive', '--license', 'cc0']),
    {
      archiveRoot: '/archive',
      forwarded: ['/music', '--license', 'cc0'],
    },
  );
});

test('explicit archive checkout wins over automatic locations', async (t) => {
  const explicitRoot = await fakeArchive(t);
  const automaticRoot = await fakeArchive(t);
  assert.equal(
    await findArchiveRoot({
      explicitRoot,
      environment: { REVEALLINE_SOUNDTRACK_ARCHIVE: automaticRoot },
      homeDirectory: path.join(automaticRoot, 'unused-home'),
      repositoryRoot: path.join(automaticRoot, 'unused-game'),
    }),
    explicitRoot,
  );
});

test('launcher forwards unchanged intake arguments with the archive as cwd', async (t) => {
  const archiveRoot = await fakeArchive(t);
  let invocation;
  const code = await launchMusicIntake(
    [
      '/music',
      '--archive-root',
      archiveRoot,
      '--source',
      'https://creator.example/song',
      '--confirm-rights',
    ],
    {
      run: async (command, args, options) => {
        invocation = { command, args, options };
        return 0;
      },
    },
  );
  assert.equal(code, 0);
  assert.equal(invocation.command, process.execPath);
  assert.equal(invocation.options.cwd, archiveRoot);
  assert.deepEqual(invocation.args.slice(1), [
    '/music',
    '--source',
    'https://creator.example/song',
    '--confirm-rights',
  ]);
});
