import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  findArchiveRoot,
  launchMusicIntake,
  resolveForwardedInput,
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
      privateOutput: '',
      forwarded: ['/music', '--license', 'cc0'],
    },
  );
});

test('unknown licence routes the source folder to private UA-FPV pack creation', async () => {
  let invocation;
  const code = await launchMusicIntake(
    ['music', '--license', 'unknown', '--private-output', 'private-packs'],
    {
      currentDirectory: '/caller',
      run: async (command, args, options) => {
        invocation = { command, args, options };
        return 0;
      },
    },
  );
  assert.equal(code, 0);
  assert.equal(invocation.command, process.execPath);
  assert.equal(invocation.options.cwd.endsWith('/go_test'), true);
  assert.equal(invocation.args[0].endsWith('/scripts/ua-fpv-local-pack.mjs'), true);
  assert.deepEqual(invocation.args.slice(1), [
    '--source-dir',
    '/caller/music',
    '--output-dir',
    '/caller/private-packs',
  ]);
});

test('unknown licence cannot publish or omit its private destination', async () => {
  await assert.rejects(
    launchMusicIntake(['music', '--license', 'unknown'], {
      currentDirectory: '/caller',
    }),
    /requires --private-output/,
  );
  await assert.rejects(
    launchMusicIntake(
      ['music', '--license', 'unknown', '--private-output', 'private-packs', '--open-pr'],
      { currentDirectory: '/caller' },
    ),
    /private-only/,
  );
});

test('unknown licence rejects duplicate, extra, and silently ignored arguments', async () => {
  const options = { currentDirectory: '/caller', run: async () => 0 };
  await assert.rejects(
    launchMusicIntake(
      ['music', '--license', 'unknown', '--license', 'cc0', '--private-output', 'private-packs'],
      options,
    ),
    /--license may be provided only once/,
  );
  await assert.rejects(
    launchMusicIntake(
      [
        'music',
        '--license',
        'unknown',
        '--private-output',
        'private-packs',
        '--private-output',
        'other-packs',
      ],
      options,
    ),
    /--private-output may be provided only once/,
  );
  await assert.rejects(
    launchMusicIntake(
      ['music', 'other-music', '--license', 'unknown', '--private-output', 'private-packs'],
      options,
    ),
    /exactly one source folder/,
  );
  await assert.rejects(
    launchMusicIntake(
      [
        'music',
        '--license',
        'unknown',
        '--styles',
        'rock,electro,fpv',
        '--private-output',
        'private-packs',
      ],
      options,
    ),
    /--styles is not used/,
  );
});

test('unknown licence accepts equals syntax without weakening private-only routing', async () => {
  let invocation;
  const code = await launchMusicIntake(
    ['music', '--license=unknown', '--private-output=private-packs'],
    {
      currentDirectory: '/caller',
      run: async (command, args, options) => {
        invocation = { command, args, options };
        return 0;
      },
    },
  );
  assert.equal(code, 0);
  assert.deepEqual(invocation.args.slice(1), [
    '--source-dir',
    '/caller/music',
    '--output-dir',
    '/caller/private-packs',
  ]);
});

test('launcher help always documents private intake without invoking an archive', async () => {
  const originalLog = console.log;
  const messages = [];
  console.log = (message) => messages.push(message);
  try {
    const code = await launchMusicIntake(['--help'], {
      environment: { REVEALLINE_SOUNDTRACK_ARCHIVE: '/archive-that-must-not-be-read' },
      run: async () => {
        throw new Error('help must not invoke another process');
      },
    });
    assert.equal(code, 0);
  } finally {
    console.log = originalLog;
  }
  assert.match(messages.join('\n'), /--license unknown/);
  assert.match(messages.join('\n'), /--private-output/);
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

test('invalid explicit archive checkout cannot fall back to an automatic checkout', async (t) => {
  const automaticRoot = await fakeArchive(t);
  await assert.rejects(
    findArchiveRoot({
      explicitRoot: path.join(automaticRoot, 'missing'),
      environment: { REVEALLINE_SOUNDTRACK_ARCHIVE: automaticRoot },
      homeDirectory: path.join(automaticRoot, 'unused-home'),
      repositoryRoot: path.join(automaticRoot, 'unused-game'),
    }),
    /explicit --archive-root is not a RevealLine Soundtracks 02 checkout/,
  );
});

test('relative music input resolves from the caller while option values remain unchanged', () => {
  assert.deepEqual(
    resolveForwardedInput(
      ['music', '--source', 'https://creator.example/song', '--description', 'relative words'],
      '/caller',
    ),
    [
      '/caller/music',
      '--source',
      'https://creator.example/song',
      '--description',
      'relative words',
    ],
  );
});

test('launcher forwards unchanged intake arguments with the archive as cwd', async (t) => {
  const archiveRoot = await fakeArchive(t);
  let invocation;
  const code = await launchMusicIntake(
    [
      'music',
      '--archive-root',
      archiveRoot,
      '--source',
      'https://creator.example/song',
      '--confirm-rights',
    ],
    {
      currentDirectory: '/caller',
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
    '/caller/music',
    '--source',
    'https://creator.example/song',
    '--confirm-rights',
  ]);
});
