import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const launcherFile = fileURLToPath(import.meta.url);
const gameRoot = path.resolve(path.dirname(launcherFile), '..');
const ARCHIVE_VALUE_OPTIONS = new Set([
  '--source',
  '--license',
  '--artist',
  '--styles',
  '--batch-id',
  '--batch-title',
  '--description',
  '--rights-evidence',
  '--attribution',
  '--title',
  '--derivative-notice',
]);

export const LAUNCHER_USAGE = `Usage from the RevealLine game repository:
  node intake/add-music.mjs <mp3-or-folder> [archive intake options]
    [--archive-root /path/to/revealline-soundtracks-02]

Private unknown-rights UA-FPV intake:
  node intake/add-music.mjs <folder> --license unknown
    --private-output /path/to/new-empty-private-directory

The launcher forwards the request to a clean RevealLine Soundtracks 02 checkout.
Set REVEALLINE_SOUNDTRACK_ARCHIVE or pass --archive-root when it is not in a
standard location. Run the archive command with --help for all intake options.

Public intake requires recording-specific redistribution and web-game playback
rights. A YouTube page alone is not permission. --license unknown builds private
local UA-FPV .rlsound packs and never writes to the public archive. See
docs/ua-fpv-upload-guide.md.`;

export function splitLauncherArguments(argv) {
  const forwarded = [];
  let archiveRoot = '',
    privateOutput = '';
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--archive-root') {
      const next = argv[index + 1];
      if (!next || next.startsWith('--')) {
        throw new Error('--archive-root requires a directory path.');
      }
      archiveRoot = next;
      index += 1;
    } else if (value.startsWith('--archive-root=')) {
      archiveRoot = value.slice('--archive-root='.length);
      if (!archiveRoot) throw new Error('--archive-root requires a directory path.');
    } else if (value === '--private-output') {
      const next = argv[index + 1];
      if (!next || next.startsWith('--')) {
        throw new Error('--private-output requires a directory path.');
      }
      privateOutput = next;
      index += 1;
    } else if (value.startsWith('--private-output=')) {
      privateOutput = value.slice('--private-output='.length);
      if (!privateOutput) throw new Error('--private-output requires a directory path.');
    } else {
      forwarded.push(value);
    }
  }
  return { archiveRoot, privateOutput, forwarded };
}

async function isArchiveRoot(candidate) {
  if (!candidate) return false;
  const root = path.resolve(candidate);
  const script = path.join(root, 'intake', 'add-music.mjs');
  if (script === launcherFile) return false;
  try {
    await access(script);
    return true;
  } catch {
    return false;
  }
}

export async function findArchiveRoot({
  explicitRoot = '',
  environment = process.env,
  homeDirectory = os.homedir(),
  repositoryRoot = gameRoot,
} = {}) {
  if (explicitRoot) {
    if (await isArchiveRoot(explicitRoot)) return path.resolve(explicitRoot);
    throw new Error(
      `The explicit --archive-root is not a RevealLine Soundtracks 02 checkout: ${explicitRoot}`,
    );
  }
  const candidates = [
    environment.REVEALLINE_SOUNDTRACK_ARCHIVE,
    path.resolve(repositoryRoot, '..', 'revealline-soundtracks-02'),
    path.join(homeDirectory, '.codex', 'worktrees', 'revealline-soundtracks-02'),
  ];
  for (const candidate of candidates) {
    if (await isArchiveRoot(candidate)) return path.resolve(candidate);
  }
  return null;
}

export function resolveForwardedInput(argv, currentDirectory = process.cwd()) {
  const resolved = [];
  let foundInput = false;
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    resolved.push(value);
    if (ARCHIVE_VALUE_OPTIONS.has(value)) {
      if (index + 1 < argv.length) resolved.push(argv[++index]);
    } else if (!value.startsWith('-') && !foundInput) {
      resolved[resolved.length - 1] = path.resolve(currentDirectory, value);
      foundInput = true;
    }
  }
  return resolved;
}

function optionValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function musicInput(argv) {
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (ARCHIVE_VALUE_OPTIONS.has(value)) index += 1;
    else if (!value.startsWith('-')) return value;
  }
  return '';
}

function run(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options);
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) reject(new Error(`Archive intake stopped by ${signal}.`));
      else resolve(code ?? 1);
    });
  });
}

export async function launchMusicIntake(argv, dependencies = {}) {
  const {
    archiveRoot: explicitRoot,
    privateOutput,
    forwarded: rawForwarded,
  } = splitLauncherArguments(argv);
  const currentDirectory = dependencies.currentDirectory ?? process.cwd();
  const forwarded = resolveForwardedInput(rawForwarded, currentDirectory);
  const runner = dependencies.run ?? run;
  if (optionValue(forwarded, '--license') === 'unknown') {
    if (!privateOutput) {
      throw new Error('--license unknown requires --private-output with a new empty directory.');
    }
    if (explicitRoot) {
      throw new Error('--archive-root is not used with private --license unknown intake.');
    }
    if (forwarded.includes('--open-pr') || forwarded.includes('--confirm-rights')) {
      throw new Error(
        '--license unknown cannot use --open-pr or --confirm-rights because it is private-only.',
      );
    }
    const input = musicInput(forwarded);
    if (!input) throw new Error('--license unknown requires one source folder.');
    const output = path.resolve(currentDirectory, privateOutput);
    const script = path.join(gameRoot, 'scripts', 'ua-fpv-local-pack.mjs');
    console.log('Unknown licence selected: building private local UA-FPV packs only.');
    console.log(`Private output directory: ${output}`);
    return runner(process.execPath, [script, '--source-dir', input, '--output-dir', output], {
      cwd: gameRoot,
      stdio: 'inherit',
    });
  }
  if (privateOutput) {
    throw new Error('--private-output is supported only with --license unknown.');
  }
  const archiveRoot = await findArchiveRoot({
    explicitRoot,
    environment: dependencies.environment,
    homeDirectory: dependencies.homeDirectory,
    repositoryRoot: dependencies.repositoryRoot,
  });
  if (!archiveRoot) {
    if (forwarded.length === 1 && ['--help', '-h'].includes(forwarded[0])) {
      console.log(LAUNCHER_USAGE);
      return 0;
    }
    throw new Error(
      'RevealLine Soundtracks 02 was not found. Clone ' +
        'https://github.com/mekhovov/revealline-soundtracks-02.git and pass ' +
        '--archive-root /path/to/revealline-soundtracks-02.',
    );
  }
  const script = path.join(archiveRoot, 'intake', 'add-music.mjs');
  console.log(`Using soundtrack archive checkout: ${archiveRoot}`);
  return runner(process.execPath, [script, ...forwarded], {
    cwd: archiveRoot,
    stdio: 'inherit',
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === launcherFile) {
  try {
    process.exitCode = await launchMusicIntake(process.argv.slice(2));
  } catch (error) {
    console.error(`Soundtrack intake launcher failed: ${error.message}`);
    console.error('Run with --help for setup instructions.');
    process.exitCode = 1;
  }
}
